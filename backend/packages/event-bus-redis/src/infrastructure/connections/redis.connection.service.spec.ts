import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { RedisConnectionService } from './redis.connection.service';

/** Enough of an ioredis client to drive the three things this service reacts to. */
class FakeRedis extends EventEmitter {
  status = 'connecting';
  options = { connectionName: 'auth-redis-client' };
  quit = jest.fn(() => Promise.resolve('OK'));
  disconnect = jest.fn();

  becomeReady(): void {
    this.status = 'ready';
    this.emit('ready');
  }
}

const clients: FakeRedis[] = [];

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const client = new FakeRedis();
    clients.push(client);

    return client;
  }),
}));

const buildService = (): { service: RedisConnectionService; client: FakeRedis } => {
  const service = new RedisConnectionService('redis://localhost:6379', {});

  return { service, client: clients[clients.length - 1] };
};

describe('RedisConnectionService', () => {
  let error: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(() => {
    clients.length = 0;
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * The gate exists because this connection runs with `maxRetriesPerRequest: null`: a command
   * against an unreachable broker waits in the offline queue forever instead of failing, so a
   * bootstrap that skips the gate hangs rather than starting or dying.
   */
  describe('waitUntilReady', () => {
    it('resolves immediately on a ready client', async () => {
      const { service, client } = buildService();
      client.status = 'ready';

      await expect(service.waitUntilReady(50)).resolves.toBeUndefined();
    });

    it('resolves as soon as the client connects', async () => {
      const { service, client } = buildService();

      const ready = service.waitUntilReady(1000);
      client.becomeReady();

      await expect(ready).resolves.toBeUndefined();
    });

    it('rejects on timeout, naming the client but never the url', async () => {
      const { service } = buildService();

      await expect(service.waitUntilReady(20)).rejects.toThrow(
        'Redis connection "auth-redis-client" was not ready within 20ms',
      );
      // The url may carry a password — it must not reach a log line.
      await expect(service.waitUntilReady(20)).rejects.not.toThrow(/redis:\/\//);
    });
  });

  describe('connection logging', () => {
    it('reports an outage once, however many reconnects fail', () => {
      const { client } = buildService();

      client.emit('error', new Error('connect ECONNREFUSED'));
      client.emit('error', new Error('connect ECONNREFUSED'));
      client.emit('error', new Error('connect ECONNREFUSED'));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Redis connection "auth-redis-client" lost: connect ECONNREFUSED'),
      );
    });

    it('reports the recovery, and the next outage after it', () => {
      const { client } = buildService();

      client.emit('error', new Error('connect ECONNREFUSED'));
      client.becomeReady();
      client.emit('error', new Error('connect ECONNREFUSED'));

      expect(log).toHaveBeenCalledWith('Redis connection "auth-redis-client" restored');
      expect(error).toHaveBeenCalledTimes(2);
    });

    it('says nothing when a healthy client becomes ready', () => {
      const { client } = buildService();

      client.becomeReady();

      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('says goodbye properly when the client is ready', async () => {
      const { service, client } = buildService();
      client.status = 'ready';

      await service.onApplicationShutdown();

      expect(client.quit).toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });

    // `quit` is a command: on a client that is not ready it joins the offline queue and, during
    // an outage, waits forever — the process would then ignore its own SIGTERM.
    it('tears the socket down without a command when the client is not ready', async () => {
      const { service, client } = buildService();

      await service.onApplicationShutdown();

      expect(client.quit).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('still disconnects when the goodbye fails', async () => {
      const { service, client } = buildService();
      client.status = 'ready';
      client.quit.mockRejectedValueOnce(new Error('Connection is closed'));

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
      expect(client.disconnect).toHaveBeenCalled();
    });
  });
});
