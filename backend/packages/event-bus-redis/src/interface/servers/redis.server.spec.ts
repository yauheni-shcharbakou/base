import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type Redis from 'ioredis';
import { defer, of, throwError } from 'rxjs';
import type { RedisParkingService } from '@/infrastructure';
import {
  RedisQueueRegistry,
  RedisQueueSubscription,
  RedisSubscriptionRegistry,
} from '@/infrastructure';
import { RedisEventBusServer } from './redis.server';

const workerInstances: {
  name: string;
  processor: (job: Job) => Promise<void>;
  close: jest.Mock;
}[] = [];

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((name: string, processor: (job: Job) => Promise<void>) => {
    const worker = { name, processor, on: jest.fn(), close: jest.fn(() => Promise.resolve()) };

    workerInstances.push(worker);

    return worker;
  }),
}));

const buildSubscription = (
  eventId: string,
  consumerId: string,
  concurrency?: number,
): RedisQueueSubscription => ({
  eventId,
  consumerId,
  concurrency,
  queueName: `${eventId}@${consumerId}`,
});

const buildDeps = (subscriptions: RedisQueueSubscription[] = []) => {
  const registry = new RedisQueueRegistry();
  subscriptions.forEach((subscription) => registry.append(subscription));

  const subscriptionRegistry = {
    publish: jest.fn(() => Promise.resolve<RedisQueueSubscription[]>([])),
  };

  const parking = { replay: jest.fn(() => Promise.resolve()) };

  return { registry, subscriptionRegistry, parking };
};

const buildServer = (
  deps: ReturnType<typeof buildDeps>,
  waitForReady: () => Promise<void> = () => Promise.resolve(),
): RedisEventBusServer => {
  return new RedisEventBusServer({
    waitForReady,
    registry: deps.registry,
    connection: {} as Redis,
    parking: deps.parking as unknown as RedisParkingService,
    subscriptionRegistry: deps.subscriptionRegistry as unknown as RedisSubscriptionRegistry,
    workerOptions: { concurrency: 1 },
    commandTimeoutMs: 50,
  });
};

/** Registers a handler the way Nest's `messageHandlers` map does. */
const addHandler = (
  server: RedisEventBusServer,
  pattern: string,
  handler: (...args: any[]) => unknown,
) => {
  const target = handler as unknown as Record<string, unknown>;
  target.isEventHandler = true;

  (server as unknown as { messageHandlers: Map<string, unknown> }).messageHandlers.set(
    pattern,
    handler,
  );
};

/** Resolves with whatever `listen` hands its callback: `undefined` on success, the error on failure. */
const listen = (server: RedisEventBusServer): Promise<unknown> => {
  return new Promise((resolve) => {
    void server.listen(resolve);
  });
};

