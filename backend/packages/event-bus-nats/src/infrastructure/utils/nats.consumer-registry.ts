import { NatsConsumerSubscription } from '../types';

/**
 * Accumulates `event -> controller` subscriptions as `@NatsController()` runs on class load,
 * the same way `globalStreamRegistry` accumulates JetStream streams and
 * `globalQueueRegistry` accumulates queues in `@backend/event-bus-redis`.
 *
 * The server strategy reads it at `listen()` to create one durable consumer per entry.
 */
export class NatsConsumerRegistry {
  private readonly subscriptionByPattern = new Map<string, NatsConsumerSubscription>();

  append(subscription: NatsConsumerSubscription) {
    this.subscriptionByPattern.set(subscription.pattern, subscription);
  }

  getSubscriptions(): NatsConsumerSubscription[] {
    return Array.from(this.subscriptionByPattern.values());
  }

  getPatterns(): string[] {
    return Array.from(this.subscriptionByPattern.keys());
  }

  /** Only for tests — the registry is a module singleton shared by every spec file. */
  clear(): void {
    this.subscriptionByPattern.clear();
  }
}
