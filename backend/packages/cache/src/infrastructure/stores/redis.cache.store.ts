import Redis from 'ioredis';
import { CacheCounter, CacheStore } from '../../domain';
import { CACHE_INCREMENT_SCRIPT, CACHE_SCAN_COUNT } from '../constants';
import { CacheSerializer } from '../serializers';

/**
 * The Redis adapter. Takes the client rather than building one, so the module owns the
 * connection lifecycle and a spec can hand it a stub.
 */
export class RedisCacheStore extends CacheStore {
  private readonly serializer = new CacheSerializer();

  constructor(
    private readonly client: Redis,
    private readonly scanCount: number = CACHE_SCAN_COUNT,
  ) {
    super();
  }

  async get<Value>(key: string): Promise<Value | null> {
    return this.serializer.deserialize<Value>(await this.client.get(key));
  }

  async set<Value>(key: string, value: Value, ttlSeconds?: number): Promise<void> {
    const raw = this.serializer.serialize(value);

    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, raw, 'EX', ttlSeconds);

      return;
    }

    await this.client.set(key, raw);
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  async delete(...keys: string[]): Promise<number> {
    if (!keys.length) {
      return 0;
    }

    // UNLINK reclaims the memory on a background thread; DEL blocks the server for as long
    // as freeing a large value takes.
    return this.client.unlink(...keys);
  }

  /**
   * Walks the keyspace with SCAN — never `KEYS`, which blocks the server for the whole scan
   * and is the classic way to stall production from a cache invalidation.
   *
   * SCAN is per-node, so on a cluster this would only clear the node it is issued against.
   * The repository runs a single Redis; revisit when that stops being true.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [next, keys] = await this.client.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        this.scanCount,
      );

      cursor = next;

      if (keys.length) {
        deleted += await this.client.unlink(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  async increment(key: string, windowMs: number): Promise<CacheCounter> {
    const [value, ttlMs] = (await this.client.eval(CACHE_INCREMENT_SCRIPT, 1, key, windowMs)) as [
      number,
      number,
    ];

    return { value, ttlMs };
  }
}
