import { RedisQueueSubscription } from '../types';

/**
 * Accumulates `event -> controller` subscriptions as `@RedisController()` runs on
 * class load, the same way `NatsStreamRegistry` accumulates JetStream streams.
 *
 * Two consumers read it at bootstrap: the server strategy (one worker per entry)
 * and the subscription registry (publishes the entries into Redis so mediators in
 * other processes can fan out to them).
 */
export class RedisQueueRegistry {
  private readonly subscriptionByQueueName = new Map<string, RedisQueueSubscription>();

  append(subscription: RedisQueueSubscription) {
    this.subscriptionByQueueName.set(subscription.queueName, subscription);
  }

  getSubscriptions(): RedisQueueSubscription[] {
    return Array.from(this.subscriptionByQueueName.values());
  }

  getQueueNames(): string[] {
    return Array.from(this.subscriptionByQueueName.keys());
  }

  /** Only for tests — the registry is a module singleton shared by every spec file. */
  clear(): void {
    this.subscriptionByQueueName.clear();
  }
}
