/**
 * One controller method bound to one event: the pair drives both the queue the
 * consumer worker listens on and the entry published into the Redis-backed
 * subscription registry the mediator reads.
 */
export type RedisQueueSubscription = {
  eventId: string;
  consumerId: string;
  queueName: string;
  /** Overrides the global `REDIS_WORKER_CONCURRENCY` for this subscription's worker. */
  concurrency?: number;
};

/** Bounds of the parking list: it is a buffer, never a queue, so it is capped both ways. */
export type RedisParkingOptions = {
  /** Entries kept per event; 0 disables parking altogether. */
  maxLength: number;
  /** Key expiry, refreshed on every push. */
  ttlSeconds: number;
};

/** One event held back because it had no consumers at fan-out time. */
export type RedisParkedEvent = {
  /** Source job id, reused to build a deterministic job id on replay. */
  id?: string;
  data: unknown;
};
