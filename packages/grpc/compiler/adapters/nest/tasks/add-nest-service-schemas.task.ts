import { constantCase, pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';
import { ProtoContextService } from 'compiler/types';
import {
  CodeBlockWriter,
  MethodSignature,
  OptionalKind,
  PropertySignatureStructure,
  SyntaxKind,
  VariableDeclarationKind,
} from 'ts-morph';

type Names = {
  client: string;
  controller: string;
  serviceNameConst: string;
  proxyMethodParams: string;
  controllerClass: string;
  controllerDecorator: string;
  schema: string;
};

type MethodDefinition = {
  requestType: string;
  returnType: string;
};

type StreamMethodDefinition = {
  streamType: string;
  requestType: string;
  returnType: string;
};

type MethodTypes = {
  unaryMethodsMap: Map<string, MethodDefinition>;
  streamMethodsMap: Map<string, StreamMethodDefinition>;
};

export class AddNestServiceSchemasTask extends TransformTask {
  private packageName: string | undefined;

  private getNames(service: ProtoContextService): Names {
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

  private declareInterface(names: Names, controllerMethods: MethodSignature[]): MethodTypes {
    const unaryMethodsMap = new Map<string, MethodDefinition>();
    const streamMethodsMap = new Map<string, StreamMethodDefinition>();

    this.sourceFile.addInterface({
      name: names.proxyMethodParams,
      properties: controllerMethods.reduce(
        (acc: OptionalKind<PropertySignatureStructure>[], method: MethodSignature) => {
          const name = method.getName();
          const firstArgument = method.getParameter('request');
          const returnType = method.getReturnType()?.getText();

          if (!firstArgument || !returnType) {
            return acc;
          }

          const typeNode = firstArgument.getTypeNode();

          if (typeNode && typeNode.isKind(SyntaxKind.TypeReference)) {
            const [streamType] = typeNode.getTypeArguments() ?? [];

            if (streamType) {
              const requestType = streamType.getText();

              streamMethodsMap.set(name, {
                streamType: requestType,
                returnType,
                requestType: firstArgument.getType().getText(),
              });

              acc.push({
                name,
                type: 'GrpcProxyStreamMethodParams',
                hasQuestionToken: true,
              });

              return acc;
            }
          }

          const requestType = firstArgument.getType().getText();

          unaryMethodsMap.set(name, { requestType, returnType });

          acc.push({
            name,
            type: `GrpcProxyMethodParams<${requestType}>`,
            hasQuestionToken: true,
          });

          return acc;
        },
        [],
      ),
    });

    return { unaryMethodsMap, streamMethodsMap };
  }

  private renderUnaryMethod(
    writer: CodeBlockWriter,
    methodName: string,
    definition: MethodDefinition,
  ): void {
    writer
      .blankLineIfLastNot()
      .writeLine(`@GrpcMethod(methodParams.${methodName})`)
      .write(
        `${methodName}(request: ${definition.requestType}, metadata?: Metadata): ${definition.returnType}`,
      )
      .inlineBlock(() => {
        writer
          .writeLine('//@ts-ignore')
          .writeLine(
            `return this.client.${methodName}(request, metadata?.clone()).pipe(...proxyPipes);`,
          );
      });
  }

  private renderStreamMethod(
    writer: CodeBlockWriter,
    methodName: string,
    definition: StreamMethodDefinition,
  ): void {
    writer
      .blankLineIfLastNot()
      .writeLine(`@GrpcStreamMethod(methodParams.${methodName})`)
      .write(
        `${methodName}(request: ${definition.requestType}, metadata?: Metadata): ${definition.returnType}`,
      )
      .inlineBlock(() => {
        writer
          .writeLine(`if (methodParams.${methodName}?.allowedRoles) `)
          .inlineBlock(() => {
            writer
              .writeLine(`const proxy$ = new ReplaySubject<${definition.streamType}>();`)
              .writeLine('const subscription = request.subscribe(proxy$);')
              .blankLine()
              .writeLine(
                `return this.accessService.checkAccess(metadata, methodParams.${methodName}.allowedRoles).pipe(`,
              )
              .indent(() => {
                writer
                  .writeLine('map((meta) => ')
                  .inlineBlock(() => {
                    writer
                      .writeLine(`if (meta.isLeft()) `)
                      .inlineBlock(() => {
                        writer.writeLine('throw meta.value;');
                      })
                      .blankLine()
                      .writeLine('return meta.value;');
                  })
                  .write('),')
                  .writeLine('catchError((err) => ')
                  .inlineBlock(() => {
                    writer.writeLine('proxy$.error(err);').writeLine('throw err;');
                  })
                  .write('),')
                  .writeLine(
                    `switchMap((meta) => this.client.${methodName}(proxy$.asObservable(), meta)),`,
                  )
                  .writeLine(
                    'catchError((exception) => throwError(() => new RpcException(exception))),',
                  )
                  .writeLine('finalize(() => subscription.unsubscribe()),');
              })
              .writeLine(');');
          })
          .blankLine()
          .writeLine('//@ts-ignore')
          .writeLine(
            `return this.client.${methodName}(request, metadata?.clone()).pipe(...proxyPipes);`,
          );
      });
  }

  private renderConstructor(writer: CodeBlockWriter, names: Names, methodTypes: MethodTypes): void {
    if (methodTypes.streamMethodsMap.size) {
      writer
        .write('constructor(')
        .indent(() => {
          writer
            .writeLine(
              '@Inject(GRPC_ACCESS_SERVICE) private readonly accessService: GrpcAccessService,',
            )
            .writeLine(
              `@InjectGrpcService(${names.serviceNameConst}) private readonly client: ${names.client},`,
            );
        })
        .writeLine(') {}');

      return;
    }

    writer.writeLine(
      `constructor(@InjectGrpcService(${names.serviceNameConst}) private readonly client: ${names.client}) {}`,
    );
  }

  private declareSchema(names: Names, methodTypes: MethodTypes, serviceNameValue: string) {
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
                      .writeLine(`protoPath: join(PROTO_PATH, '${this.protoContext.protoPath}'),`);
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
                            'const { GrpcController, GrpcMethod, GrpcStreamMethod, InjectGrpcService, proxyPipes } = controllerParams;',
                          )
                          .blankLine()
                          .writeLine('@GrpcController()')
                          .writeLine(`@${names.controllerDecorator}()`)
                          .write(`class ${names.controllerClass}`)
                          .inlineBlock(() => {
                            this.renderConstructor(writer, names, methodTypes);

                            Array.from(methodTypes.unaryMethodsMap.entries()).forEach(
                              ([methodName, definition]) => {
                                this.renderUnaryMethod(writer, methodName, definition);
                              },
                            );

                            Array.from(methodTypes.streamMethodsMap.entries()).forEach(
                              ([methodName, definition]) => {
                                this.renderStreamMethod(writer, methodName, definition);
                              },
                            );
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
    return !!(this.protoContext.services.length && this.protoContext.packageId);
  }

  transform(): void | Promise<void> {
    if (!this.packageName) {
      return;
    }

    this.declareImports();

    this.protoContext.services.forEach((service) => {
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
      const methodTypes = this.declareInterface(names, controllerMethods);
      this.declareSchema(names, methodTypes, serviceNameValue);
    });
  }
}
