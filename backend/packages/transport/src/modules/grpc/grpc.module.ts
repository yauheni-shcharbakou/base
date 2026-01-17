import { DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientGrpc, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices';
import { grpcConfig, GrpcConfig, GrpcConfigServiceDefinition, GrpcHost } from 'configs';
import { getGrpcClientToken, getGrpcServiceToken } from 'helpers';
import _ from 'lodash';
import { GRPC_CONFIG_SERVICE, MICROSERVICE_GRPC_OPTIONS } from 'modules/grpc/grpc.constants';

export type GrpcModuleForRootParams = {
  host?: GrpcHost;
};

export type GrpcModuleForFeatureParams = {
  strategy: {
    [Host in GrpcHost]?: (keyof GrpcConfig[Host]['services'])[];
  };
};

export class GrpcModule {
  private static getServiceDefinitions(hostConfig: GrpcConfig[GrpcHost], services: string[]) {
    return _.reduce(
      services,
      (acc: { package: string[]; protoPath: string[] }, service) => {
        const definition: GrpcConfigServiceDefinition = hostConfig.services[service];

        acc.package.push(definition.package);
        acc.protoPath.push(definition.protoPath);
        return acc;
      },
      { package: [], protoPath: [] },
    );
  }

  static forRoot(params: GrpcModuleForRootParams = {}): DynamicModule {
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

    return {
      imports: [ConfigModule.forFeature(grpcConfig)],
      providers,
      exports,
      module: GrpcModule,
      global: true,
    };
  }

  static forFeature(params: GrpcModuleForFeatureParams): DynamicModule {
    const clients: ClientsProviderAsyncOptions[] = [];
    const providers: Provider[] = [];
    const exports: DynamicModule['exports'] = [ClientsModule];

    for (const [clientName, services] of _.entries(params.strategy)) {
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

    return {
      imports: [ClientsModule.registerAsync({ clients })],
      providers,
      exports,
      module: GrpcModule,
    };
  }
}
