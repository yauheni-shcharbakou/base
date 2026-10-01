import { registerAs } from '@nestjs/config';
import { validateEnv } from '@packages/common';
import { RedisOptions } from 'ioredis';
import zod from 'zod';
import { CacheDriver } from '../../domain';

const env = validateEnv({
  // The same variable `@backend/event-bus-redis` reads: one Redis is what docker-compose and
  // the deployments actually run, and the two subsystems share it through disjoint key
  // prefixes rather than through a second URL nobody sets.
  REDIS_URL: zod.string().default('redis://localhost:6379'),
  // Shared with the event bus for the same reason, and there is no second one: the address family
  // is a property of the network, not of a subsystem — 0 = dual stack, 4 = IPv4 only, 6 = IPv6
  // only. ioredis resolves an A record by default and fails with ENOTFOUND on an IPv6-only
  // private network.
  REDIS_IP_FAMILY: zod.coerce
    .number()
    .int()
    .refine((value) => [0, 4, 6].includes(value), { message: 'must be 0, 4 or 6' })
    .default(0),
  // Set only when the cache has to live on its own instance — a cache that is evicted under
  // memory pressure has no business sharing a server with the event bus' durable queues.
  CACHE_REDIS_URL: zod.string().optional(),
  // `memory` is process-local and survives nothing: dev without a broker, and tests.
  CACHE_DRIVER: zod.enum(['redis', 'memory']).default('redis'),
  CACHE_KEY_PREFIX: zod.string().default('cache'),
  CACHE_TTL: zod.coerce.number().int().nonnegative().default(300),
  // Milliseconds a single command may take before it is abandoned as a miss. The point is the
  // caller: a cache lookup sits in front of a request, so a slow Redis must cost a millisecond
  // budget, not a request. Raise it only if legitimate commands start being counted as errors.
  CACHE_COMMAND_TIMEOUT: zod.coerce.number().int().positive().default(1000),
});

/**
 * Read synchronously by `CacheModule.forRoot`, which has to know the driver before Nest
 * resolves anything: with `memory` no ioredis connection is created at all.
 */
export const getCacheDriver = (): CacheDriver => env.CACHE_DRIVER;

/**
 * Namespaced, and it has to be: `ConfigModule.forFeature` merges a plain factory's keys into one
 * flat store, and `getConnectionOptions` is exactly the name `@backend/event-bus-redis` picked
 * too. A service wiring both used to get whichever module loaded last — which handed the event
 * bus a connection without `maxRetriesPerRequest: null`.
 *
 * @see docs/adr/0012-namespaced-package-config.md
 */
export const cacheConfig = registerAs(
  'cache',
  () =>
    ({
      connectionUrl: env.CACHE_REDIS_URL ?? env.REDIS_URL,
      keyPrefix: env.CACHE_KEY_PREFIX,
      /** Seconds. `0` means entries are stored without an expiry unless a call passes one. */
      defaultTtl: env.CACHE_TTL,
      // The one member that stays a function: it is the only value that depends on an argument.
      getConnectionOptions: (namespace: string): RedisOptions => {
        // Shows up in `CLIENT LIST`, so it only has to be readable: a namespace already looks
        // like `auth` / `storage`, anything else is folded into dashes.
        const clientName = (namespace || 'cache').toLowerCase().replace(/[^a-z0-9]+/g, '-');

        return {
          connectionName: `${clientName}-cache-client`,
          family: env.REDIS_IP_FAMILY,
          commandTimeout: env.CACHE_COMMAND_TIMEOUT,
          // The setting that makes fail-soft mean anything. With the offline queue on, a command
          // issued while the socket is down waits for the reconnect ladder — ~30s of `me` requests
          // stalling behind a cache nobody was required to wait for. Off, it rejects at once and
          // `CacheService` reads that as a miss.
          enableOfflineQueue: false,
        };
      },
    }) as const,
);

export type CacheConfig = ReturnType<typeof cacheConfig>;
