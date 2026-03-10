import { DynamicModule, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc, ClientsModule, ClientsProviderAsyncOptions } from '@nestjs/microservices';
import { GrpcConfig, GrpcConfigHost } from 'grpc/grpc.config';
import { GRPC_CONFIG_SERVICE } from 'grpc/grpc.constants';
import { GrpcStrategy } from 'grpc/grpc.types';
import { getGrpcClientToken, getGrpcServiceToken, getServiceDefinitions } from 'grpc/helpers';
import _ from 'lodash';

export class GrpcClientRegistry {
  private readonly strategy = new Map<GrpcConfigHost, Set<string>>();

  constructor(strategy?: GrpcStrategy) {
    if (strategy) {
      this.append(strategy);
    }
  }

  append(strategy: GrpcStrategy) {
    _.forEach(_.entries(strategy), ([key, values]) => {
      if (!values?.length) {
        return;
      }

      const host = key as GrpcConfigHost;
      const services = this.strategy.get(host);

      if (!services) {
        this.strategy.set(host, new Set(values));
        return;
      }

      _.forEach(values, (value) => {
        services.add(value);
      });
    });
  }

  getStrategy() {
    return this.strategy;
  }

  getClients() {
    const imports: DynamicModule['imports'] = [];
    const clients: ClientsProviderAsyncOptions[] = [];
    const providers: Provider[] = [];
    const clientTokens: DynamicModule['exports'] = [];
    const exports: DynamicModule['exports'] = [];

    for (const [clientName, services] of this.strategy.entries()) {
      if (!services?.size) {
        continue;
      }

      const clientToken = getGrpcClientToken(clientName);

      clients.push({
        inject: [GRPC_CONFIG_SERVICE],
        name: clientToken,
        useFactory: (configService: ConfigService) => {
          const hostConfig: GrpcConfig[GrpcConfigHost] = configService.getOrThrow(clientName);
          const serviceDefinitions = getServiceDefinitions(hostConfig, Array.from(services));

          return _.merge(_.omit(hostConfig, ['services']), { options: serviceDefinitions });
        },
      });
    }

    if (clients.length) {
      const clientsModule = ClientsModule.registerAsync({ clients });

      imports.push(clientsModule);
      exports.push(clientsModule);
    }

    exports.push(...clientTokens);

    return { imports, providers, exports };
  }

  getServices() {
    const providers: Provider[] = [];
    const exports: DynamicModule['exports'] = [];

    for (const [clientName, services] of this.strategy.entries()) {
      if (!services?.size) {
        continue;
      }

      const clientToken = getGrpcClientToken(clientName);

      services.forEach((service) => {
        const serviceToken = getGrpcServiceToken(service);

        providers.push({
          provide: serviceToken,
          inject: [clientToken],
          useFactory: (client: ClientGrpc): Type => client.getService(service),
        });

        exports.push(serviceToken);
      });
    }

    return { providers, exports };
  }
}
