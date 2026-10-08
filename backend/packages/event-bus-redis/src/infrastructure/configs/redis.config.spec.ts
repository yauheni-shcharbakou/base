import { describe, expect, it, vi } from 'vitest';
import type { RedisConfig } from './redis.config';

/**
 * The module validates env at import time, so every variant needs a fresh module registry —
 * a `beforeEach` that only mutates `process.env` would be read by nobody.
 */
const loadConfig = async (env: Record<string, string> = {}): Promise<RedisConfig> => {
  const previous = { ...process.env };

  Object.assign(process.env, env);

  try {
    // A fresh registry, so the import below re-runs the module's validation against `env`.
    vi.resetModules();
    // `.js`: NodeNext wants the extension on a dynamic import; Vite resolves it to the `.ts`.
    return (await import('./redis.config.js')).redisConfig();
  } finally {
    // Restored even when the load throws, otherwise a bad value leaks into the next case.
    process.env = previous;
  }
};

describe('redisConfig', () => {
  describe('keys', () => {
    it('namespaces the subscription set, the parking list and the invalidation channel', async () => {
      const config = await loadConfig();

      expect(config.getSubscriptionKey('auth.user.create')).toBe('event-bus:subs:auth.user.create');
      expect(config.getParkingKey('auth.user.create')).toBe('event-bus:parked:auth.user.create');
      expect(config.invalidationChannel).toBe('event-bus:subs:changed');
    });

    // What isolates the e2e suite from a developer's local dev data.
    it('follows REDIS_EVENT_BUS_NAMESPACE', async () => {
      const config = await loadConfig({ REDIS_EVENT_BUS_NAMESPACE: 'event-bus-e2e' });

      expect(config.getSubscriptionKey('auth.user.create')).toBe(
        'event-bus-e2e:subs:auth.user.create',
      );
      expect(config.getParkingKey('auth.user.create')).toBe(
        'event-bus-e2e:parked:auth.user.create',
      );
      expect(config.invalidationChannel).toBe('event-bus-e2e:subs:changed');
    });
  });

  describe('job options', () => {
    it('defaults to the production retry ladder', async () => {
      const { defaultJobOptions } = (await loadConfig()).queueOptions;

      expect(defaultJobOptions).toMatchObject({
        attempts: 10,
        backoff: { type: 'exponential', delay: 1000 },
      });
    });

    it('lets the ladder be shortened, which is what the e2e suite does', async () => {
      const { defaultJobOptions } = (
        await loadConfig({
          REDIS_JOB_ATTEMPTS: '3',
          REDIS_JOB_BACKOFF_DELAY: '100',
        })
      ).queueOptions;

      expect(defaultJobOptions).toMatchObject({
        attempts: 3,
        backoff: { type: 'exponential', delay: 100 },
      });
    });

    it('keeps the completed jobs replayable for an hour and the DLQ for a day', async () => {
      const { defaultJobOptions } = (await loadConfig()).queueOptions;

      expect(defaultJobOptions?.removeOnComplete).toEqual({ age: 3600, count: 1000 });
      expect(defaultJobOptions?.removeOnFail).toEqual({ age: 86400 });
    });

    it('follows REDIS_QUEUE_PREFIX', async () => {
      expect((await loadConfig({ REDIS_QUEUE_PREFIX: 'bull-e2e' })).queueOptions.prefix).toBe(
        'bull-e2e',
      );
    });
  });

  describe('parking options', () => {
    it('mirrors the job retention by default', async () => {
      expect((await loadConfig()).parkingOptions).toEqual({ maxLength: 1000, ttlSeconds: 86400 });
    });

    it('is disabled by a zero cap', async () => {
      expect((await loadConfig({ REDIS_PARKING_MAX_LENGTH: '0' })).parkingOptions.maxLength).toBe(
        0,
      );
    });
  });

  describe('worker options', () => {
    it('serialises deliveries by default, like the NATS maxAckPending of 1', async () => {
      expect((await loadConfig()).workerOptions.concurrency).toBe(1);
    });

    it('follows REDIS_WORKER_CONCURRENCY', async () => {
      expect((await loadConfig({ REDIS_WORKER_CONCURRENCY: '5' })).workerOptions.concurrency).toBe(
        5,
      );
    });
  });

  describe('connection', () => {
    it('names the client after the host and never gives up on blocking commands', async () => {
      const options = (await loadConfig()).getConnectionOptions('apiGateway');

      expect(options.connectionName).toBe('api-gateway-redis-client');
      // BullMQ requires blocking commands to retry forever.
      expect(options.maxRetriesPerRequest).toBeNull();
    });

    // Dual stack by default: managed private networks are often IPv6-only (Railway), where
    // ioredis' A-record lookup fails with ENOTFOUND.
    it('defaults to dual stack and follows REDIS_IP_FAMILY', async () => {
      expect((await loadConfig()).getConnectionOptions('auth').family).toBe(0);
      expect((await loadConfig({ REDIS_IP_FAMILY: '6' })).getConnectionOptions('auth').family).toBe(
        6,
      );
    });

    it('rejects an IP family that is not 0, 4 or 6', async () => {
      // `validateEnv` prints the zod report before throwing — expected here, just noise.
      const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(loadConfig({ REDIS_IP_FAMILY: '5' })).rejects.toThrow('Env validation failed');

      report.mockRestore();
    });
  });
});
