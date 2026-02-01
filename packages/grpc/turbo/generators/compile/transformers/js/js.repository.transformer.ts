import { pascalCase } from 'change-case-all';
import * as _ from 'lodash';
import { ServiceData } from '../../context';
import { MethodSignature, Node } from 'ts-morph';
import { BaseTransformer } from '../base.transformer';

export class JsRepositoryTransformer extends BaseTransformer {
  private declareImports() {
    this.addOrUpdateImport('@grpc/grpc-js', ['CallOptions', 'Metadata']);

    this.addOrUpdateImport(this.importFromCompilerPath, ['GrpcRepository']);
  }

  private declareRepository(service: ServiceData) {
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

    const repositoryClass = this.sourceFile.addClass({
      name: pascalCase(`grpc.${service.id}.repository`),
      isExported: true,
      extends: `GrpcRepository<${clientInterfaceName}>`,
    });

    repositoryClass.addConstructor({
      parameters: [
        {
          name: 'address',
          type: 'string',
        },
        {
          name: 'credentials',
          type: 'ChannelCredentials',
          initializer: 'ChannelCredentials.createInsecure()',
        },
        {
          name: 'options',
          type: 'Partial<ClientOptions>',
          hasQuestionToken: true,
        },
      ],
      statements: (writer) => {
        writer.writeLine(`super(new ${clientInterfaceName}(address, credentials, options));`);
      },
    });

    _.forEach(Array.from(clientMethods.entries()), ([name, method]) => {
      const requestType = method.getParameter('request')?.getType()?.getText();
      const callbackTypeNode = method.getParameter('callback')?.getTypeNode();

      if (!requestType || !Node.isFunctionTypeNode(callbackTypeNode)) {
        return;
      }

      const responseType = callbackTypeNode.getParameter('response')?.getType()?.getText();

      if (!responseType) {
        return;
      }

      repositoryClass.addMethod({
        name,
        parameters: [
          {
            name: 'request',
            type: requestType,
          },
          {
            name: 'metadata',
            type: 'Metadata',
            initializer: 'new Metadata()',
          },
          {
            name: 'options',
            type: 'Partial<CallOptions>',
            initializer: '{}',
          },
        ],
        returnType: `Promise<${responseType}>`,
        statements: (writer) => {
          writer.writeLine(
            `return this.exec<${requestType}, ${responseType}>("${name}", request, metadata, options);`,
          );
        },
      });
    });

    return repositoryClass;
  }

  canTransform(): boolean | Promise<boolean> {
    return !(!this.contextData.services.length || !this.contextData.packageId);
  }

  transform(): void | Promise<void> {
    this.declareImports();

    _.forEach(this.contextData.services, (service) => this.declareRepository(service));
  }
}
