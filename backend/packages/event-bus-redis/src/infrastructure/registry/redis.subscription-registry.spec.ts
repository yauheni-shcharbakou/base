import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisQueueSubscription } from '../types';
import { RedisSubscriptionRegistry } from './redis.subscription-registry';

const INVALIDATION_CHANNEL = 'event-bus:subs:changed';

const getSubscriptionKey = (eventId: string): string => `event-bus:subs:${eventId}`;

const buildSubscription = (eventId: string, consumerId: string): RedisQueueSubscription => ({
  eventId,
  consumerId,
  queueName: `${eventId}@${consumerId}`,
});

const buildDeps = () => {
  // `results` drives what each queued SADD is reported to have returned: 1 = newly added.
  const pipeline = {
    sadd: jest.fn(() => pipeline),
    publish: jest.fn(() => pipeline),
    exec: jest.fn(() => Promise.resolve<[Error | null, unknown][]>([])),
  };

  const subscriber = {
    on: jest.fn(),
    status: 'ready',
    subscribe: jest.fn(() => Promise.resolve(1)),
    quit: jest.fn(() => Promise.resolve('OK')),
    disconnect: jest.fn(),
  };

  const connection = {
    pipeline: jest.fn(() => pipeline),
    smembers: jest.fn(() => Promise.resolve<string[]>([])),
    duplicate: jest.fn(() => subscriber),
  };

  return { pipeline, subscriber, connection };
};

const buildRegistry = (
  deps: ReturnType<typeof buildDeps>,
  cacheTtlMs = 5000,
): RedisSubscriptionRegistry => {
  return new RedisSubscriptionRegistry(
    deps.connection as unknown as Redis,
    getSubscriptionKey,
    INVALIDATION_CHANNEL,
    cacheTtlMs,
  );
};

/** Makes the pipeline report `1` (newly added) for the given indexes and `0` for the rest. */
const withSaddResults = (deps: ReturnType<typeof buildDeps>, added: number[], total: number) => {
  deps.pipeline.exec.mockResolvedValueOnce(
    Array.from({ length: total }, (_item, index): [Error | null, unknown] => [
      null,
      added.includes(index) ? 1 : 0,
    ]),
  );
};

