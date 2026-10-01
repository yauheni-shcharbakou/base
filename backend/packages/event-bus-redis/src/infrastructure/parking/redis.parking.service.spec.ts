import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { RedisQueueClient } from '../clients';
import { RedisQueueSubscription } from '../types';
import { RedisParkingService } from './redis.parking.service';

const getParkingKey = (eventId: string): string => `event-bus:parked:${eventId}`;

const subscription: RedisQueueSubscription = {
  eventId: 'auth.user.create',
  consumerId: 'storage.storage-object',
  queueName: 'auth.user.create@storage.storage-object',
};

const buildPipeline = () => {
  const pipeline = {
    rpush: jest.fn(() => pipeline),
    ltrim: jest.fn(() => pipeline),
    expire: jest.fn(() => pipeline),
    exec: jest.fn(() => Promise.resolve([])),
  };

  return pipeline;
};

const buildDeps = (entries: string[] = []) => {
  const pipeline = buildPipeline();
  const addBulk = jest.fn(() => Promise.resolve([]));

  const connection = {
    pipeline: jest.fn(() => pipeline),
    lrange: jest.fn(() => Promise.resolve(entries)),
  };

  const client = { getQueue: jest.fn(() => ({ addBulk }) as unknown as Queue) };

  return { pipeline, addBulk, connection, client };
};

const buildService = (
  deps: ReturnType<typeof buildDeps>,
  options = { maxLength: 1000, ttlSeconds: 86400 },
): RedisParkingService => {
  return new RedisParkingService({
    getParkingKey,
    options,
    connection: deps.connection as unknown as Redis,
    client: deps.client as unknown as RedisQueueClient,
  });
};

describe('RedisParkingService', () => {
  beforeAll(() => {
    // The service logs a warning per skipped entry and a line per replay — keep the output clean.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('park', () => {
    it('pushes the event and bounds the list by both length and age', async () => {
      const deps = buildDeps();

      await buildService(deps).park('auth.user.create', { id: '42', data: { id: 'user-1' } });

      const key = 'event-bus:parked:auth.user.create';

      expect(deps.pipeline.rpush).toHaveBeenCalledWith(
        key,
        JSON.stringify({ id: '42', data: { id: 'user-1' } }),
      );
      expect(deps.pipeline.ltrim).toHaveBeenCalledWith(key, -1000, -1);
      expect(deps.pipeline.expire).toHaveBeenCalledWith(key, 86400);
      expect(deps.pipeline.exec).toHaveBeenCalled();
    });

    it('does nothing when parking is disabled', async () => {
      const deps = buildDeps();
      const service = buildService(deps, { maxLength: 0, ttlSeconds: 86400 });

      expect(service.isEnabled()).toBe(false);

      await service.park('auth.user.create', { id: '42', data: {} });

      expect(deps.connection.pipeline).not.toHaveBeenCalled();
    });

    // A failed push has to fail the mediator job so BullMQ retries the whole fan-out.
    it('propagates a Redis failure', async () => {
      const deps = buildDeps();
      deps.pipeline.exec.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(
        buildService(deps).park('auth.user.create', { id: '42', data: {} }),
      ).rejects.toThrow('connect ECONNREFUSED');
    });
  });

  describe('replay', () => {
    it('adds the parked events to the consumer queue with a deterministic job id', async () => {
      const deps = buildDeps([
        JSON.stringify({ id: '1', data: { id: 'user-1' } }),
        JSON.stringify({ id: '2', data: { id: 'user-2' } }),
      ]);

      await buildService(deps).replay([subscription]);

      expect(deps.connection.lrange).toHaveBeenCalledWith(
        'event-bus:parked:auth.user.create',
        0,
        -1,
      );
      expect(deps.client.getQueue).toHaveBeenCalledWith('auth.user.create@storage.storage-object');
      expect(deps.addBulk).toHaveBeenCalledWith([
        {
          name: 'auth.user.create',
          data: { id: 'user-1' },
          opts: { jobId: 'auth.user.create-1' },
        },
        {
          name: 'auth.user.create',
          data: { id: 'user-2' },
          opts: { jobId: 'auth.user.create-2' },
        },
      ]);
    });

    // Non-destructive on purpose: a second brand-new consumer of the same event needs the
    // very same entries, so only the TTL removes them.
    it('leaves the parked entries in place', async () => {
      const deps = buildDeps([JSON.stringify({ id: '1', data: {} })]);

      await buildService(deps).replay([subscription]);

      expect(deps.connection.pipeline).not.toHaveBeenCalled();
    });

    it('skips an unreadable entry and replays the rest', async () => {
      const deps = buildDeps(['not json', JSON.stringify({ id: '2', data: { id: 'user-2' } })]);

      await buildService(deps).replay([subscription]);

      expect(deps.addBulk).toHaveBeenCalledWith([
        {
          name: 'auth.user.create',
          data: { id: 'user-2' },
          opts: { jobId: 'auth.user.create-2' },
        },
      ]);
    });

    it('touches no queue when nothing is parked', async () => {
      const deps = buildDeps();

      await buildService(deps).replay([subscription]);

      expect(deps.client.getQueue).not.toHaveBeenCalled();
    });

    // A hiccup here must not take the bootstrap down: the entries stay and the next start retries.
    it('swallows a Redis failure', async () => {
      const deps = buildDeps();
      deps.connection.lrange.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(buildService(deps).replay([subscription])).resolves.toBeUndefined();
    });

    it('does nothing when parking is disabled', async () => {
      const deps = buildDeps([JSON.stringify({ id: '1', data: {} })]);

      await buildService(deps, { maxLength: 0, ttlSeconds: 86400 }).replay([subscription]);

      expect(deps.connection.lrange).not.toHaveBeenCalled();
    });
  });
});
