import { EventBus, EventBusHost } from '@backend/event-bus';
import { Abstract, DynamicModule, Provider, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CustomStrategy } from '@nestjs/microservices';
import { NATS_HOST_STREAMS, NatsClientFactory } from '@/generated';
import {
  globalConsumerRegistry,
  globalStreamRegistry,
  NatsConfig,
  natsConfig,
  NatsConnectionService,
  NatsJetStreamClient,
  NatsStreamProvisionerService,
  NATS_CLIENT,
  NATS_CONNECTION,
  NATS_MICROSERVICE_OPTIONS,
  NATS_STREAM_PROVISIONER,
} from '@/infrastructure';
import { NatsEventBusServer } from '@/interface';

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
        provide: NATS_CLIENT,
        inject: [NATS_CONNECTION],
        useFactory: (connectionService: NatsConnectionService): NatsJetStreamClient => {
          return new NatsJetStreamClient(connectionService);
        },
      },
      {
        // Owned streams are declared even in `onlyEmitting` mode — nobody else owns them.
        // This is the slot the Redis mediator occupies; JetStream needs no fan-out stage.
        provide: NATS_STREAM_PROVISIONER,
        inject: [NATS_CONNECTION, natsConfig.KEY],
        useFactory: (
          connectionService: NatsConnectionService,
          config: NatsConfig,
        ): NatsStreamProvisionerService => {
          return new NatsStreamProvisionerService({
            connectionService,
            streams: [...(NATS_HOST_STREAMS[params.host] ?? [])],
            getStreamConfig: config.getStreamConfig,
          });
        },
      },
    ];

    // `natsConfig.KEY` is not exported: it belongs to the imported `ConfigModule.forFeature`,
    // not to this module, and Nest refuses to re-export a provider it does not own.
    const exports: DynamicModule['exports'] = [NATS_CLIENT];

    if (!params.onlyEmitting) {
      providers.push({
        provide: NATS_MICROSERVICE_OPTIONS,
        inject: [NATS_CONNECTION, NATS_STREAM_PROVISIONER, natsConfig.KEY],
        useFactory: (
          connectionService: NatsConnectionService,
          provisioner: NatsStreamProvisionerService,
          config: NatsConfig,
        ): CustomStrategy => {
          return {
            strategy: new NatsEventBusServer({
              connectionService,
              provisioner,
              registry: globalConsumerRegistry,
              streams: globalStreamRegistry.getStreams(),
              getConsumerConfig: config.getConsumerConfig,
            }),
          };
        },
      });

      exports.push(NATS_MICROSERVICE_OPTIONS);
    }

    // Registered last on purpose: Nest runs the shutdown hooks in provider order, so the
    // shared connection is drained only after the consumers above are stopped.
    providers.push({
      provide: NATS_CONNECTION,
      inject: [natsConfig.KEY],
      useFactory: (config: NatsConfig): Promise<NatsConnectionService> => {
        return NatsConnectionService.create(config.getConnectionOptions(params.host));
      },
    });

    exports.push(NATS_CONNECTION);

    return {
      imports: [ConfigModule.forFeature(natsConfig)],
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
          inject: [NATS_CLIENT],
          useFactory: (client: NatsJetStreamClient): Type => {
            return NatsClientFactory.create(client, params.EventBus);
          },
        },
      ],
      exports: [params.EventBus],
    };
  }
}