describe('RedisSubscriptionRegistry', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('publish', () => {
    it('registers every subscription under its event key', async () => {
      const deps = buildDeps();
      const subscriptions = [
        buildSubscription('auth.user.create', 'storage.file'),
        buildSubscription('auth.user.create', 'storage.storage-object'),
      ];

      withSaddResults(deps, [0, 1], 2);

      await buildRegistry(deps).publish(subscriptions);

      expect(deps.pipeline.sadd).toHaveBeenCalledWith(
        'event-bus:subs:auth.user.create',
        'storage.file',
      );
      expect(deps.pipeline.sadd).toHaveBeenCalledWith(
        'event-bus:subs:auth.user.create',
        'storage.storage-object',
      );
    });

    // The replay of parked events keys off this: only a first-ever registration has anything
    // waiting for it.
    it('returns only the subscriptions whose SADD reported them as new', async () => {
      const deps = buildDeps();
      const known = buildSubscription('auth.user.create', 'storage.file');
      const fresh = buildSubscription('auth.user.create', 'storage.storage-object');

      withSaddResults(deps, [1], 2);

      await expect(buildRegistry(deps).publish([known, fresh])).resolves.toEqual([fresh]);
    });

    it('announces each newly added event id once', async () => {
      const deps = buildDeps();

      // Two new consumers of the same event — one announcement, not two.
      withSaddResults(deps, [0, 1], 2);

      await buildRegistry(deps).publish([
        buildSubscription('auth.user.create', 'storage.file'),
        buildSubscription('auth.user.create', 'storage.storage-object'),
      ]);

      expect(deps.pipeline.publish).toHaveBeenCalledTimes(1);
      expect(deps.pipeline.publish).toHaveBeenCalledWith(INVALIDATION_CHANNEL, 'auth.user.create');
    });

    it('announces nothing when every subscriber was already known', async () => {
      const deps = buildDeps();

      withSaddResults(deps, [], 1);

      await buildRegistry(deps).publish([buildSubscription('auth.user.create', 'storage.file')]);

      expect(deps.pipeline.publish).not.toHaveBeenCalled();
    });

    it('touches no Redis for an empty subscription list', async () => {
      const deps = buildDeps();

      await expect(buildRegistry(deps).publish([])).resolves.toEqual([]);

      expect(deps.connection.pipeline).not.toHaveBeenCalled();
    });

    // Losing the announcement only costs freshness — the TTL cache expires on its own.
    it('survives a failed announcement', async () => {
      const deps = buildDeps();

      withSaddResults(deps, [0], 1);
      deps.pipeline.exec.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(
        buildRegistry(deps).publish([buildSubscription('auth.user.create', 'storage.file')]),
      ).resolves.toHaveLength(1);
    });
  });

  describe('getConsumers', () => {
    it('reads the consumer set once and serves the rest from the cache', async () => {
      const deps = buildDeps();
      deps.connection.smembers.mockResolvedValue(['storage.file']);

      const registry = buildRegistry(deps);

      await expect(registry.getConsumers('auth.user.create')).resolves.toEqual(['storage.file']);
      await expect(registry.getConsumers('auth.user.create')).resolves.toEqual(['storage.file']);

      expect(deps.connection.smembers).toHaveBeenCalledTimes(1);
      expect(deps.connection.smembers).toHaveBeenCalledWith('event-bus:subs:auth.user.create');
    });

    it('re-reads once the cache entry has expired', async () => {
      const deps = buildDeps();
      deps.connection.smembers.mockResolvedValue(['storage.file']);

      const registry = buildRegistry(deps, 0);

      await registry.getConsumers('auth.user.create');
      await registry.getConsumers('auth.user.create');

      expect(deps.connection.smembers).toHaveBeenCalledTimes(2);
    });

    // What the mediator uses after parking a job: a consumer may have registered since the
    // cached read, and acting on the stale empty set would strand the parked event.
    it('bypasses the cache when asked for a fresh read', async () => {
      const deps = buildDeps();
      deps.connection.smembers.mockResolvedValueOnce([]);
      deps.connection.smembers.mockResolvedValueOnce(['storage.storage-object']);

      const registry = buildRegistry(deps);

      await expect(registry.getConsumers('auth.user.create')).resolves.toEqual([]);
      await expect(registry.getConsumers('auth.user.create', { fresh: true })).resolves.toEqual([
        'storage.storage-object',
      ]);

      // And the fresh value replaces what was cached.
      await expect(registry.getConsumers('auth.user.create')).resolves.toEqual([
        'storage.storage-object',
      ]);
      expect(deps.connection.smembers).toHaveBeenCalledTimes(2);
    });
  });

  describe('the invalidation channel', () => {
    it('drops the cached entry of an event announced by another process', async () => {
      const deps = buildDeps();
      deps.connection.smembers.mockResolvedValue(['storage.file']);

      const registry = buildRegistry(deps);
      await registry.onApplicationBootstrap();
      await registry.getConsumers('auth.user.create');

      const [[, onMessage]] = deps.subscriber.on.mock.calls.filter(
        ([event]) => event === 'message',
      );
      onMessage(INVALIDATION_CHANNEL, 'auth.user.create');

      await registry.getConsumers('auth.user.create');

      expect(deps.connection.smembers).toHaveBeenCalledTimes(2);
    });

    it('needs a socket of its own — ioredis refuses commands on a subscribed connection', async () => {
      const deps = buildDeps();

      await buildRegistry(deps).onApplicationBootstrap();

      expect(deps.connection.duplicate).toHaveBeenCalled();
      expect(deps.subscriber.subscribe).toHaveBeenCalledWith(INVALIDATION_CHANNEL);
    });

    it('keeps working when the channel cannot be opened', async () => {
      const deps = buildDeps();
      deps.subscriber.subscribe.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      deps.connection.smembers.mockResolvedValue(['storage.file']);

      const registry = buildRegistry(deps);

      await expect(registry.onApplicationBootstrap()).resolves.toBeUndefined();
      await expect(registry.getConsumers('auth.user.create')).resolves.toEqual(['storage.file']);

      // The half-open socket is released instead of being left behind.
      expect(deps.subscriber.quit).toHaveBeenCalled();
    });

    it('closes the channel on shutdown, and only when it was opened', async () => {
      const deps = buildDeps();
      const registry = buildRegistry(deps);

      await registry.onApplicationShutdown();
      expect(deps.subscriber.quit).not.toHaveBeenCalled();

      await registry.onApplicationBootstrap();
      await registry.onApplicationShutdown();
      expect(deps.subscriber.quit).toHaveBeenCalledTimes(1);
    });

    // `quit` is a command: on a client that is not ready it joins the offline queue and, during
    // an outage, waits forever — which is a process that ignores its own SIGTERM.
    it('drops a socket that is not ready instead of asking it to quit', async () => {
      const deps = buildDeps();
      const registry = buildRegistry(deps);

      await registry.onApplicationBootstrap();
      deps.subscriber.status = 'reconnecting';

      await registry.onApplicationShutdown();

      expect(deps.subscriber.quit).not.toHaveBeenCalled();
      expect(deps.subscriber.disconnect).toHaveBeenCalled();
    });
  });

  // ioredis retries every couple of seconds; one line per attempt buries everything else in the
  // log for as long as the outage lasts.
  describe('channel errors', () => {
    it('reports an outage once, and again after the channel recovers', async () => {
      const deps = buildDeps();
      // The suite-wide spy from `beforeAll`; re-spying would hand back the same accumulated mock.
      const warn = jest.mocked(Logger.prototype.warn);
      warn.mockClear();

      await buildRegistry(deps).onApplicationBootstrap();

      const listeners = new Map<string, (payload: unknown) => void>(
        deps.subscriber.on.mock.calls as [string, (payload: unknown) => void][],
      );

      listeners.get('error')?.(new Error('connect ECONNREFUSED'));
      listeners.get('error')?.(new Error('connect ECONNREFUSED'));

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Subscription invalidation channel error: connect ECONNREFUSED'),
      );

      listeners.get('ready')?.(undefined);
      listeners.get('error')?.(new Error('connect ECONNREFUSED'));

      expect(warn).toHaveBeenCalledTimes(2);
    });
  });
});
