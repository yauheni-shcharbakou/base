/** Which adapter backs the store. `memory` is process-local — dev and tests only. */
export type CacheDriver = 'redis' | 'memory';

/** The `CacheStore` methods, named so a failure counter cannot be keyed by a typo. */
export type CacheOperation = 'get' | 'set' | 'has' | 'delete' | 'deleteByPrefix' | 'increment';

/** A counter after `increment`: its new value and how long its current window has left. */
export type CacheCounter = {
  value: number;
  /** Milliseconds until the counter expires and the next `increment` starts from 1. */
  ttlMs: number;
};

export type CacheServiceOptions = {
  /** First key segment, shared by every process (`CACHE_KEY_PREFIX`). */
  keyPrefix: string;
  /** Second key segment, usually the service name. Scopes add further segments. */
  namespace?: string;
  /** Seconds. `0` (or a missing value) stores without an expiry. */
  defaultTtl?: number;
};
