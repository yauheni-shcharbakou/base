import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisQueueClient } from './redis.queue.client';

const queueInstances: { name: string; add: jest.Mock; addBulk: jest.Mock; close: jest.Mock }[] = [];

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name: string) => {
    const queue = {
      name,
      add: jest.fn(() => Promise.resolve({ id: '1' })),
      addBulk: jest.fn(() => Promise.resolve([])),
      close: jest.fn(() => Promise.resolve()),
    };

    queueInstances.push(queue);

    return queue;
  }),
}));

const buildClient = (commandTimeoutMs = 5000): RedisQueueClient => {
  return new RedisQueueClient({} as Redis, { prefix: 'bull' }, commandTimeoutMs);
};

describe('RedisQueueClient', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    queueInstances.length = 0;
  });

  describe('getQueue', () => {
    it('builds one queue per name and reuses it', () => {
      const client = buildClient();

      const first = client.getQueue('auth.user.create');
      const second = client.getQueue('auth.user.create');

      expect(first).toBe(second);
      expect(queueInstances).toHaveLength(1);
    });

    it('keeps separate queues apart', () => {
      const client = buildClient();

      client.getQueue('auth.user.create');
      client.getQueue('auth.user.create@storage.file');

      expect(queueInstances.map((queue) => queue.name)).toEqual([
        'auth.user.create',
        'auth.user.create@storage.file',
      ]);
    });
  });

  describe('emit', () => {
    it('adds the event to the queue named after it', async () => {
      await buildClient().emit('auth.user.create', { id: 'user-1' });

      expect(queueInstances[0].name).toBe('auth.user.create');
      expect(queueInstances[0].add).toHaveBeenCalledWith(
        'auth.user.create',
        { id: 'user-1' },
        undefined,
      );
    });

    it('forwards the job options', async () => {
      await buildClient().emit('auth.user.create', {}, { jobId: 'auth.user.create-1' });

      expect(queueInstances[0].add).toHaveBeenCalledWith(
        'auth.user.create',
        {},
        {
          jobId: 'auth.user.create-1',
        },
      );
    });
  });

  describe('emitMany', () => {
    it('sends the batch in one addBulk', async () => {
      await buildClient().emitMany('auth.user.create', [{ id: 'user-1' }, { id: 'user-2' }]);

      expect(queueInstances[0].addBulk).toHaveBeenCalledWith([
        { name: 'auth.user.create', data: { id: 'user-1' }, opts: undefined },
        { name: 'auth.user.create', data: { id: 'user-2' }, opts: undefined },
      ]);
    });

    it('short-circuits an empty batch without opening a queue', async () => {
      await expect(buildClient().emitMany('auth.user.create', [])).resolves.toEqual([]);

      expect(queueInstances).toHaveLength(0);
    });
  });

  /**
   * The shared connection retries forever (BullMQ's requirement), so a command against a dead
   * broker never settles on its own. An emit is awaited inside a gRPC handler — without this the
   * caller waits with no answer at all.
   */
  describe('timeout', () => {
    const never = (): Promise<never> => new Promise<never>(() => undefined);

    it('fails an emit that never settles, naming the event', async () => {
      const client = buildClient(50);

      client.getQueue('auth.user.create');
      queueInstances[0].add.mockImplementationOnce(never);

      await expect(client.emit('auth.user.create', { id: 'user-1' })).rejects.toThrow(
        'Emitting "auth.user.create" timed out after 50ms',
      );
    });

    it('fails a batch the same way', async () => {
      const client = buildClient(50);

      client.getQueue('auth.user.create');
      queueInstances[0].addBulk.mockImplementationOnce(never);

      await expect(client.emitMany('auth.user.create', [{ id: 'user-1' }])).rejects.toThrow(
        'timed out after 50ms',
      );
    });

    it('leaves a normal emit alone', async () => {
      await expect(buildClient(50).emit('auth.user.create', { id: 'user-1' })).resolves.toEqual({
        id: '1',
      });
    });
  });

  describe('shutdown', () => {
    it('closes every queue it opened', async () => {
      const client = buildClient();

      client.getQueue('auth.user.create');
      client.getQueue('auth.user.create@storage.file');

      await client.onApplicationShutdown();

      queueInstances.forEach((queue) => expect(queue.close).toHaveBeenCalled());
    });

    it('keeps closing the rest when one fails', async () => {
      const client = buildClient();

      client.getQueue('auth.user.create');
      client.getQueue('auth.user.create@storage.file');
      queueInstances[0].close.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(client.onApplicationShutdown()).resolves.toBeUndefined();
      expect(queueInstances[1].close).toHaveBeenCalled();
    });

    it('drops the pool, so a later call rebuilds the queue', async () => {
      const client = buildClient();

      client.getQueue('auth.user.create');
      await client.onApplicationShutdown();
      client.getQueue('auth.user.create');

      expect(queueInstances).toHaveLength(2);
    });
  });
});
