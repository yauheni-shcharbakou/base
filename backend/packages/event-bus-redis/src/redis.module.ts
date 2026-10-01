import { EventBus, EventBusHost } from '@backend/event-bus';
import { Abstract, DynamicModule, Provider, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CustomStrategy } from '@nestjs/microservices';
import { REDIS_HOST_EVENTS, RedisClientFactory } from '@/generated';
import {
  globalQueueRegistry,
  RedisConfig,
  redisConfig,
  RedisConnectionService,
  RedisMediatorService,
  RedisParkingService,
  RedisQueueClient,
  RedisSubscriptionRegistry,
  RedisTopologyReporter,
  REDIS_CLIENT,
  REDIS_CONNECTION,
  REDIS_MEDIATOR,
  REDIS_MICROSERVICE_OPTIONS,
  REDIS_PARKING,
  REDIS_SUBSCRIPTION_REGISTRY,
  REDIS_TOPOLOGY,
} from '@/infrastructure';
import { RedisEventBusServer } from '@/interface';

type RedisModuleForRootParams = {
  host: EventBusHost;
  onlyEmitting?: boolean;
};

type RedisModuleForFeatureParams = {
  EventBus: Abstract<EventBus>;
};

export class RedisModule {
  static forRoot(params: RedisModuleForRootParams): DynamicModule {
    const providers: Provider[] = [
      {
        provide: REDIS_CLIENT,
        inject: [REDIS_CONNECTION, redisConfig.KEY],
        useFactory: (
          connectionService: RedisConnectionService,
          config: RedisConfig,
        ): RedisQueueClient => {
          return new RedisQueueClient(
            connectionService.getClient(),
            config.queueOptions,
            config.commandTimeout,
          );
        },
      },
      {
        provide: REDIS_SUBSCRIPTION_REGISTRY,
        inject: [REDIS_CONNECTION, redisConfig.KEY],
        useFactory: (
          connectionService: RedisConnectionService,
          config: RedisConfig,
        ): RedisSubscriptionRegistry => {
          return new RedisSubscriptionRegistry(
            connectionService.getClient(),
            config.getSubscriptionKey,
            config.invalidationChannel,
          );
        },
      },
      {
        provide: REDIS_PARKING,
        inject: [REDIS_CONNECTION, REDIS_CLIENT, redisConfig.KEY],
        useFactory: (
          connectionService: RedisConnectionService,
          client: RedisQueueClient,
          config: RedisConfig,
        ): RedisParkingService => {
          return new RedisParkingService({
            client,
            connection: connectionService.getClient(),
            getParkingKey: config.getParkingKey,
            options: config.parkingOptions,
          });
        },
      },
      {
        // Owned events are fanned out even in `onlyEmitting` mode — nobody else mediates them.
        provide: REDIS_MEDIATOR,
        inject: [
          REDIS_CONNECTION,
          REDIS_CLIENT,
          REDIS_SUBSCRIPTION_REGISTRY,
          REDIS_PARKING,
          redisConfig.KEY,
        ],
        useFactory: (
          connectionService: RedisConnectionService,
          client: RedisQueueClient,
          subscriptionRegistry: RedisSubscriptionRegistry,
          parking: RedisParkingService,
          config: RedisConfig,
        ): RedisMediatorService => {
          return new RedisMediatorService({
            client,
            parking,
            subscriptionRegistry,
            eventIds: [...(REDIS_HOST_EVENTS[params.host] ?? [])],
            connection: connectionService.getClient(),
            workerOptions: config.workerOptions,
            commandTimeoutMs: config.commandTimeout,
            waitForReady: () => connectionService.waitUntilReady(config.readyTimeout),
          });
        },
      },
      {
        // Nothing injects it — it exists for its bootstrap hook. The mediator is a dependency
        // because it owns the count of the workers it is about to run.
        provide: REDIS_TOPOLOGY,
        inject: [REDIS_MEDIATOR],
        useFactory: (mediator: RedisMediatorService): RedisTopologyReporter => {
          return new RedisTopologyReporter({
            mediator,
            host: params.host,
            registry: globalQueueRegistry,
            onlyEmitting: params.onlyEmitting,
          });
        },
      },
    ];

    // `redisConfig.KEY` is not exported: it belongs to the imported `ConfigModule.forFeature`,
    // not to this module, and Nest refuses to re-export a provider it does not own. A consumer
    // that needs the config imports the same feature module.
    const exports: DynamicModule['exports'] = [REDIS_CLIENT];

    if (!params.onlyEmitting) {
      providers.push({
        provide: REDIS_MICROSERVICE_OPTIONS,
        inject: [REDIS_CONNECTION, REDIS_SUBSCRIPTION_REGISTRY, REDIS_PARKING, redisConfig.KEY],
        useFactory: (
          connectionService: RedisConnectionService,
          subscriptionRegistry: RedisSubscriptionRegistry,
          parking: RedisParkingService,
          config: RedisConfig,
        ): CustomStrategy => {
          return {
            strategy: new RedisEventBusServer({
              parking,
              subscriptionRegistry,
              registry: globalQueueRegistry,
              connection: connectionService.getClient(),
              workerOptions: config.workerOptions,
              commandTimeoutMs: config.commandTimeout,
              waitForReady: () => connectionService.waitUntilReady(config.readyTimeout),
            }),
          };
        },
      });

      exports.push(REDIS_MICROSERVICE_OPTIONS);
    }

    // Registered last on purpose: Nest runs the shutdown hooks in provider order, so the
    // shared connection is closed only after the workers and queues above are gone.
    providers.push({
      provide: REDIS_CONNECTION,
      inject: [redisConfig.KEY],
      useFactory: (config: RedisConfig): RedisConnectionService => {
        return new RedisConnectionService(
          config.connectionUrl,
          config.getConnectionOptions(params.host),
        );
      },
    });

    exports.push(REDIS_CONNECTION);

    return {
      imports: [ConfigModule.forFeature(redisConfig)],
      providers,
      exports,
      global: true,
      module: RedisModule,
    };
  }

  static forFeature(params: RedisModuleForFeatureParams): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: params.EventBus,
          inject: [REDIS_CLIENT],
          useFactory: (client: RedisQueueClient): Type => {
            return RedisClientFactory.create(client, params.EventBus);
          },
        },
      ],
      exports: [params.EventBus],
    };
  }
}
