import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { CacheConnectionService } from './cache.connection.service';

/** Enough of an ioredis client to drive the three things this service reacts to. */
class FakeRedis extends EventEmitter {
  status = 'connecting';
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

const buildService = (): { service: CacheConnectionService; client: FakeRedis } => {
  const service = new CacheConnectionService('redis://localhost:6379', {});

  return { service, client: clients[clients.length - 1] };
};

describe('CacheConnectionService', () => {
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
   * Without a listener ioredis prints a raw `[ioredis] Unhandled error event` stack on every
   * reconnect attempt — outside the app logger, once every couple of seconds, for as long as
   * the outage lasts.
   */
  describe('connection logging', () => {
    it('reports an outage once, however many reconnects fail', () => {
      const { client } = buildService();

      client.emit('error', new Error('connect ECONNREFUSED'));
      client.emit('error', new Error('connect ECONNREFUSED'));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Cache Redis connection lost: connect ECONNREFUSED'),
      );
    });

    it('reports the recovery, and the next outage after it', () => {
      const { client } = buildService();

      client.emit('error', new Error('connect ECONNREFUSED'));
      client.becomeReady();
      client.emit('error', new Error('connect ECONNREFUSED'));

      expect(log).toHaveBeenCalledWith('Cache Redis connection restored');
      expect(error).toHaveBeenCalledTimes(2);
    });

    it('says nothing when a healthy client becomes ready', () => {
      buildService().client.becomeReady();

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
    // an outage, waits forever.
    it('tears the socket down without a command when the client is not ready', async () => {
      const { service, client } = buildService();

      await service.onApplicationShutdown();

      expect(client.quit).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });
  });
});
