import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { CacheStore } from '../../domain';
import { MemoryCacheStore } from '../stores';
import { CacheService } from './cache.service';

const buildService = (store: CacheStore = new MemoryCacheStore()): CacheService =>
  new CacheService(store, { keyPrefix: 'cache', namespace: 'auth', defaultTtl: 300 });

/** A store where every call fails — what a Redis outage looks like from up here. */
const buildBrokenStore = (): CacheStore => {
  const fail = (): Promise<never> => Promise.reject(new Error('connect ECONNREFUSED'));

  return {
    get: fail,
    set: fail,
    has: fail,
    delete: fail,
    deleteByPrefix: fail,
    increment: fail,
  } as unknown as CacheStore;
};

describe('CacheService', () => {
  let warn: MockInstance;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('keys', () => {
    it('prefixes and namespaces the key', () => {
      expect(buildService().buildKey('user:1')).toBe('cache:auth:user:1');
    });

    it('nests a scope under the parent namespace', () => {
      expect(buildService().scope('user').buildKey('1')).toBe('cache:auth:user:1');
    });

    it('writes through the namespaced key', async () => {
      const store = new MemoryCacheStore();

      await buildService(store).set('user:1', 'value');

      await expect(store.get('cache:auth:user:1')).resolves.toBe('value');
    });
  });

  describe('ttl', () => {
    it('applies the configured default', async () => {
      const store = new MemoryCacheStore();
      const set = vi.spyOn(store, 'set');

      await buildService(store).set('user:1', 'value');

      expect(set).toHaveBeenCalledWith('cache:auth:user:1', 'value', 300);
    });

    it('lets the call override it', async () => {
      const store = new MemoryCacheStore();
      const set = vi.spyOn(store, 'set');

      await buildService(store).set('user:1', 'value', 60);

      expect(set).toHaveBeenCalledWith('cache:auth:user:1', 'value', 60);
    });

    it('turns a zero default into no expiry at all', async () => {
      const store = new MemoryCacheStore();
      const set = vi.spyOn(store, 'set');

      await new CacheService(store, { keyPrefix: 'cache', defaultTtl: 0 }).set('user:1', 'value');

      expect(set).toHaveBeenCalledWith('cache:user:1', 'value', undefined);
    });
  });

  describe('deleteByPrefix', () => {
    it('clears the whole namespace when called bare — and only that namespace', async () => {
      const store = new MemoryCacheStore();

      await store.set('cache:auth:user:1', 1);
      await store.set('cache:auth:session:1', 2);
      // The reason the bare call appends the separator: `auth` must not eat `authors`.
      await store.set('cache:authors:1', 3);

      await expect(buildService(store).deleteByPrefix()).resolves.toBe(2);
      await expect(store.get('cache:authors:1')).resolves.toBe(3);
    });

    it('scopes a given prefix under the namespace', async () => {
      const store = new MemoryCacheStore();

      await store.set('cache:auth:user:1', 1);
      await store.set('cache:auth:session:1', 2);

      await expect(buildService(store).deleteByPrefix('user')).resolves.toBe(1);
      await expect(store.get('cache:auth:session:1')).resolves.toBe(2);
    });
  });

  describe('wrap', () => {
    it('serves a hit without calling the factory', async () => {
      const service = buildService();
      const factory = vi.fn(() => Promise.resolve('fresh'));

      await service.set('user:1', 'cached');

      await expect(service.wrap('user:1', factory)).resolves.toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('stores what the factory returned on a miss', async () => {
      const service = buildService();

      await expect(service.wrap('user:1', () => Promise.resolve('fresh'))).resolves.toBe('fresh');
      await expect(service.get('user:1')).resolves.toBe('fresh');
    });

    it('runs the factory once for concurrent misses of the same key', async () => {
      const service = buildService();
      const factory = vi.fn(() => Promise.resolve('fresh'));

      const results = await Promise.all([
        service.wrap('user:1', factory),
        service.wrap('user:1', factory),
        service.wrap('user:1', factory),
      ]);

      expect(results).toEqual(['fresh', 'fresh', 'fresh']);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('shares the in-flight call with a scope of the same key', async () => {
      const service = buildService();
      const factory = vi.fn(() => Promise.resolve('fresh'));

      await Promise.all([
        service.scope('user').wrap('1', factory),
        service.scope('user').wrap('1', factory),
      ]);

      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('lets a later call miss again once the first one settled', async () => {
      const service = buildService(buildBrokenStore());
      const factory = vi.fn(() => Promise.resolve('fresh'));

      await service.wrap('user:1', factory);
      await service.wrap('user:1', factory);

      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("propagates a factory failure — that one is the caller's real work", async () => {
      const service = buildService();

      await expect(
        service.wrap('user:1', () => Promise.reject(new Error('database is down'))),
      ).rejects.toThrow('database is down');
    });
  });

  describe('increment', () => {
    it('counts under the namespaced key and records a write', async () => {
      const store = new MemoryCacheStore();
      const increment = vi.spyOn(store, 'increment');
      const service = buildService(store);

      await service.increment('hits:1', 60_000);
      await expect(service.increment('hits:1', 60_000)).resolves.toMatchObject({ value: 2 });

      expect(increment).toHaveBeenCalledWith('cache:auth:hits:1', 60_000);
      expect(service.getMetrics().snapshot()).toMatchObject({ writes: 2 });
    });
  });

  // A cache is an optimisation: losing Redis must not fail a read Postgres can still answer.
  describe('fail-soft', () => {
    it('reads a broken store as a miss', async () => {
      await expect(buildService(buildBrokenStore()).get('user:1')).resolves.toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it('reports a failed write instead of throwing', async () => {
      await expect(buildService(buildBrokenStore()).set('user:1', 'value')).resolves.toBe(false);
    });

    it('answers has/delete/deleteByPrefix with their empty results', async () => {
      const service = buildService(buildBrokenStore());

      await expect(service.has('user:1')).resolves.toBe(false);
      await expect(service.delete('user:1')).resolves.toBe(0);
      await expect(service.deleteByPrefix()).resolves.toBe(0);
    });

    // A rate limit must see this, not a zero: "uncounted" is not "allowed".
    it('answers a failed increment with null and counts the error', async () => {
      const service = buildService(buildBrokenStore());

      await expect(service.increment('hits:1', 60_000)).resolves.toBeNull();
      expect(service.getMetrics().snapshot().errorsByOperation).toMatchObject({ increment: 1 });
    });

    it('still answers wrap from the factory', async () => {
      const service = buildService(buildBrokenStore());

      await expect(service.wrap('user:1', () => Promise.resolve('fresh'))).resolves.toBe('fresh');
    });

    it('names the operation and the failure in the log line', async () => {
      await buildService(buildBrokenStore()).get('user:1');

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache get failed for "user:1": connect ECONNREFUSED'),
      );
    });
  });

  // The log line is the only other trace a swallowed failure leaves, and nothing alerts on it.
  describe('metrics', () => {
    it('counts a hit and a miss apart', async () => {
      const service = buildService();

      await service.set('user:1', 'value');
      await service.get('user:1');
      await service.get('user:2');

      expect(service.getMetrics().snapshot()).toMatchObject({ hits: 1, misses: 1, writes: 1 });
    });

    it('counts a swallowed failure as both an error and a miss', async () => {
      const service = buildService(buildBrokenStore());

      await service.get('user:1');
      await service.deleteByPrefix();

      const snapshot = service.getMetrics().snapshot();

      expect(snapshot).toMatchObject({ errors: 2, hits: 0, misses: 0, writes: 0 });
      expect(snapshot.errorsByOperation).toMatchObject({ get: 1, deleteByPrefix: 1 });
    });

    it('counts a failed write as an error rather than a write', async () => {
      const service = buildService(buildBrokenStore());

      await expect(service.set('user:1', 'value')).resolves.toBe(false);

      expect(service.getMetrics().snapshot()).toMatchObject({ writes: 0, errors: 1 });
    });

    it('shares one set of counters with every scope', async () => {
      const service = buildService();

      await service.scope('user').set('1', 'value');
      await service.scope('session').get('1');

      expect(service.getMetrics().snapshot()).toMatchObject({ writes: 1, misses: 1 });
      expect(service.scope('user').getMetrics()).toBe(service.getMetrics());
    });
  });
});