describe('RedisEventBusServer', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    workerInstances.length = 0;
  });

  describe('listen', () => {
    it('publishes the subscriptions, replays their parked events, then starts the workers', async () => {
      const subscription = buildSubscription('auth.user.create', 'storage.file');
      const deps = buildDeps([subscription]);
      deps.subscriptionRegistry.publish.mockResolvedValue([subscription]);

      const server = buildServer(deps);
      addHandler(server, subscription.queueName, jest.fn());

      await expect(listen(server)).resolves.toBeUndefined();

      expect(deps.subscriptionRegistry.publish).toHaveBeenCalledWith([subscription]);
      // Only the first-ever registrations have anything parked waiting for them.
      expect(deps.parking.replay).toHaveBeenCalledWith([subscription]);
      expect(workerInstances.map((worker) => worker.name)).toEqual([subscription.queueName]);
    });

    it('closes every worker it started', async () => {
      const subscription = buildSubscription('auth.user.create', 'storage.file');
      const deps = buildDeps([subscription]);

      const server = buildServer(deps);
      addHandler(server, subscription.queueName, jest.fn());

      await listen(server);
      await server.close();

      expect(workerInstances[0].close).toHaveBeenCalled();
      expect(server.unwrap()).toHaveLength(0);
    });

    // `publish()` runs on a connection whose offline queue never rejects, so without the gate an
    // unreachable broker leaves the bootstrap waiting rather than reporting through `callback`.
    it('reports an unreachable broker instead of publishing into the offline queue', async () => {
      const subscription = buildSubscription('auth.user.create', 'storage.file');
      const deps = buildDeps([subscription]);

      const server = buildServer(deps, () =>
        Promise.reject(new Error('Redis connection "auth-redis-client" was not ready')),
      );
      addHandler(server, subscription.queueName, jest.fn());

      await expect(listen(server)).resolves.toThrow('was not ready');
      expect(deps.subscriptionRegistry.publish).not.toHaveBeenCalled();
      expect(workerInstances).toHaveLength(0);
    });
  });

  describe('assertSubscriptions', () => {
    // Both cases are bootstrap-time mistakes; failing loudly beats a queue that silently idles.
    it('rejects an event pattern that never went through @RedisController', async () => {
      const deps = buildDeps();

      const server = buildServer(deps);
      addHandler(server, 'auth.user.create', jest.fn());

      await expect(listen(server)).resolves.toThrow(
        'Redis event pattern "auth.user.create" is not bound to a consumer',
      );
    });

    it('rejects a registered subscription with no handler behind it', async () => {
      const subscription = buildSubscription('auth.user.create', 'storage.file');
      const deps = buildDeps([subscription]);

      await expect(listen(buildServer(deps))).resolves.toThrow(
        'No handler registered for the Redis queue "auth.user.create@storage.file"',
      );
    });

    it('starts nothing when a subscription is broken', async () => {
      const deps = buildDeps([buildSubscription('auth.user.create', 'storage.file')]);

      await listen(buildServer(deps));

      expect(workerInstances).toHaveLength(0);
      expect(deps.subscriptionRegistry.publish).not.toHaveBeenCalled();
    });
  });

  describe('handleJob', () => {
    const runJob = async (
      handler: (...args: any[]) => unknown,
      job: Job = { id: '1', data: {} } as Job,
    ): Promise<void> => {
      const subscription = buildSubscription('auth.user.create', 'storage.file');
      const deps = buildDeps([subscription]);

      const server = buildServer(deps);
      addHandler(server, subscription.queueName, handler);

      await listen(server);
      await workerInstances[0].processor(job);
    };

    it('passes the payload and a job context to the handler', async () => {
      const handler = jest.fn();

      await runJob(handler, { id: '7', data: { id: 'user-1' }, attemptsMade: 2 } as Job);

      const [payload, context] = handler.mock.calls[0];

      expect(payload).toEqual({ id: 'user-1' });
      expect(context.getEventId()).toBe('auth.user.create');
      expect(context.getConsumerId()).toBe('storage.file');
      expect(context.getQueueName()).toBe('auth.user.create@storage.file');
      expect(context.getAttemptsMade()).toBe(2);
    });

    // With interceptors in play the handler resolves to an observable. `defer` only runs its
    // factory on subscription, so this fails if the server merely returns the observable —
    // which is what would ack the job before the controller logic ever ran.
    it('subscribes to an observable result', async () => {
      const ran = jest.fn();

      await runJob(() =>
        defer(() => {
          ran();
          return of(undefined);
        }),
      );

      expect(ran).toHaveBeenCalled();
    });

    it('fails the job when the observable errors', async () => {
      const subscription = buildSubscription('auth.user.create', 'storage.file');
      const deps = buildDeps([subscription]);

      const server = buildServer(deps);
      addHandler(server, subscription.queueName, () =>
        throwError(() => new Error('handler blew up')),
      );

      await listen(server);

      await expect(workerInstances[0].processor({ id: '1', data: {} } as Job)).rejects.toThrow(
        'handler blew up',
      );
    });
  });

  describe('toError', () => {
    const toError = (error: unknown): Error => {
      return (RedisEventBusServer as unknown as { toError: (error: unknown) => Error }).toError(
        error,
      );
    };

    // Nest's rpc pipeline may reject with a plain string or object; BullMQ only persists
    // `error.message` into `failedReason`.
    it('normalises a rejected string', () => {
      expect(toError('Internal server error')).toEqual(new Error('Internal server error'));
    });

    it('normalises a rejected plain object', () => {
      const error = toError({ status: 'error', message: 'boom' });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('boom');
    });

    it('keeps an error whose message already reads correctly', () => {
      const original = new Error('connect ECONNREFUSED ::1:5432');

      expect(toError(original)).toBe(original);
    });

    // A message-less wrapper (MikroORM's `DriverException` over the `AggregateError` Node
    // raises for a refused connection) reaches this point when the handler threw outside the
    // interceptor's observable.
    it('recovers the message of a wrapper error and keeps the original as the cause', () => {
      const cause = new AggregateError([new Error('connect ECONNREFUSED ::1:5432')], '');
      const wrapper = Object.assign(new Error(''), { cause });

      const error = toError(wrapper);

      expect(error.message).toBe('connect ECONNREFUSED ::1:5432');
      expect((error as { cause?: unknown }).cause).toBe(wrapper);
    });
  });
});
