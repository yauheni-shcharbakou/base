import { describe, expect, it, type Mock, vi } from 'vitest';
import type Redis from 'ioredis';
import { CACHE_INCREMENT_SCRIPT } from '../constants';
import { RedisCacheStore } from './redis.cache.store';

type RedisStub = {
  get: Mock;
  set: Mock;
  exists: Mock;
  unlink: Mock;
  scan: Mock;
  keys: Mock;
  eval: Mock;
};

const buildStub = (): RedisStub => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve('OK')),
  exists: vi.fn(() => Promise.resolve(0)),
  unlink: vi.fn((...keys: string[]) => Promise.resolve(keys.length)),
  scan: vi.fn(() => Promise.resolve(['0', []])),
  keys: vi.fn(() => Promise.resolve([])),
  eval: vi.fn(() => Promise.resolve([1, 60_000])),
});

const buildStore = (client: RedisStub): RedisCacheStore =>
  new RedisCacheStore(client as unknown as Redis, 100);

describe('RedisCacheStore', () => {
  describe('set', () => {
    it('passes the TTL as an EX argument', async () => {
      const client = buildStub();

      await buildStore(client).set('cache:auth:user:1', { id: '1' }, 60);

      expect(client.set).toHaveBeenCalledWith(
        'cache:auth:user:1',
        JSON.stringify({ value: { id: '1' } }),
        'EX',
        60,
      );
    });

    it.each([
      ['no TTL', undefined],
      ['a zero TTL', 0],
    ])('stores without an expiry for %s', async (_name, ttl) => {
      const client = buildStub();

      await buildStore(client).set('cache:auth:user:1', 'value', ttl);

      expect(client.set).toHaveBeenCalledWith(
        'cache:auth:user:1',
        JSON.stringify({ value: 'value' }),
        // No trailing EX pair.
      );
    });
  });

  describe('get', () => {
    it('deserializes a hit', async () => {
      const client = buildStub();

      client.get.mockResolvedValueOnce(JSON.stringify({ value: { id: '1' } }));

      await expect(buildStore(client).get('cache:auth:user:1')).resolves.toEqual({ id: '1' });
    });

    it('reads a missing key as null', async () => {
      await expect(buildStore(buildStub()).get('cache:auth:user:1')).resolves.toBeNull();
    });
  });

  describe('has', () => {
    it('maps the EXISTS count to a boolean', async () => {
      const client = buildStub();

      client.exists.mockResolvedValueOnce(1);

      await expect(buildStore(client).has('cache:auth:user:1')).resolves.toBe(true);
      await expect(buildStore(client).has('cache:auth:user:2')).resolves.toBe(false);
    });
  });

  describe('delete', () => {
    // UNLINK frees the memory on a background thread; DEL blocks the server while it does.
    it('unlinks the keys rather than DELeting them', async () => {
      const client = buildStub();

      await expect(buildStore(client).delete('a', 'b')).resolves.toBe(2);
      expect(client.unlink).toHaveBeenCalledWith('a', 'b');
    });

    it('short-circuits an empty list without a round-trip', async () => {
      const client = buildStub();

      await expect(buildStore(client).delete()).resolves.toBe(0);
      expect(client.unlink).not.toHaveBeenCalled();
    });
  });

  describe('deleteByPrefix', () => {
    it('walks every SCAN cursor and unlinks each batch', async () => {
      const client = buildStub();

      client.scan
        .mockResolvedValueOnce(['17', ['cache:auth:user:1', 'cache:auth:user:2']])
        .mockResolvedValueOnce(['0', ['cache:auth:user:3']]);

      await expect(buildStore(client).deleteByPrefix('cache:auth:user:')).resolves.toBe(3);

      expect(client.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'cache:auth:user:*',
        'COUNT',
        100,
      );
      expect(client.scan).toHaveBeenNthCalledWith(
        2,
        '17',
        'MATCH',
        'cache:auth:user:*',
        'COUNT',
        100,
      );
      expect(client.unlink).toHaveBeenCalledTimes(2);
    });

    it('does not unlink an empty batch', async () => {
      const client = buildStub();

      client.scan
        .mockResolvedValueOnce(['9', []])
        .mockResolvedValueOnce(['0', ['cache:auth:user:1']]);

      await expect(buildStore(client).deleteByPrefix('cache:auth:user:')).resolves.toBe(1);
      expect(client.unlink).toHaveBeenCalledTimes(1);
    });

    // KEYS blocks the server for the whole scan — the classic way a cache invalidation stalls
    // production.
    it('never reaches for KEYS', async () => {
      const client = buildStub();

      await buildStore(client).deleteByPrefix('cache:auth:');

      expect(client.keys).not.toHaveBeenCalled();
    });
  });

  describe('increment', () => {
    // Atomic only because it is one script: an INCR and a PEXPIRE sent apart race.
    it('runs the counter script in one call, with the window in milliseconds', async () => {
      const client = buildStub();

      await buildStore(client).increment('cache:gw:hits:1', 60_000);

      expect(client.eval).toHaveBeenCalledTimes(1);
      expect(client.eval).toHaveBeenCalledWith(
        CACHE_INCREMENT_SCRIPT,
        1,
        'cache:gw:hits:1',
        60_000,
      );
    });

    it("reads the script's reply as the value and the time left", async () => {
      const client = buildStub();

      client.eval.mockResolvedValueOnce([7, 42_000]);

      await expect(buildStore(client).increment('cache:gw:hits:1', 60_000)).resolves.toEqual({
        value: 7,
        ttlMs: 42_000,
      });
    });
  });
});
