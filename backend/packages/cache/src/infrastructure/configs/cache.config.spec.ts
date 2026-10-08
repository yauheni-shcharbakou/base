import { describe, expect, it, vi } from 'vitest';
import type { CacheConfig } from './cache.config';

type LoadedConfig = {
  config: CacheConfig;
  driver: ReturnType<typeof import('./cache.config').getCacheDriver>;
};

/**
 * The module validates env at import time, so every variant needs a fresh module registry —
 * a `beforeEach` that only mutates `process.env` would be read by nobody.
 */
const loadConfig = async (env: Record<string, string> = {}): Promise<LoadedConfig> => {
  const previous = { ...process.env };

  Object.assign(process.env, env);

  try {
    // A fresh registry, so the import below re-runs the module's validation against `env`.
    vi.resetModules();
    // `.js`: NodeNext wants the extension on a dynamic import; Vite resolves it to the `.ts`.
    const loaded = await import('./cache.config.js');

    return { config: loaded.cacheConfig(), driver: loaded.getCacheDriver() };
  } finally {
    // Restored even when the load throws, otherwise a bad value leaks into the next case.
    process.env = previous;
  }
};

describe('cacheConfig', () => {
  describe('connection url', () => {
    it('shares REDIS_URL with the event bus by default', async () => {
      expect((await loadConfig({ REDIS_URL: 'redis://bus:6379' })).config.connectionUrl).toBe(
        'redis://bus:6379',
      );
    });

    // The escape hatch for a cache instance configured to evict, which must not hold the
    // event bus' durable queues.
    it('prefers CACHE_REDIS_URL when it is set', async () => {
      const { config } = await loadConfig({
        REDIS_URL: 'redis://bus:6379',
        CACHE_REDIS_URL: 'redis://cache:6379',
      });

      expect(config.connectionUrl).toBe('redis://cache:6379');
    });

    it('falls back to localhost with neither set', async () => {
      const previous = process.env.REDIS_URL;

      delete process.env.REDIS_URL;

      try {
        expect((await loadConfig()).config.connectionUrl).toBe('redis://localhost:6379');
      } finally {
        process.env.REDIS_URL = previous;
      }
    });
  });

  describe('driver', () => {
    it('is redis unless asked otherwise', async () => {
      expect((await loadConfig()).driver).toBe('redis');
    });

    // Read synchronously by `CacheModule.forRoot`, which skips the connection provider entirely.
    it('follows CACHE_DRIVER', async () => {
      expect((await loadConfig({ CACHE_DRIVER: 'memory' })).driver).toBe('memory');
    });

    it('rejects an unknown driver', async () => {
      const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(loadConfig({ CACHE_DRIVER: 'memcached' })).rejects.toThrow(
        'Env validation failed',
      );

      report.mockRestore();
    });
  });

  describe('keys and ttl', () => {
    it('defaults to the `cache` prefix and a five-minute ttl', async () => {
      const { config } = await loadConfig();

      expect(config.keyPrefix).toBe('cache');
      expect(config.defaultTtl).toBe(300);
    });

    it('follows CACHE_KEY_PREFIX and CACHE_TTL', async () => {
      const { config } = await loadConfig({ CACHE_KEY_PREFIX: 'cache-e2e', CACHE_TTL: '2' });

      expect(config.keyPrefix).toBe('cache-e2e');
      expect(config.defaultTtl).toBe(2);
    });

    // 0 is a value, not a missing one: it means "store without an expiry".
    it('accepts a zero ttl', async () => {
      expect((await loadConfig({ CACHE_TTL: '0' })).config.defaultTtl).toBe(0);
    });
  });

  describe('connection options', () => {
    it('names the client after the namespace', async () => {
      expect((await loadConfig()).config.getConnectionOptions('apiGateway').connectionName).toBe(
        'apigateway-cache-client',
      );
    });

    it('names an anonymous connection after the package', async () => {
      expect((await loadConfig()).config.getConnectionOptions('').connectionName).toBe(
        'cache-cache-client',
      );
    });

    // The event bus' variable, deliberately: the address family is a property of the network, so
    // a cache reachable over a different one than the broker is not a case that exists.
    it('defaults to dual stack and follows REDIS_IP_FAMILY', async () => {
      expect((await loadConfig()).config.getConnectionOptions('auth').family).toBe(0);
      expect(
        (await loadConfig({ REDIS_IP_FAMILY: '6' })).config.getConnectionOptions('auth').family,
      ).toBe(6);
    });

    it('rejects an IP family that is not 0, 4 or 6', async () => {
      // `validateEnv` prints the zod report before throwing — expected here, just noise.
      const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(loadConfig({ REDIS_IP_FAMILY: '5' })).rejects.toThrow('Env validation failed');

      report.mockRestore();
    });

    /**
     * The two settings that make fail-soft mean anything in wall-clock time. With the offline
     * queue on, a command issued while the socket is down waits out ioredis' reconnect ladder —
     * ~30s per request, behind a cache nobody was required to wait for.
     */
    it('never queues a command while the socket is down, and bounds the ones it sends', async () => {
      const options = (await loadConfig()).config.getConnectionOptions('auth');

      expect(options.enableOfflineQueue).toBe(false);
      expect(options.commandTimeout).toBe(1000);
    });

    it('follows CACHE_COMMAND_TIMEOUT', async () => {
      expect(
        (await loadConfig({ CACHE_COMMAND_TIMEOUT: '250' })).config.getConnectionOptions('auth')
          .commandTimeout,
      ).toBe(250);
    });
  });

  describe('namespace', () => {
    /**
     * Not cosmetic: `ConfigModule.forFeature` merges a plain factory's keys into one flat store,
     * and `getConnectionOptions` is a name `@backend/event-bus-redis` uses too. Unnamespaced,
     * whichever module loaded last won — and the event bus once came up on the cache's options,
     * without the `maxRetriesPerRequest: null` BullMQ requires.
     */
    it('is registered under its own key', async () => {
      const { cacheConfig } = await import('./cache.config.js');

      expect(cacheConfig.KEY).toBe('CONFIGURATION(cache)');
    });
  });
});
