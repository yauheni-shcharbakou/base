import { CacheService } from '@backend/cache';
import { OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

// Not re-exported by the package root.
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * The throttler's counters in Redis, through `@backend/cache`, so every gateway replica counts
 * against one limit and a restart does not reset it.
 *
 * - **Fixed window.** A counter is `CacheService.increment`: the first hit starts `ttl`, the key
 *   expires, the next hit starts over. `blockDuration` is read as `ttl` — a caller over the limit
 *   stays blocked until its window ends; the gateway's options never set a different one.
 * - **Outage.** The cache fails soft and answers `null`; the hit then goes to an in-process
 *   `ThrottlerStorageService`, so the limit still holds per replica rather than lapsing.
 *
 * @see docs/adr/0024-gateway-rate-limit-counters-in-redis.md
 */
export class CacheThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  constructor(
    private readonly cache: CacheService,
    private readonly fallback = new ThrottlerStorageService(),
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // `buildCacheKey` splits on `:` and drops the blanks, which would fold IPv6 trackers
    // (`ip:::1`, `2001:db8::1` vs `2001:db8:1`) into one another.
    const counter = await this.cache.increment(encodeURIComponent(key), ttl);

    if (!counter) {
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }

    const timeToExpire = Math.ceil(counter.ttlMs / 1000);
    const isBlocked = counter.value > limit;

    return {
      totalHits: counter.value,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    };
  }

  // The fallback's expiry timers would otherwise outlive the app.
  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
