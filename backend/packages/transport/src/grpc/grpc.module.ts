import { DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { grpcConfig, GrpcConfig, GrpcConfigHost } from 'grpc/grpc.config';
import { GrpcStrategy } from 'grpc/grpc.types';
import { getServiceDefinitions } from 'grpc/helpers';
import { GrpcClientRegistry } from 'grpc/utils';
import _ from 'lodash';
import { GRPC_CONFIG_SERVICE, GRPC_MICROSERVICE_OPTIONS } from 'grpc/grpc.constants';

export type GrpcModuleForFeatureParams = {
  strategy: GrpcStrategy;
};

export type GrpcModuleForRootParams = {
  host?: GrpcConfigHost;
  appClientStrategy?: GrpcStrategy;
};

const globalClientRegistry = new GrpcClientRegistry();

export class GrpcModule {
  static forRoot(params: GrpcModuleForRootParams = {}): DynamicModule {
    if (params.appClientStrategy) {
      globalClientRegistry.append(params.appClientStrategy);
    }

    const clientParams = globalClientRegistry.getClients();

    const imports: DynamicModule['imports'] = [
      ConfigModule.forFeature(grpcConfig),
      ...clientParams.imports,
    ];

    const providers: Provider[] = [
      {
        provide: GRPC_CONFIG_SERVICE,
        useClass: ConfigService,
      },
      ...clientParams.providers,
    ];

    const exports: DynamicModule['exports'] = [GRPC_CONFIG_SERVICE, ...clientParams.exports];

    if (params.host) {
      providers.push({
        provide: GRPC_MICROSERVICE_OPTIONS,
        inject: [GRPC_CONFIG_SERVICE],
        useFactory: (configService: ConfigService<GrpcConfig>) => {
          const hostConfig = configService.getOrThrow(params.host, { infer: true });
          const serviceDefinitions = getServiceDefinitions(hostConfig, _.keys(hostConfig.services));

          return _.merge(_.omit(hostConfig, ['services']), { options: serviceDefinitions });
        },
      });

      exports.push(GRPC_MICROSERVICE_OPTIONS);
    }

    if (params.appClientStrategy) {
      const localClientRegistry = new GrpcClientRegistry(params.appClientStrategy);
      const serviceParams = localClientRegistry.getServices();

      providers.push(...serviceParams.providers);
      exports.push(...serviceParams.exports);
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
    globalClientRegistry.append(params.strategy);

    const localClientRegistry = new GrpcClientRegistry(params.strategy);
    const { providers, exports } = localClientRegistry.getServices();

    return {
      imports: [ClientsModule],
      providers,
      exports,
      module: GrpcModule,
    };
  }
}
