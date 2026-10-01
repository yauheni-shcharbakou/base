import { resolveErrorMessage } from '@backend/common';
import { Logger, OnApplicationShutdown } from '@nestjs/common';
import { Job, JobsOptions, Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_ERROR_FALLBACK } from '../constants';
import { withRedisTimeout } from '../utils';

/**
 * Producer side of the adapter: a lazily built pool of BullMQ queues over the shared
 * connection. Replaces `NatsJetStreamClientProxy` — the generated
 * `Redis<Service>EventBusClientImpl` classes emit through it, and the mediator uses
 * `getQueue()` to fan a job out into the subscriber queues.
 */
export class RedisQueueClient implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisQueueClient.name);
  private readonly queueByName = new Map<string, Queue>();

  constructor(
    private readonly connection: Redis,
    private readonly queueOptions: Omit<QueueOptions, 'connection'>,
    private readonly commandTimeoutMs: number,
  ) {}

  getQueue(queueName: string): Queue {
    const existingQueue = this.queueByName.get(queueName);

    if (existingQueue) {
      return existingQueue;
    }

    const queue = new Queue(queueName, { ...this.queueOptions, connection: this.connection });
    this.queueByName.set(queueName, queue);

    return queue;
  }

  /**
   * Bounded, because an emit is awaited inside a use-case, which is awaited inside a gRPC
   * handler: against a dead broker the command sits in the offline queue and the caller is left
   * with no answer at all. Failing is the better answer — a lost `user.create` is recoverable
   * from nowhere, so the write that could not announce itself must be visible to whoever made it.
   *
   * The fan-out inside the mediator deliberately uses the raw `getQueue()`: it runs in a worker,
   * not a request, and picking up where it left off once the broker returns is correct there.
   */
  emit<Event>(eventId: string, event: Event, options?: JobsOptions): Promise<Job<Event>> {
    return withRedisTimeout(
      this.getQueue(eventId).add(eventId, event, options),
      this.commandTimeoutMs,
      `Emitting "${eventId}"`,
    );
  }

  emitMany<Event>(eventId: string, events: Event[], options?: JobsOptions): Promise<Job<Event>[]> {
    if (!events.length) {
      return Promise.resolve([]);
    }

    return withRedisTimeout(
      this.getQueue(eventId).addBulk(
        events.map((event) => ({ name: eventId, data: event, opts: options })),
      ),
      this.commandTimeoutMs,
      `Emitting "${eventId}"`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.queueByName.values()).map(async (queue) => {
        try {
          // Closes the queue only — the shared connection was passed in, so BullMQ leaves it
          // open. Bounded: `close()` talks to Redis, and a shutdown *because* Redis went away
          // would otherwise leave the process ignoring its own SIGTERM.
          await withRedisTimeout(
            queue.close(),
            this.commandTimeoutMs,
            `Closing the queue "${queue.name}"`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to close the queue "${queue.name}": ${resolveErrorMessage(error, REDIS_ERROR_FALLBACK)}`,
          );
        }
      }),
    );

    this.queueByName.clear();
  }
}
