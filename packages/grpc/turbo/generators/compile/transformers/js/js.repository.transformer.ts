import { pascalCase } from 'change-case-all';
import * as _ from 'lodash';
import { InterfaceDeclaration, MethodSignature, Node } from 'ts-morph';
import { BaseTransformer } from '../base.transformer';

type Names = {
  clientInterface: string;
  repositoryClass: string;
};

export class JsRepositoryTransformer extends BaseTransformer {
  private names: Names;
  private readonly clientMethods = new Map<string, MethodSignature>();
  private clientInterface: InterfaceDeclaration;

  private getNames(): Names {
    return {
      clientInterface: pascalCase(`${this.fileId}.service.client`),
      repositoryClass: pascalCase(`${this.fileId}.grpc.repository`),
    };
  }

  private declareImports() {
    this.addOrUpdateImport('@grpc/grpc-js', ['CallOptions', 'Metadata', 'MetadataOptions']);

    this.addOrUpdateImport(this.importFromCompilerPath, ['GrpcRepository']);
  }

  private declareRepository() {
    const repositoryClass = this.sourceFile.addClass({
      name: this.names.repositoryClass,
      isExported: true,
      extends: `GrpcRepository<${this.names.clientInterface}>`,
    });

    _.forEach(Array.from(this.clientMethods.entries()), ([name, method]) => {
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
            name: 'metadataOptions',
            type: 'MetadataOptions',
            initializer: '{}',
          },
          {
            name: 'options',
            type: 'Partial<CallOptions>',
            initializer: '{}',
          },
        ],
        returnType: `Promise<${responseType}>`,
        statements: (writer) => {
          // writer
          //   .writeLine(`return new Promise<${responseType}>((resolve, reject) => `)
          //   .inlineBlock(() => {
          //     writer
          //       .writeLine(
          //         `this.client.${name}(req, new Metadata(metadataOptions), options, (err, response) => `,
          //       )
          //       .inlineBlock(() => {
          //         writer
          //           .writeLine('if (err) ')
          //           .inlineBlock(() => {
          //             writer.writeLine('reject(err);');
          //           })
          //           .blankLine()
          //           .writeLine('resolve(response);');
          //       })
          //       .write(');');
          //   })
          //   .write(');');

          writer.writeLine(
            `return this.exec<${requestType}, ${responseType}>("${name}", request, metadataOptions, options);`,
          );
        },
      });
    });

    return repositoryClass;
  }

  protected onInit(): void {
    this.names = this.getNames();
  }

  canTransform(): boolean | Promise<boolean> {
    this.clientInterface = this.sourceFile.getInterface(this.names.clientInterface);

    return !!this.clientInterface;
  }

  transform(): void | Promise<void> {
    for (const method of this.clientInterface.getMethods()) {
      const name = method.getName();

      if (!this.clientMethods.has(name)) {
        this.clientMethods.set(name, method);
      }
    }

    this.declareImports();
    this.declareRepository();
  }
}
