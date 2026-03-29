import { constantCase, pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';
import { ProtoContextService } from 'compiler/types';
import { SyntaxKind } from 'ts-morph';

type MethodDefinition = {
  name: string;
  requestType: string;
  responseType: string;
};

type StreamMethodDefinition = MethodDefinition & {
  streamType: string;
};

type MethodTypes = {
  unaryMethods: MethodDefinition[];
  streamMethods: StreamMethodDefinition[];
};

type TemplateData = MethodTypes & {
  id: string;
  name: string;
};

export class AddNestServiceSchemasTask extends TransformTask {
  private packageName: string | undefined;

  private declareImports() {
    this.addOrUpdateImport('path', ['join']);
    this.addOrUpdateImport('@grpc/grpc-js', ['Metadata']);
    this.addOrUpdateImport('@nestjs/common', ['Type']);
    this.addOrUpdateImport('@nestjs/microservices', ['ClientGrpc']);

    this.addOrUpdateImport(this.importFromCompilerPath, [
      'GrpcProxyControllerFactoryParams',
      'GrpcProxyControllerFactoryResult',
      'GrpcProxyControllerFactory',
      'GrpcProxyMethodParams',
      'GrpcProxyStreamMethodParams',
      'PROTO_PATH',
    ]);
  }

  private declareSchemas(services: ProtoContextService[]) {
    const serviceTemplateData = services.reduce((acc: TemplateData[], service) => {
      const controllerName = pascalCase(`grpc.${service.name}.controller`);
      const clientName = pascalCase(`grpc.${service.name}.client`);
      const serviceConstName = constantCase(`${service.name}.name`);

      const controllerInterface = this.sourceFile.getInterface(controllerName);
      const clientInterface = this.sourceFile.getInterface(clientName);

      const serviceNameValue = this.sourceFile
        .getVariableDeclaration(serviceConstName)
        ?.getInitializer()
        ?.getText();

      if (!controllerInterface || !clientInterface || !serviceNameValue) {
        return acc;
      }

      const controllerMethods = controllerInterface.getMethods();

      const methodTypes: MethodTypes = controllerMethods.reduce(
        (methods: MethodTypes, method) => {
          const name = method.getName();
          const firstArgument = method.getParameter('request');
          const responseType = method.getReturnType()?.getText();

          if (!firstArgument || !responseType) {
            return methods;
          }

          const requestType = firstArgument.getType().getText();
          const typeNode = firstArgument.getTypeNode();

          if (typeNode && typeNode.isKind(SyntaxKind.TypeReference)) {
            const typeArgs = typeNode.getTypeArguments() ?? [];

            if (typeArgs?.length) {
              methods.streamMethods.push({
                name,
                streamType: typeArgs[0].getText(),
                responseType,
                requestType,
              });

              return methods;
            }
          }

          methods.unaryMethods.push({ name, requestType, responseType });
          return methods;
        },
        { unaryMethods: [], streamMethods: [] },
      );

      acc.push({
        id: service.id,
        name: service.name,
        ...methodTypes,
      });

      return acc;
    }, []);

    const schemaDeclaration = this.renderTemplate('nest.service-schema', {
      data: {
        services: serviceTemplateData,
        package: this.packageName,
        protoPath: this.protoContext.protoPath,
      },
      pascalCase,
      constantCase,
    });

    this.sourceFile.addStatements(schemaDeclaration);
  }

  protected onInit() {
    this.packageName = this.getPackageNameValue();
  }

  canTransform(): boolean | Promise<boolean> {
    return !!(this.protoContext.services.length && this.protoContext.packageId);
  }

  transform(): void | Promise<void> {
    if (!this.packageName) {
      return;
    }

    this.declareImports();
    this.declareSchemas(this.protoContext.services);
  }
}
