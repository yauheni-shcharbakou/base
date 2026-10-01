import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisQueueClient } from '../clients';
import { buildFanOutJobId } from '../constants';
import { RedisParkedEvent, RedisParkingOptions, RedisQueueSubscription } from '../types';

export type RedisParkingParams = {
  connection: Redis;
  client: RedisQueueClient;
  getParkingKey: (eventId: string) => string;
  options: RedisParkingOptions;
};

/**
 * Holding buffer for events that reached the mediator while nobody was subscribed to them.
 *
 * Dropping them — the previous behaviour — silently loses the events emitted between the
 * first deploy of a new consumer and the moment it publishes its subscription. Failing the
 * job instead is not an option either: an event with no subscriber at all would exhaust its
 * ten attempts and fill the DLQ. So the job is
 * completed and its payload is parked, then replayed into a consumer's queue the first time
 * that consumer registers.
 *
 * The store is a plain Redis list rather than a queue: nothing consumes it in the background,
 * it is read once at a subscriber's first bootstrap. It is bounded on both axes — `LTRIM`
 * caps the entry count, `EXPIRE` caps their age — so events that will never gain a subscriber
 * cost a fixed amount of memory instead of growing forever.
 */
export class RedisParkingService {
  private readonly logger = new Logger(RedisParkingService.name);

  constructor(private readonly params: RedisParkingParams) {}

  isEnabled(): boolean {
    return this.params.options.maxLength > 0;
  }

  /**
   * Errors are propagated on purpose: the caller is a mediator job, so a failed push marks
   * the job failed and BullMQ retries the whole fan-out.
   */
  async park(eventId: string, event: RedisParkedEvent): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const key = this.params.getParkingKey(eventId);
    const { maxLength, ttlSeconds } = this.params.options;

    await this.params.connection
      .pipeline()
      .rpush(key, JSON.stringify(event))
      // Keep the newest `maxLength` entries; the oldest are the least likely to still matter.
      .ltrim(key, -maxLength, -1)
      .expire(key, ttlSeconds)
      .exec();
  }

  /**
   * Replays the parked events of every given subscription into its own queue. Called with the
   * subscriptions that were registered for the very first time, so a restart of a known
   * consumer replays nothing.
   *
   * The read is non-destructive: two brand-new consumers of the same event both need the same
   * entries, and there is no safe moment to delete them for everyone. The TTL does the cleanup.
   *
   * Never throws — a failed replay must not take the bootstrap down with it. The entries stay
   * where they are and the next start tries again.
   */
  async replay(subscriptions: RedisQueueSubscription[]): Promise<void> {
    if (!this.isEnabled() || !subscriptions.length) {
      return;
    }

    for (const subscription of subscriptions) {
      try {
        await this.replayOne(subscription);
      } catch (error) {
        this.logger.warn(
          `Failed to replay the parked events of "${subscription.queueName}"`,
          error,
        );
      }
    }
  }

  private async replayOne(subscription: RedisQueueSubscription): Promise<void> {
    const entries = await this.params.connection.lrange(
      this.params.getParkingKey(subscription.eventId),
      0,
      -1,
    );

    const events = entries.reduce((acc: RedisParkedEvent[], entry) => {
      const event = this.parse(entry, subscription.eventId);

      if (event) {
        acc.push(event);
      }

      return acc;
    }, []);

    if (!events.length) {
      return;
    }

    await this.params.client.getQueue(subscription.queueName).addBulk(
      events.map((event) => ({
        name: subscription.eventId,
        data: event.data,
        // Same deterministic id the mediator's fan-out uses, so an event that was both
        // parked and fanned out normally is only delivered once.
        opts: event.id ? { jobId: buildFanOutJobId(subscription.eventId, event.id) } : {},
      })),
    );

    this.logger.log(`Replayed ${events.length} parked event(s) into "${subscription.queueName}"`);
  }

  private parse(entry: string, eventId: string): RedisParkedEvent | null {
    try {
      return JSON.parse(entry) as RedisParkedEvent;
    } catch {
      // One unreadable entry must not cost the others their replay.
      this.logger.warn(`Skipped an unreadable parked entry of "${eventId}"`);
      return null;
    }
  }
}
