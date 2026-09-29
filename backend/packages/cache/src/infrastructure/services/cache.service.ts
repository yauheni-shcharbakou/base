import { resolveErrorMessage } from '@backend/common';
import { Logger } from '@nestjs/common';
import { CacheCounter, CacheOperation, CacheServiceOptions, CacheStore } from '../../domain';
import { CACHE_ERROR_FALLBACK, CACHE_KEY_SEPARATOR } from '../constants';
import { CacheMetrics } from '../metrics';
import { buildCacheKey } from '../utils';

/**
 * What services inject. Adapter-agnostic on purpose: everything below it is the `CacheStore`
 * port, everything above it never learns which driver is running.
 *
 * It owns three things an adapter should not have to repeat:
 *
 * - **key layout** — `<CACHE_KEY_PREFIX>:<namespace>:<key>`, so two services sharing one Redis
 *   cannot collide and a namespace can be dropped in one scan;
 * - **fail-soft** — a store error is logged, counted on `CacheMetrics` and turned into a miss
 *   (`get` → `null`, `set` → `false`, `delete*` → `0`, `increment` → `null`, `wrap` → the
 *   factory's own value). A cache is an optimisation; losing Redis must not fail a read that
 *   Postgres can still answer. Errors thrown by the `wrap` factory are *not* swallowed — those
 *   are the caller's real work;
 * - **single-flight `wrap`** — N concurrent misses of the same key run the factory once.
 */
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly store: CacheStore,
    private readonly options: CacheServiceOptions,
    /** Shared with every scope: the connection is up or down for all of them at once. */
    private readonly metrics = new CacheMetrics(),
    /**
     * Shared with every scope created from this instance, so two scopes of the same key
     * still dedupe. Keyed by the full key, so different namespaces never do.
     */
    private readonly inFlight = new Map<string, Promise<unknown>>(),
  ) {}

  /** A child bound to a deeper namespace: `cache.scope('user')` → `cache:auth:user:…`. */
  scope(namespace: string): CacheService {
    return new CacheService(
      this.store,
      { ...this.options, namespace: buildCacheKey(this.options.namespace, namespace) },
      this.metrics,
      this.inFlight,
    );
  }

  /**
   * The counters this instance shares with its scopes. `CacheMetrics` is a module provider too,
   * so a consumer that only wants the numbers can inject it directly.
   */
  getMetrics(): CacheMetrics {
    return this.metrics;
  }

  /** The key as it is written in the store — useful in logs and specs. */
  buildKey(key: string): string {
    return buildCacheKey(this.options.keyPrefix, this.options.namespace, key);
  }

  async get<Value>(key: string): Promise<Value | null> {
    try {
      const value = await this.store.get<Value>(this.buildKey(key));

      if (value === null) {
        this.metrics.recordMiss();
      } else {
        this.metrics.recordHit();
      }

      return value;
    } catch (error) {
      this.warn('get', key, error);

      return null;
    }
  }

  /** @returns whether the value was actually stored. */
  async set<Value>(key: string, value: Value, ttlSeconds?: number): Promise<boolean> {
    try {
      await this.store.set(this.buildKey(key), value, this.resolveTtl(ttlSeconds));
      this.metrics.recordWrite();

      return true;
    } catch (error) {
      this.warn('set', key, error);

      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return await this.store.has(this.buildKey(key));
    } catch (error) {
      this.warn('has', key, error);

      return false;
    }
  }

  async delete(...keys: string[]): Promise<number> {
    try {
      return await this.store.delete(...keys.map((key) => this.buildKey(key)));
    } catch (error) {
      this.warn('delete', keys.join(', '), error);

      return 0;
    }
  }

  /**
   * Called with no argument it clears the whole namespace; with one, it removes every key
   * whose name *starts with* the built prefix — a literal prefix, not a segment path, so
   * `deleteByPrefix('user')` also drops `user-drafts:…`. Name the segment fully when that
   * matters.
   */
  async deleteByPrefix(prefix = ''): Promise<number> {
    const scoped = this.buildKey(prefix);

    // The namespace itself needs the separator appended, or clearing `auth` would also wipe
    // `authors`.
    const pattern = prefix.trim() ? scoped : `${scoped}${CACHE_KEY_SEPARATOR}`;

    try {
      return await this.store.deleteByPrefix(pattern);
    } catch (error) {
      this.warn('deleteByPrefix', pattern, error);

      return 0;
    }
  }

  /**
   * Adds one to a fixed-window counter (see `CacheStore.increment`). `null` when the store
   * failed — the caller decides what an uncounted hit means; for a rate limit that is not
   * "allowed".
   */
  async increment(key: string, windowMs: number): Promise<CacheCounter | null> {
    try {
      const counter = await this.store.increment(this.buildKey(key), windowMs);
      this.metrics.recordWrite();

      return counter;
    } catch (error) {
      this.warn('increment', key, error);

      return null;
    }
  }

  /**
   * Get-or-set. On a miss the factory runs once even if several callers race, and the result
   * is cached before it is returned.
   *
   * A stored `null` is indistinguishable from a miss, so it is recomputed rather than served
   * — there is no negative caching. Cache a wrapper object when "nothing" is the answer worth
   * keeping.
   */
  async wrap<Value>(
    key: string,
    factory: () => Promise<Value>,
    ttlSeconds?: number,
  ): Promise<Value> {
    const cached = await this.get<Value>(key);

    if (cached !== null) {
      return cached;
    }

    const fullKey = this.buildKey(key);
    const pending = this.inFlight.get(fullKey) as Promise<Value> | undefined;

    if (pending !== undefined) {
      return pending;
    }

    const promise = factory()
      .then(async (value): Promise<Value> => {
        await this.set(key, value, ttlSeconds);

        return value;
      })
      .finally(() => {
        this.inFlight.delete(fullKey);
      });

    this.inFlight.set(fullKey, promise);

    return promise;
  }

  /** `0` (the configured default included) means "no expiry", which the stores read as undefined. */
  private resolveTtl(ttlSeconds?: number): number | undefined {
    const ttl = ttlSeconds ?? this.options.defaultTtl ?? 0;

    return ttl > 0 ? ttl : undefined;
  }

  /** The single place a swallowed failure passes through, so it is also the place it is counted. */
  private warn(operation: CacheOperation, key: string, error: unknown): void {
    this.metrics.recordError(operation);
    this.logger.warn(
      `Cache ${operation} failed for "${key}": ${resolveErrorMessage(error, CACHE_ERROR_FALLBACK)}`,
    );
  }
}
