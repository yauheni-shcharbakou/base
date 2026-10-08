import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'reflect-metadata';
import { CacheService, CacheStore, MemoryCacheStore } from '@backend/cache';
import { Logger } from '@nestjs/common';
import { CacheThrottlerStorage } from './cache.throttler.storage';

const TTL = 60_000;
const LIMIT = 2;

const buildCache = (store: CacheStore): CacheService =>
  new CacheService(store, { keyPrefix: 'cache', namespace: 'api-gateway' }).scope('throttle');

/** What a Redis outage looks like from the storage: every counter call fails. */
class BrokenStore extends MemoryCacheStore {
  increment(): Promise<never> {
    return Promise.reject(new Error('connect ECONNREFUSED'));
  }
}

describe('CacheThrottlerStorage', () => {
  let store: MemoryCacheStore;
  let storage: CacheThrottlerStorage;

  const hit = (key: string) => storage.increment(key, TTL, LIMIT, TTL, 'default');

  beforeEach(() => {
    store = new MemoryCacheStore();
    storage = new CacheThrottlerStorage(buildCache(store));
  });

  afterEach(() => {
    storage.onApplicationShutdown();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('counts in the cache and blocks past the limit until the window ends', async () => {
    await expect(hit('default:user:u1')).resolves.toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    await hit('default:user:u1');

    await expect(hit('default:user:u1')).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('starts a new window once the old one has passed', async () => {
    vi.useFakeTimers();

    await hit('default:user:u1');
    await hit('default:user:u1');
    await hit('default:user:u1');

    vi.advanceTimersByTime(TTL);

    await expect(hit('default:user:u1')).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
  });

  // The cache key builder drops blank `:` segments, which would fold these two into one.
  it('keeps IPv6 trackers apart', async () => {
    const increment = vi.spyOn(store, 'increment');

    await hit('default:ip:2001:db8::1');
    await hit('default:ip:2001:db8::1');

    await expect(hit('default:ip:2001:db8:1')).resolves.toMatchObject({ totalHits: 1 });
    expect(increment).toHaveBeenCalledWith(
      'cache:api-gateway:throttle:default%3Aip%3A2001%3Adb8%3A%3A1',
      TTL,
    );
  });

  // "Uncounted" must not mean "allowed": the limit falls back to this process.
  it('keeps limiting in-process when the cache fails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    storage = new CacheThrottlerStorage(buildCache(new BrokenStore()));

    await hit('default:ip:203.0.113.7');
    await hit('default:ip:203.0.113.7');

    await expect(hit('default:ip:203.0.113.7')).resolves.toMatchObject({
      totalHits: 3,
      isBlocked: true,
    });
  });
});
