import { CacheCounter } from '../types';

/**
 * The adapter contract — the only thing that changes when the cache moves off Redis.
 *
 * Keys arrive fully built: prefixing, namespacing and the default TTL are `CacheService`'s
 * job, so an adapter never has to reproduce them. Values are opaque; how they are encoded
 * is the adapter's business (both current ones use the shared `CacheSerializer`).
 *
 * Implementations may throw — `CacheService` is the layer that swallows and logs, so that
 * a cache outage degrades to a miss instead of failing the caller.
 */
export abstract class CacheStore {
  abstract get<Value>(key: string): Promise<Value | null>;
  /** `ttlSeconds` undefined or `0` stores the entry without an expiry. */
  abstract set<Value>(key: string, value: Value, ttlSeconds?: number): Promise<void>;
  abstract has(key: string): Promise<boolean>;
  /** @returns how many of the given keys existed. */
  abstract delete(...keys: string[]): Promise<number>;
  /** @returns how many keys were removed. */
  abstract deleteByPrefix(prefix: string): Promise<number>;
  /**
   * Adds one to a counter, atomically — concurrent callers on any number of processes each see a
   * distinct value. A **fixed window**: the first increment starts the `windowMs` expiry, later
   * ones do not extend it.
   *
   * The counter is stored as a bare integer, not through `CacheSerializer`, so only `increment`
   * reads it back; `get` on the same key answers a miss.
   */
  abstract increment(key: string, windowMs: number): Promise<CacheCounter>;
}
