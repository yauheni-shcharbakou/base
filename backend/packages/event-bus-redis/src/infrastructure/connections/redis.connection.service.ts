import { resolveErrorMessage } from '@backend/common';
import { Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_ERROR_FALLBACK } from '../constants';

/**
 * Owns the single shared ioredis connection. Queues reuse it as-is; BullMQ workers
 * duplicate it internally for their blocking commands, so each worker still costs
 * one extra connection.
 */
export class RedisConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisConnectionService.name);
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
   * Needed because this connection runs with `maxRetriesPerRequest: null` (BullMQ's requirement
   * for blocking commands): a command issued against an unreachable server waits in the offline
   * queue **forever** rather than failing. Bootstrapping straight into `publish()` therefore
   * hangs the whole service instead of starting or dying, so every entry point waits here first.
   *
   * The URL is deliberately absent from the message — it can carry a password.
   */
  waitUntilReady(timeoutMs: number): Promise<void> {
    if (this.client.status === 'ready') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.client.off('ready', onReady);
        reject(
          new Error(`Redis connection "${this.clientName()}" was not ready within ${timeoutMs}ms`),
        );
      }, timeoutMs);

      const onReady = (): void => {
        clearTimeout(timer);
        resolve();
      };

      this.client.once('ready', onReady);
    });
  }

  /**
   * `quit()` is a command, not a socket operation: on a client that is not `ready` it waits in
   * the offline queue, which on a shutdown *because* Redis went away means waiting forever — the
   * process then ignores its own SIGTERM. So only a ready client gets the graceful goodbye, and
   * either way the socket is torn down.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'ready') {
      this.client.disconnect();

      return;
    }

    try {
      await this.client.quit();
    } catch (error) {
      this.logger.warn('Failed to close the Redis connection', error);
    } finally {
      this.client.disconnect();
    }
  }

  private clientName(): string {
    return this.client.options.connectionName ?? 'event-bus';
  }

  /**
   * Without an `error` listener ioredis falls back to `console.error` on every reconnect
   * attempt — a raw stack every two seconds, outside the app logger. One line per outage, one
   * when it heals; the per-job failures are the workers' business.
   */
  private watchConnection(): void {
    this.client.on('error', (error: Error) => {
      if (this.outageReported) {
        return;
      }

      this.outageReported = true;
      this.logger.error(
        `Redis connection "${this.clientName()}" lost: ${resolveErrorMessage(error, REDIS_ERROR_FALLBACK)}`,
      );
    });

    this.client.on('ready', () => {
      if (!this.outageReported) {
        return;
      }

      this.outageReported = false;
      this.logger.log(`Redis connection "${this.clientName()}" restored`);
    });
  }
}
