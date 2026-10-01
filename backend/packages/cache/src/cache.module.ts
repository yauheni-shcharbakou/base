import { DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheDriver, CacheStore } from '@/domain';
import {
  CACHE_CONNECTION,
  CacheConfig,
  cacheConfig,
  CacheConnectionService,
  CacheMetrics,
  CacheService,
  getCacheDriver,
  MemoryCacheStore,
  RedisCacheStore,
} from '@/infrastructure';

type CacheModuleForRootParams = {
  /** Second key segment — usually the service name, so two services cannot collide. */
  namespace?: string;
  /** Overrides `CACHE_DRIVER`; mostly for specs that want the memory store explicitly. */
  driver?: CacheDriver;
};

export class CacheModule {
  static forRoot(params: CacheModuleForRootParams = {}): DynamicModule {
    // Resolved here rather than inside the factory: with `memory` no ioredis connection
    // provider is registered at all, so the package can run with no Redis in sight.
    const driver = params.driver ?? getCacheDriver();
    const namespace = params.namespace ?? '';

    const providers: Provider[] = [
      {
        provide: CacheStore,
        inject: driver === 'redis' ? [CACHE_CONNECTION] : [],
        useFactory: (connectionService?: CacheConnectionService): CacheStore => {
          return connectionService
            ? new RedisCacheStore(connectionService.getClient())
            : new MemoryCacheStore();
        },
      },
      // One instance per module, shared by the service and every scope it hands out — what
      // makes "how often did the fail-soft path fire?" answerable at all.
      CacheMetrics,
      {
        provide: CacheService,
        inject: [CacheStore, cacheConfig.KEY, CacheMetrics],
        useFactory: (
          store: CacheStore,
          config: CacheConfig,
          metrics: CacheMetrics,
        ): CacheService => {
          return new CacheService(
            store,
            {
              namespace,
              keyPrefix: config.keyPrefix,
              defaultTtl: config.defaultTtl,
            },
            metrics,
          );
        },
      },
    ];

    if (driver === 'redis') {
      // Registered last on purpose, the same rule `RedisModule` follows: Nest runs the
      // shutdown hooks in provider order, so the socket closes after everything using it.
      providers.push({
        provide: CACHE_CONNECTION,
        inject: [cacheConfig.KEY],
        useFactory: (config: CacheConfig): CacheConnectionService => {
          return new CacheConnectionService(
            config.connectionUrl,
            config.getConnectionOptions(namespace),
          );
        },
      });
    }

    return {
      imports: [ConfigModule.forFeature(cacheConfig)],
      providers,
      // `CacheStore` is exported too, so a consumer that wants the raw port (or a spec that
      // overrides it) does not have to reach through the service; `CacheMetrics`, so a health
      // or scrape endpoint can read the counters without one.
      exports: [CacheService, CacheStore, CacheMetrics],
      global: true,
      module: CacheModule,
    };
  }
}
