import { constantCase, pascalCase } from 'change-case-all';
import * as _ from 'lodash';
import {
  MethodSignature,
  OptionalKind,
  PropertySignatureStructure,
  VariableDeclarationKind,
} from 'ts-morph';
import { ServiceData } from '../../context';
import { BaseTransformer } from '../base.transformer';

type Names = {
  client: string;
  controller: string;
  serviceNameConst: string;
  proxyMethodParams: string;
  controllerClass: string;
  controllerDecorator: string;
  schema: string;
};

export class NestServiceSchemaTransformer extends BaseTransformer {
  private packageName: string;

  private getNames(service: ServiceData): Names {
    return {
      client: pascalCase(`grpc.${service.name}.client`),
      controller: pascalCase(`grpc.${service.name}.controller`),
      serviceNameConst: constantCase(`${service.name}.name`),
      proxyMethodParams: pascalCase(`grpc.${service.id}.proxy.method.params`),
      controllerClass: pascalCase(`grpc.${service.id}.proxy.controller`),
      controllerDecorator: pascalCase(`${service.name}.controller.methods`),
      schema: pascalCase(`grpc.${service.name}`),
    };
  }

  private declareImports() {
    this.addOrUpdateImport('path', ['join']);
    this.addOrUpdateImport('@grpc/grpc-js', ['Metadata']);
    this.addOrUpdateImport('@nestjs/common', ['Type']);
    this.addOrUpdateImport('@nestjs/microservices', ['ClientGrpc']);
    this.addOrUpdateImport('rxjs', ['Observable', 'OperatorFunction']);

    this.addOrUpdateImport(this.importFromCompilerPath, [
      'GrpcProxyControllerFactoryParams',
      'GrpcProxyControllerFactoryResult',
      'GrpcProxyControllerFactory',
      'GrpcProxyMethodParams',
      'PROTO_PATH',
    ]);
  }

  private declareInterfaces(names: Names, controllerMethods: MethodSignature[]) {
    return this.sourceFile.addInterface({
      name: names.proxyMethodParams,
      properties: controllerMethods.reduce(
        (acc: OptionalKind<PropertySignatureStructure>[], method: MethodSignature) => {
          const name = method.getName();
          const firstArgument = method.getParameter('request');

          if (!firstArgument) {
            return acc;
          }

          const type = firstArgument.getType();

          acc.push({
            name,
            type: `GrpcProxyMethodParams<${type.getText()}>`,
            hasQuestionToken: true,
          });

          return acc;
        },
        [],
      ),
    });
  }

  private declareFactory(
    names: Names,
    controllerMethods: MethodSignature[],
    serviceNameValue: string,
  ) {
    return this.sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      isExported: true,
      declarations: [
        {
          name: names.schema,
          initializer: (writer) => {
            writer
              .inlineBlock(() => {
                writer
                  .writeLine(`name: ${serviceNameValue},`)
                  .write(`definition: `)
                  .inlineBlock(() => {
                    writer
                      .writeLine(`package: ${this.packageName},`)
                      .writeLine(`protoPath: join(PROTO_PATH, '${this.contextData.protoPath}'),`);
                  })
                  .write(',')
                  .writeLine(
                    `proxyFactory: (methodParams: ${names.proxyMethodParams} = {}): GrpcProxyControllerFactory => `,
                  )
                  .inlineBlock(() => {
                    writer
                      .writeLine(
                        'return (controllerParams: GrpcProxyControllerFactoryParams): GrpcProxyControllerFactoryResult => ',
                      )
                      .inlineBlock(() => {
                        writer
                          .writeLine(
                            'const { GrpcController, GrpcMethod, InjectGrpcService, proxyPipes } = controllerParams;',
                          )
                          .blankLine()
                          .writeLine('@GrpcController()')
                          .writeLine(`@${names.controllerDecorator}()`)
                          .write(`class ${names.controllerClass}`)
                          .inlineBlock(() => {
                            writer.write(
                              `constructor(@InjectGrpcService(${names.serviceNameConst}) private readonly client: ${names.client}) {}`,
                            );

                            controllerMethods.forEach((method) => {
                              const methodName = method.getName();
                              const firstArgument = method.getParameter('request');
                              const returnType = method.getReturnType();

                              if (!firstArgument) {
                                return;
                              }

                              const firstArgumentType = firstArgument.getType();

                              writer
                                .blankLineIfLastNot()
                                .writeLine(`@GrpcMethod(methodParams.${methodName})`)
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
                            writer.writeLine(`Controller: ${names.controllerClass},`);
                            writer.writeLine(`service: ${serviceNameValue},`);
                          })
                          .write(';');
                      });
                  })
                  .write(',')
                  .writeLine(
                    `ControllerMethods: (): ClassDecorator => ${names.controllerDecorator}(),`,
                  );
              })
              .write(' as const');
          },
        },
      ],
    });
  }

  protected onInit() {
    this.packageName = this.getPackageNameValue();
  }

  canTransform(): boolean | Promise<boolean> {
    return !!(this.contextData.services.length && this.contextData.packageId);
  }

  transform(): void | Promise<void> {
    if (!this.packageName) {
      return;
    }

    this.declareImports();

    _.forEach(this.contextData.services, (service) => {
      const names = this.getNames(service);

      const controllerInterface = this.sourceFile.getInterface(names.controller);
      const clientInterface = this.sourceFile.getInterface(names.client);

      const serviceNameValue = this.sourceFile
        .getVariableDeclaration(names.serviceNameConst)
        ?.getInitializer()
        ?.getText();

      if (!controllerInterface || !clientInterface || !serviceNameValue) {
        return;
      }

      const controllerMethods = controllerInterface.getMethods();

      this.declareInterfaces(names, controllerMethods);
      this.declareFactory(names, controllerMethods, serviceNameValue);
    });
  }
}
