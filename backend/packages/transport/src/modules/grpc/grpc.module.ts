import { DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientGrpc, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices';
import { grpcConfig, GrpcConfig, GrpcHost } from 'configs';
import { getGrpcClientToken, getGrpcServiceToken } from 'helpers';
import _ from 'lodash';
import { GRPC_CONFIG_SERVICE, MICROSERVICE_GRPC_OPTIONS } from 'modules/grpc/grpc.constants';

type GrpcServiceDefinition = {
  package: string;
  protoPath: string;
};

export type GrpcModuleForFeatureParams = {
  strategy: {
    [Host in GrpcHost]?: (keyof GrpcConfig[Host]['services'])[];
  };
};

export type GrpcModuleForRootParams = {
  host?: GrpcHost;
  appClientStrategy?: GrpcModuleForFeatureParams['strategy'];
};

export class GrpcModule {
  private static getServiceDefinitions(hostConfig: GrpcConfig[GrpcHost], services: string[]) {
    const result = _.reduce(
      services,
      (acc: { package: Set<string>; protoPath: Set<string> }, service) => {
        const definition: GrpcServiceDefinition = hostConfig.services[service];

        acc.package.add(definition.package);
        acc.protoPath.add(definition.protoPath);
        return acc;
      },
      {
        package: new Set<string>(),
        protoPath: new Set<string>(),
      },
    );

    return {
      package: Array.from(result.package),
      protoPath: Array.from(result.protoPath),
    };
  }

  private static getClientParams(strategy: GrpcModuleForFeatureParams['strategy']) {
    const clients: ClientsProviderAsyncOptions[] = [];
    const providers: Provider[] = [];
    const exports: DynamicModule['exports'] = [ClientsModule];

    for (const [clientName, services] of _.entries(strategy)) {
      const clientToken = getGrpcClientToken(clientName);

      clients.push({
        inject: [GRPC_CONFIG_SERVICE],
        name: clientToken,
        useFactory: (configService: ConfigService) => {
          const hostConfig: GrpcConfig[GrpcHost] = configService.getOrThrow(clientName);
          const serviceDefinitions = this.getServiceDefinitions(hostConfig, services);

          return _.merge(_.omit(hostConfig, ['services']), { options: serviceDefinitions });
        },
      });

      _.forEach(services, (service) => {
        const serviceToken = getGrpcServiceToken(service);

        providers.push({
          provide: serviceToken,
          inject: [clientToken],
          useFactory: (client: ClientGrpc) => client.getService(service),
        });

        exports.push(serviceToken);
      });
    }

    return { clients, providers, exports };
  }

  static forRoot(params: GrpcModuleForRootParams = {}): DynamicModule {
    const imports: DynamicModule['imports'] = [ConfigModule.forFeature(grpcConfig)];

    const providers: Provider[] = [
      {
        provide: GRPC_CONFIG_SERVICE,
        useClass: ConfigService,
      },
    ];

    const exports: DynamicModule['exports'] = [GRPC_CONFIG_SERVICE];

    if (params.host) {
      providers.push({
        provide: MICROSERVICE_GRPC_OPTIONS,
        inject: [GRPC_CONFIG_SERVICE],
        useFactory: (configService: ConfigService<GrpcConfig>) => {
          const hostConfig = configService.getOrThrow(params.host, { infer: true });

          const serviceDefinitions = this.getServiceDefinitions(
            hostConfig,
            _.keys(hostConfig.services),
          );

          return _.merge(_.omit(hostConfig, ['services']), { options: serviceDefinitions });
        },
      });

      exports.push(MICROSERVICE_GRPC_OPTIONS);
    }

    if (params.appClientStrategy) {
      const clientParams = this.getClientParams(params.appClientStrategy);

      providers.push(...clientParams.providers);
      exports.push(...clientParams.exports);
      imports.push(ClientsModule.registerAsync({ clients: clientParams.clients }));
    }

    return {
      imports,
      providers,
      exports,
      module: GrpcModule,
      global: true,
    };
  }

  static forFeature(params: GrpcModuleForFeatureParams): DynamicModule {
    const { clients, providers, exports } = this.getClientParams(params.strategy);

    return {
      imports: [ClientsModule.registerAsync({ clients })],
      providers,
      exports,
      module: GrpcModule,
    };
  }
}
