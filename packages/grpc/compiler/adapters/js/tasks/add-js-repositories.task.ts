import { pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';
import { ProtoContextService } from 'compiler/types';
import { MethodSignature, Node } from 'ts-morph';

type MethodData = {
  name: string;
  requestType: string;
  responseType: string;
};

export class AddJsRepositoriesTask extends TransformTask {
  private declareImports() {
    this.addOrUpdateImport('@grpc/grpc-js', ['CallOptions', 'Metadata']);

    this.addOrUpdateImport(this.importFromCompilerPath, ['GrpcRepository']);
  }

  private declareRepository(service: ProtoContextService) {
    const clientInterfaceName = pascalCase(`grpc.${service.name}.client`);
    const clientInterface = this.sourceFile.getInterface(clientInterfaceName);

    if (!clientInterface) {
      return;
    }

    const clientMethods = new Map<string, MethodSignature>();

    for (const method of clientInterface.getMethods()) {
      const name = method.getName();

      if (!clientMethods.has(name)) {
        clientMethods.set(name, method);
      }
    }

    const methods: MethodData[] = Array.from(clientMethods.entries()).reduce(
      (acc: MethodData[], [name, method]) => {
        const requestType = method.getParameter('request')?.getType()?.getText();
        const callbackTypeNode = method.getParameter('callback')?.getTypeNode();

        if (!requestType || !Node.isFunctionTypeNode(callbackTypeNode)) {
          return acc;
        }

        const responseType = callbackTypeNode.getParameter('response')?.getType()?.getText();

        if (!responseType) {
          return acc;
        }

        acc.push({ name, requestType, responseType });
        return acc;
      },
      [],
    );

    const repositoryDeclaration = this.renderTemplate('js.repository', {
      data: {
        serviceId: service.id,
        methods,
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
    this.protoContext.services.forEach((service) => this.declareRepository(service));
  }
}
