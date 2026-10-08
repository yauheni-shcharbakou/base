import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type Redis from 'ioredis';
import { CacheModule } from './cache.module';
import { CACHE_CONNECTION, CacheConnectionService, CacheService } from './infrastructure';

const NAMESPACE = 'cache-module';
const KEY_PREFIX = process.env.CACHE_KEY_PREFIX ?? 'cache-e2e';
const OWN_PREFIX = `${KEY_PREFIX}:${NAMESPACE}:`;

declare module 'vitest' {
  export interface ProvidedContext {
    /** Whether `test/cache-server.setup.ts` found a Redis to run against. */
    cacheServer: boolean;
  }
}

// Probed by `test/cache-server.setup.ts` before the workers start. Read at module scope so the
// suite can pick `describe` vs `describe.skip` — a serverless run reports as skipped, not green.
const describeWithServer = describe.skipIf(!inject('cacheServer'));

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describeWithServer('CacheModule (e2e)', () => {
  let moduleRef: TestingModule;
  let cache: CacheService;
  let client: Redis;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        CacheModule.forRoot({ namespace: NAMESPACE }),
      ],
    }).compile();

    await moduleRef.init();

    cache = moduleRef.get(CacheService);

    const connection = moduleRef.get<CacheConnectionService>(CACHE_CONNECTION);
    // `moduleRef.init()` does not wait for the socket, and the cache runs with
    // `enableOfflineQueue: false` — a command sent before `ready` is answered as a miss instead
    // of being held, which is exactly what makes an outage cost nothing. Assertions about real
    // server behaviour therefore have to start from a connected client.
    await connection.waitUntilReady(5000);

    client = connection.getClient();

    // Only this suite's own keys — a blanket wipe of the prefix would let two files in
    // parallel workers destroy each other's state.
    await cache.deleteByPrefix();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('round-trips a value through a real server', async () => {
    await cache.set('user:1', { id: '1', roles: ['admin'] });

    await expect(cache.get('user:1')).resolves.toEqual({ id: '1', roles: ['admin'] });
    await expect(cache.has('user:1')).resolves.toBe(true);
    // The key is written where the layout says it is, not somewhere only the service knows.
    await expect(client.exists(`${OWN_PREFIX}user:1`)).resolves.toBe(1);
  });

  it('stores falsy values as values, not as misses', async () => {
    await cache.set('zero', 0);
    await cache.set('flag', false);

    await expect(cache.get('zero')).resolves.toBe(0);
    await expect(cache.get('flag')).resolves.toBe(false);
  });

  describe('ttl', () => {
    it('hands Redis the expiry and lets the key actually die', async () => {
      await cache.set('short', 'value', 1);

      const ttl = await client.pttl(`${OWN_PREFIX}short`);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1000);

      await wait(1300);

      await expect(cache.get('short')).resolves.toBeNull();
    });

    it('applies the configured default when a call passes none', async () => {
      await cache.set('default-ttl', 'value');

      // CACHE_TTL=2, pinned by the suite's globalSetup.
      await expect(client.ttl(`${OWN_PREFIX}default-ttl`)).resolves.toBeGreaterThan(0);
    });

    it('stores without an expiry when the call asks for none', async () => {
      await cache.set('forever', 'value', 0);

      // -1 is Redis for "exists, no expiry".
      await expect(client.ttl(`${OWN_PREFIX}forever`)).resolves.toBe(-1);
    });
  });

  describe('deleteByPrefix', () => {
    // The point of the SCAN loop: a batch larger than one cursor's worth of keys.
    it('clears more keys than a single SCAN cursor returns', async () => {
      const keys = Array.from({ length: 1200 }, (_value, index) => `bulk:${index}`);

      await Promise.all(keys.map((key) => cache.set(key, key)));

      await expect(cache.deleteByPrefix('bulk')).resolves.toBe(1200);
      await expect(cache.get('bulk:0')).resolves.toBeNull();
    });

    it('leaves the keys outside the prefix alone', async () => {
      await cache.set('user:2', 'kept');
      await cache.set('session:2', 'dropped');

      await expect(cache.deleteByPrefix('session')).resolves.toBe(1);
      await expect(cache.get('user:2')).resolves.toBe('kept');
    });
  });

  describe('increment', () => {
    // What a get-then-set counter cannot do: every concurrent caller sees its own value.
    it('counts concurrent increments without losing one', async () => {
      const counters = await Promise.all(
        Array.from({ length: 200 }, () => cache.increment('counter:race', 60_000)),
      );

      const values = counters.map((counter) => counter?.value).sort((a, b) => a - b);

      expect(values).toEqual(Array.from({ length: 200 }, (_value, index) => index + 1));
    });

    it('keeps the first window and starts over once it has passed', async () => {
      await expect(cache.increment('counter:window', 1000)).resolves.toMatchObject({ value: 1 });
      await expect(cache.increment('counter:window', 60_000)).resolves.toMatchObject({
        value: 2,
        ttlMs: expect.any(Number),
      });
      await expect(client.pttl(`${OWN_PREFIX}counter:window`)).resolves.toBeLessThanOrEqual(1000);

      await wait(1300);

      await expect(cache.increment('counter:window', 1000)).resolves.toMatchObject({ value: 1 });
    });
  });

  describe('shutdown', () => {
    const bootLocalModule = async (): Promise<[TestingModule, Redis]> => {
      const localModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          CacheModule.forRoot({ namespace: `${NAMESPACE}-shutdown` }),
        ],
      }).compile();

      await localModule.init();

      return [localModule, localModule.get<CacheConnectionService>(CACHE_CONNECTION).getClient()];
    };

    it('closes a live connection', async () => {
      const [localModule, localClient] = await bootLocalModule();

      // Makes sure the socket is `ready`, i.e. that the graceful QUIT path is the one taken.
      await localModule.get(CacheService).set('shutdown', 'value', 5);

      await localModule.close();

      await expect(localClient.ping()).rejects.toThrow();
    });

    // The case that leaves a handle open if the hook only ever calls `quit()`: a process that
    // dies while the socket is still connecting has nothing to say QUIT to.
    it('closes a connection that never finished connecting', async () => {
      const [localModule, localClient] = await bootLocalModule();

      await localModule.close();

      await expect(localClient.ping()).rejects.toThrow();
    });
  });
});
