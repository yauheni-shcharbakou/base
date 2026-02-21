import { constantCase, pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';
import { ProtoContextService } from 'compiler/types';
import { MethodSignature, SyntaxKind } from 'ts-morph';

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

export class AddNestServiceSchemasTask extends TransformTask {
  private packageName: string | undefined;

  private declareImports() {
    this.addOrUpdateImport('path', ['join']);
    this.addOrUpdateImport('@grpc/grpc-js', ['Metadata']);
    this.addOrUpdateImport('@nestjs/common', ['Type', 'ForbiddenException', 'Inject']);
    this.addOrUpdateImport('@nestjs/microservices', ['ClientGrpc', 'RpcException']);
    this.addOrUpdateImport('rxjs', [
      'catchError',
      'finalize',
      'map',
      'Observable',
      'ReplaySubject',
      'switchMap',
      'OperatorFunction',
      'throwError',
    ]);

    this.addOrUpdateImport(this.importFromCompilerPath, [
      'GrpcProxyControllerFactoryParams',
      'GrpcProxyControllerFactoryResult',
      'GrpcProxyControllerFactory',
      'GrpcProxyMethodParams',
      'GrpcProxyStreamMethodParams',
      'GrpcAccessService',
      'PROTO_PATH',
      'GRPC_ACCESS_SERVICE',
    ]);
  }

  private declareSchema(service: ProtoContextService, controllerMethods: MethodSignature[]) {
    const methodTypes: MethodTypes = controllerMethods.reduce(
      (acc: MethodTypes, method) => {
        const name = method.getName();
        const firstArgument = method.getParameter('request');
        const responseType = method.getReturnType()?.getText();

        if (!firstArgument || !responseType) {
          return acc;
        }

        const requestType = firstArgument.getType().getText();
        const typeNode = firstArgument.getTypeNode();

        if (typeNode && typeNode.isKind(SyntaxKind.TypeReference)) {
          const typeArgs = typeNode.getTypeArguments() ?? [];

          if (typeArgs?.length) {
            acc.streamMethods.push({
              name,
              streamType: typeArgs[0].getText(),
              responseType,
              requestType,
            });

            return acc;
          }
        }

        acc.unaryMethods.push({ name, requestType, responseType });
        return acc;
      },
      { unaryMethods: [], streamMethods: [] },
    );

    const schemaDeclaration = this.renderTemplate('nest.service-schema', {
      data: {
        service,
        package: this.packageName,
        protoPath: this.protoContext.protoPath,
        unaryMethods: methodTypes.unaryMethods,
        streamMethods: methodTypes.streamMethods,
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

    this.protoContext.services.forEach((service) => {
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
        return;
      }

      const controllerMethods = controllerInterface.getMethods();
      this.declareSchema(service, controllerMethods);
    });
  }
}
