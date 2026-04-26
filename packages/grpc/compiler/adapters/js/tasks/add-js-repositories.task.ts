import { pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';
import { ProtoContextService } from 'compiler/types';
import { MethodSignature, Node } from 'ts-morph';

type MethodData = {
  name: string;
  requestType: string;
  responseType: string;
};

type TemplateData = {
  id: string;
  unaryMethods: MethodData[];
};

export class AddJsRepositoriesTask extends TransformTask {
  private declareImports() {
    this.addOrUpdateImport('@grpc/grpc-js', [
      'CallOptions',
      'ClientOptions',
      'ChannelCredentials',
      'Metadata',
    ]);
  }

  private declareRepositories(services: ProtoContextService[]) {
    const templateData: TemplateData[] = services.reduce((acc: TemplateData[], service) => {
      const clientInterfaceName = pascalCase(`grpc.${service.name}.client`);
      const clientInterface = this.sourceFile.getInterface(clientInterfaceName);

      if (!clientInterface) {
        return acc;
      }

      const clientMethods = new Map<string, MethodSignature>();

      for (const method of clientInterface.getMethods()) {
        const name = method.getName();

        if (!clientMethods.has(name)) {
          clientMethods.set(name, method);
        }
      }

      const unaryMethods: MethodData[] = Array.from(clientMethods.entries()).reduce(
        (methods: MethodData[], [name, method]) => {
          const requestType = method.getParameter('request')?.getType()?.getText(this.sourceFile);
          const callbackTypeNode = method.getParameter('callback')?.getTypeNode();

          if (!requestType || !Node.isFunctionTypeNode(callbackTypeNode)) {
            return methods;
          }

          const responseType = callbackTypeNode
            .getParameter('response')
            ?.getType()
            ?.getText(this.sourceFile);

          if (!responseType) {
            return methods;
          }

          methods.push({ name, requestType, responseType });
          return methods;
        },
        [],
      );

      acc.push({ id: service.id, unaryMethods });
      return acc;
    }, []);

    const repositoryDeclaration = this.renderTemplate('js.repository', {
      data: {
        services: templateData,
      },
      pascalCase,
    });

    this.sourceFile.addStatements(repositoryDeclaration);
  }

  canTransform(): boolean | Promise<boolean> {
    return !(!this.protoContext.services.length || !this.protoContext.packageId);
  }

  transform(): void {
    this.declareImports();
    this.declareRepositories(this.protoContext.services);
  }
}
