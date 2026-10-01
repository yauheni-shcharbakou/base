import { resolveErrorMessage } from '@backend/common';
import { Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { CACHE_ERROR_FALLBACK } from '../constants';

/**
 * Owns the cache's own ioredis connection — deliberately not the one
 * `@backend/event-bus-redis` opens: sharing it would make the cache unusable without the
 * event bus, and would drag bullmq into a service that only wants a key-value store.
 *
 * Registered last in the module so its shutdown hook runs after the store's.
 */
export class CacheConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(CacheConnectionService.name);
  private readonly client: Redis;
  private outageReported = false;

  constructor(url: string, options: RedisOptions) {
    this.client = new Redis(url, options);
    this.watchConnection();
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Resolves once the socket is usable, rejects when it is not within `timeoutMs`.
   *
   * **Nothing in the module calls this**, and that is the point: waiting for the cache at boot
   * would make an optional dependency a required one. It exists for a caller that genuinely has
   * to observe a connected client — the e2e suite, or a health endpoint — because with
   * `enableOfflineQueue: false` a command sent before `ready` is answered as a miss rather than
   * held.
   */
  waitUntilReady(timeoutMs: number): Promise<void> {
    if (this.client.status === 'ready') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.client.off('ready', onReady);
        reject(new Error(`The cache connection was not ready within ${timeoutMs}ms`));
      }, timeoutMs);

      const onReady = (): void => {
        clearTimeout(timer);
        resolve();
      };

      this.client.once('ready', onReady);
    });
  }

  /**
   * Without an `error` listener ioredis falls back to `console.error`, and it does so on every
   * reconnect attempt — a `[ioredis] Unhandled error event` stack every two seconds for as long
   * as the outage lasts, outside the app logger entirely.
   *
   * So: one line when the connection breaks, silence while it keeps failing, one line when it
   * comes back. Per-command failures are `CacheService`'s business, counted on `CacheMetrics`.
   */
  private watchConnection(): void {
    this.client.on('error', (error: Error) => {
      if (this.outageReported) {
        return;
      }

      this.outageReported = true;
      this.logger.error(
        `Cache Redis connection lost: ${resolveErrorMessage(error, CACHE_ERROR_FALLBACK)}`,
      );
    });

    this.client.on('ready', () => {
      if (!this.outageReported) {
        return;
      }

      this.outageReported = false;
      this.logger.log('Cache Redis connection restored');
    });
  }

  /**
   * `quit()` is a command, not a socket operation: on a client that is not `ready` it waits in
   * the offline queue, which on a shutdown *because* Redis went away means waiting forever.
   * So only a ready client gets the graceful goodbye, and either way the socket is torn down —
   * a short-lived process that closes while still connecting would otherwise leave a handle
   * open and never exit.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'ready') {
      this.client.disconnect();

      return;
    }

    try {
      await this.client.quit();
    } catch (error) {
      this.logger.warn('Failed to close the cache Redis connection', error);
    } finally {
      this.client.disconnect();
    }
  }
}
