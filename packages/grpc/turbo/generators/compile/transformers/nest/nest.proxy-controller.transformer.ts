import { camelCase, constantCase, pascalCase } from 'change-case-all';
import {
  InterfaceDeclaration,
  MethodSignature,
  OptionalKind,
  PropertySignatureStructure,
  VariableDeclarationKind,
} from 'ts-morph';
import { BaseTransformer } from '../base.transformer';

type Names = {
  client: string;
  controller: string;
  packageNameConst: string;
  serviceNameConst: string;
  dtoSchemaInterface: string;
  controllerFactory: string;
  controllerClass: string;
  controllerDecorator: string;
};

export class NestProxyControllerTransformer extends BaseTransformer {
  private names: Names;
  private controllerMethods: MethodSignature[] = [];
  private controllerInterface: InterfaceDeclaration;
  private clientInterface: InterfaceDeclaration;

  private packageNameValue: string;
  private serviceNameValue: string;

  private getNames(): Names {
    return {
      client: pascalCase(`${this.fileId}.service.client`),
      controller: pascalCase(`${this.fileId}.service.controller`),
      packageNameConst: constantCase(`${this.fileId}.package.name`),
      serviceNameConst: constantCase(`${this.fileId}.service.name`),
      dtoSchemaInterface: pascalCase(`grpc.${this.fileId}.dto.schema`),
      controllerFactory: camelCase(`grpc.${this.fileId}.proxy.controller.factory`),
      controllerClass: pascalCase(`grpc.${this.fileId}.proxy.controller`),
      controllerDecorator: pascalCase(`${this.fileId}.service.controller.methods`),
    };
  }

  private declareImports() {
    this.addOrUpdateImport('@grpc/grpc-js', ['Metadata']);
    this.addOrUpdateImport('@nestjs/common', ['Type']);
    this.addOrUpdateImport('@nestjs/microservices', ['ClientGrpc']);
    this.addOrUpdateImport('rxjs', ['Observable', 'OperatorFunction']);

    this.addOrUpdateImport(this.importFromCompilerPath, [
      'GrpcProxyControllerFactoryParams',
      'GrpcProxyControllerFactoryResult',
    ]);
  }

  private declareInterfaces() {
    return this.sourceFile.addInterface({
      name: this.names.dtoSchemaInterface,
      properties: this.controllerMethods.reduce(
        (acc: OptionalKind<PropertySignatureStructure>[], method: MethodSignature) => {
          const name = method.getName();
          const firstArgument = method.getParameter('request');

          if (!firstArgument) {
            return acc;
          }

          const type = firstArgument.getType();
          acc.push({ name, type: `Type<${type.getText()}>` });
          return acc;
        },
        [],
      ),
    });
  }

  private declareFactory() {
    return this.sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      isExported: true,
      declarations: [
        {
          name: this.names.controllerFactory,
          initializer: (writer) => {
            writer
              .write(
                `(params: GrpcProxyControllerFactoryParams<${this.names.dtoSchemaInterface}>): GrpcProxyControllerFactoryResult => `,
              )
              .inlineBlock(() => {
                writer
                  .writeLine(
                    'const { GrpcController, ValidateGrpcPayload, InjectGrpcService, dtoSchema, proxyPipes } = params;',
                  )
                  .blankLine()
                  .writeLine('@GrpcController()')
                  .writeLine(`@${this.names.controllerDecorator}()`)
                  .write(`class ${this.names.controllerClass}`)
                  .inlineBlock(() => {
                    writer.write(
                      `constructor(@InjectGrpcService(${this.names.serviceNameConst}) private readonly client: ${this.clientInterface.getName()}) {}`,
                    );

                    this.controllerMethods.forEach((method) => {
                      const methodName = method.getName();
                      const firstArgument = method.getParameter('request');
                      const returnType = method.getReturnType();

                      if (!firstArgument) {
                        return;
                      }

                      const firstArgumentType = firstArgument.getType();

                      writer
                        .blankLineIfLastNot()
                        .writeLine(`@ValidateGrpcPayload(dtoSchema.${methodName})`)
                        .write(
                          `${methodName}(request: ${firstArgumentType.getText()}, metadata?: Metadata): ${returnType.getText()}`,
                        )
                        .inlineBlock(() => {
                          writer
                            .writeLine('//@ts-ignore')
                            .writeLine(
                              `return this.client.${methodName}(request).pipe(...proxyPipes);`,
                            );
                        });
                    });
                  })
                  .blankLine()
                  .write('return ')
                  .inlineBlock(() => {
                    writer.writeLine(`Controller: ${this.names.controllerClass},`);
                    writer.writeLine(`service: ${this.serviceNameValue},`);
                  })
                  .write(';');
              });
          },
        },
      ],
    });
  }

  protected onInit(): void {
    this.names = this.getNames();
  }

  canTransform(): boolean | Promise<boolean> {
    this.controllerInterface = this.sourceFile.getInterface(this.names.controller);
    this.clientInterface = this.sourceFile.getInterface(this.names.client);

    this.serviceNameValue = this.sourceFile
      .getVariableDeclaration(this.names.serviceNameConst)
      ?.getInitializer()
      ?.getText();

    this.packageNameValue = this.sourceFile
      .getVariableDeclaration(this.names.packageNameConst)
      ?.getInitializer()
      ?.getText();

    return !!(
      this.controllerInterface &&
      this.clientInterface &&
      this.serviceNameValue &&
      this.packageNameValue
    );
  }

  transform(): void | Promise<void> {
    this.controllerMethods = this.controllerInterface.getMethods();

    this.declareImports();
    this.declareInterfaces();
    this.declareFactory();
  }
}
