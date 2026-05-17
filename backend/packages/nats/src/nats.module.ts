import { EventBus, EventBusHost } from '@backend/event-bus';
import {
  NatsJetStreamClientProxy,
  NatsJetStreamServer,
  NatsJetStreamTransport,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Abstract, DynamicModule, Provider, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsClientFactory } from './generated';
import { NATS_CONFIG_SERVICE, NATS_MICROSERVICE_OPTIONS } from './infrastructure';
import { NatsConfig, natsConfig } from './infrastructure/configs';
import { globalStreamRegistry } from './infrastructure/utils';

type NatsModuleForRootParams = {
  host: EventBusHost;
  onlyEmitting?: boolean;
};

type NatsModuleForFeatureParams = {
  EventBus: Abstract<EventBus>;
};

export class NatsModule {
  static forRoot(params: NatsModuleForRootParams): DynamicModule {
    const providers: Provider[] = [
      {
        provide: NATS_CONFIG_SERVICE,
        useClass: ConfigService,
      },
    ];

    const exports: DynamicModule['exports'] = [NATS_CONFIG_SERVICE, NatsJetStreamClientProxy];

    if (!params.onlyEmitting) {
      providers.push({
        provide: NATS_MICROSERVICE_OPTIONS,
        inject: [NATS_CONFIG_SERVICE],
        useFactory: (configService: ConfigService<NatsConfig>): CustomStrategy => {
          const options = configService.getOrThrow('getServerOptions', { infer: true })(
            params.host,
            globalStreamRegistry.getStreams(),
          );

          return {
            strategy: new NatsJetStreamServer(options),
          };
        },
      });

      exports.push(NATS_MICROSERVICE_OPTIONS);
    }

    return {
      imports: [
        ConfigModule.forFeature(natsConfig),
        NatsJetStreamTransport.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<NatsConfig>) => {
            return configService.getOrThrow('getClientOptions', { infer: true })(params.host);
          },
        }),
      ],
      providers,
      exports,
      global: true,
      module: NatsModule,
    };
  }

  static forFeature(params: NatsModuleForFeatureParams): DynamicModule {
    return {
      module: NatsModule,
      providers: [
        {
          provide: params.EventBus,
          inject: [NatsJetStreamClientProxy],
          useFactory: (client: NatsJetStreamClientProxy): Type => {
            return NatsClientFactory.create(client, params.EventBus);
          },
        },
      ],
      exports: [params.EventBus],
    };
  }
}
