/** Minimal stream declaration: everything else comes from `natsConfig.getStreamConfig()`. */
export type NatsStreamData = {
  name: string;
  subjects: string[];
};

/**
 * One controller method bound to one event. The pair drives both the JetStream durable
 * consumer the subscriber reads from and the Nest pattern the handler is registered under,
 * mirroring `RedisQueueSubscription` in `@backend/event-bus-redis`.
 */
export type NatsConsumerSubscription = {
  /**
   * The kebab-cased event id — the real NATS subject, e.g. `auth-user-create`. This is the
   * event's identity on the wire here, the way the dot-cased queue name is in `@backend/event-bus-redis`.
   */
  subject: string;
  consumerId: string;
  /** Nest pattern: `<subject>@<consumerId>`. Never leaves the process. */
  pattern: string;
  /** JetStream durable name, e.g. `storage-file-auth-user-create`. */
  durable: string;
  /** Overrides the global `NATS_CONSUMER_CONCURRENCY` (`max_ack_pending`) for this consumer. */
  concurrency?: number;
};
