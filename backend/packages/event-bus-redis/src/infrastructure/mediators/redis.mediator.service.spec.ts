import { afterAll, beforeAll, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { RedisQueueClient } from '../clients';
import type { RedisParkingService } from '../parking';
import type { RedisSubscriptionRegistry } from '../registry';
import { RedisMediatorService } from './redis.mediator.service';

// The mediator constructs a `Worker` per owned event; nothing here should touch a real one.
const workerInstances: {
  name: string;
  processor: (job: Job) => Promise<void>;
  close: Mock;
}[] = [];

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function (
    name: string,
    processor: (job: Job) => Promise<void>,
  ) {
    const worker = { name, processor, on: vi.fn(), close: vi.fn(() => Promise.resolve()) };

    workerInstances.push(worker);

    return worker;
  }),
}));

const buildJob = (id: string | undefined, data: unknown): Job => ({ id, data }) as Job;

const buildDeps = () => {
  const add = vi.fn(() => Promise.resolve({}));

  const client = { getQueue: vi.fn(() => ({ add }) as unknown as Queue) };
  const parking = { park: vi.fn(() => Promise.resolve()) };
  const subscriptionRegistry = { getConsumers: vi.fn(() => Promise.resolve<string[]>([])) };

  return { add, client, parking, subscriptionRegistry };
};

const buildMediator = (
  deps: ReturnType<typeof buildDeps>,
  eventIds = ['auth.user.create'],
  waitForReady: () => Promise<void> = () => Promise.resolve(),
): RedisMediatorService => {
  return new RedisMediatorService({
    eventIds,
    waitForReady,
    connection: {} as Redis,
    client: deps.client as unknown as RedisQueueClient,
    parking: deps.parking as unknown as RedisParkingService,
    subscriptionRegistry: deps.subscriptionRegistry as unknown as RedisSubscriptionRegistry,
    workerOptions: { concurrency: 1 },
    commandTimeoutMs: 50,
  });
};

/** Runs the worker processor the mediator registered for the given event. */
const fanOut = async (eventId: string, job: Job): Promise<void> => {
  const worker = workerInstances.find((item) => item.name === eventId);

  if (!worker) {
    throw new Error(`No mediator worker for "${eventId}"`);
  }

  await worker.processor(job);
};

describe('RedisMediatorService', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    workerInstances.length = 0;
  });

  describe('workers', () => {
    it('runs one worker per event the host owns', async () => {
      const deps = buildDeps();
      const mediator = buildMediator(deps, ['storage.file.purge', 'storage.video.upload.finish']);

      expect(mediator.getWorkerCount()).toBe(2);

      await mediator.onApplicationBootstrap();

      expect(workerInstances.map((worker) => worker.name)).toEqual([
        'storage.file.purge',
        'storage.video.upload.finish',
      ]);
    });

    it('closes them on shutdown', async () => {
      const deps = buildDeps();
      const mediator = buildMediator(deps);

      await mediator.onApplicationBootstrap();
      await mediator.onApplicationShutdown();

      expect(workerInstances[0].close).toHaveBeenCalled();
    });

    // Nest awaits the hook, so this rejection is what aborts `app.init()` instead of leaving the
    // service up with workers pointed at a broker that never answers.
    it('fails the bootstrap and starts nothing when the broker is unreachable', async () => {
      const deps = buildDeps();
      const mediator = buildMediator(deps, ['auth.user.create'], () =>
        Promise.reject(new Error('Redis connection "auth-redis-client" was not ready')),
      );

      await expect(mediator.onApplicationBootstrap()).rejects.toThrow('was not ready');
      expect(workerInstances).toHaveLength(0);
    });
  });

  describe('fan-out', () => {
    it('copies the job into the queue of every consumer', async () => {
      const deps = buildDeps();
      deps.subscriptionRegistry.getConsumers.mockResolvedValue([
        'storage.file',
        'storage.storage-object',
      ]);

      await buildMediator(deps).onApplicationBootstrap();
      await fanOut('auth.user.create', buildJob('42', { id: 'user-1' }));

      expect(deps.client.getQueue).toHaveBeenCalledWith('auth.user.create@storage.file');
      expect(deps.client.getQueue).toHaveBeenCalledWith('auth.user.create@storage.storage-object');

      // The job id is derived from the source one, so a redelivered job re-adds the same ids
      // and BullMQ drops the duplicates.
      expect(deps.add).toHaveBeenCalledTimes(2);
      expect(deps.add).toHaveBeenCalledWith(
        'auth.user.create',
        { id: 'user-1' },
        { jobId: 'auth.user.create-42' },
      );
    });

    it('leaves the job id undefined when the source has none', async () => {
      const deps = buildDeps();
      deps.subscriptionRegistry.getConsumers.mockResolvedValue(['storage.file']);

      await buildMediator(deps).onApplicationBootstrap();
      await fanOut('auth.user.create', buildJob(undefined, {}));

      expect(deps.add).toHaveBeenCalledWith('auth.user.create', {}, { jobId: undefined });
    });

    it('does not park an event that has consumers', async () => {
      const deps = buildDeps();
      deps.subscriptionRegistry.getConsumers.mockResolvedValue(['storage.file']);

      await buildMediator(deps).onApplicationBootstrap();
      await fanOut('auth.user.create', buildJob('42', {}));

      expect(deps.parking.park).not.toHaveBeenCalled();
    });
  });

  describe('no consumers', () => {
    it('parks the event instead of dropping it', async () => {
      const deps = buildDeps();

      await buildMediator(deps).onApplicationBootstrap();
      await fanOut('auth.user.create', buildJob('42', { id: 'user-1' }));

      expect(deps.parking.park).toHaveBeenCalledWith('auth.user.create', {
        id: '42',
        data: { id: 'user-1' },
      });
      expect(deps.add).not.toHaveBeenCalled();
    });

    // The race the re-read exists for: a consumer registered between the cached read and the
    // park, so its own bootstrap replay ran too early to see this entry.
    it('re-reads past the cache and fans out to a consumer that appeared meanwhile', async () => {
      const deps = buildDeps();
      deps.subscriptionRegistry.getConsumers.mockResolvedValueOnce([]);
      deps.subscriptionRegistry.getConsumers.mockResolvedValueOnce(['storage.storage-object']);

      await buildMediator(deps).onApplicationBootstrap();
      await fanOut('auth.user.create', buildJob('42', {}));

      expect(deps.subscriptionRegistry.getConsumers).toHaveBeenNthCalledWith(
        2,
        'auth.user.create',
        { fresh: true },
      );

      // Parked *and* delivered — the deterministic job id makes the overlap harmless.
      expect(deps.parking.park).toHaveBeenCalled();
      expect(deps.client.getQueue).toHaveBeenCalledWith('auth.user.create@storage.storage-object');
      expect(deps.add).toHaveBeenCalledTimes(1);
    });

    // Failing the job is not an option: an event with no subscriber at all would exhaust its
    // attempts and fill the DLQ.
    it('completes the job when the fresh read is empty too', async () => {
      const deps = buildDeps();

      await buildMediator(deps).onApplicationBootstrap();

      await expect(fanOut('auth.user.create', buildJob('42', {}))).resolves.toBeUndefined();
      expect(deps.add).not.toHaveBeenCalled();
    });

    it('fails the job when parking fails, so BullMQ retries the fan-out', async () => {
      const deps = buildDeps();
      deps.parking.park.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await buildMediator(deps).onApplicationBootstrap();

      await expect(fanOut('auth.user.create', buildJob('42', {}))).rejects.toThrow(
        'connect ECONNREFUSED',
      );
    });
  });
});
