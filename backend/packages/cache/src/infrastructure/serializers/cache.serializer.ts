import { resolveErrorMessage } from '@backend/common';
import { Logger } from '@nestjs/common';
import { CACHE_ERROR_FALLBACK } from '../constants';

/**
 * The wire format of a cached value, shared by every adapter.
 *
 * Values are wrapped in `{ value }` rather than stringified bare so that `null`, `0`, `false`
 * and `''` survive the round-trip: a bare `JSON.parse` cannot tell a stored `null` from a
 * missing key, and every one of those is a legitimate thing to cache.
 *
 * The memory adapter goes through it too, so both drivers hand back a detached copy and a
 * caller cannot mutate what is "in the cache" — semantics that would otherwise differ
 * between drivers and only surface in production.
 */
export class CacheSerializer {
  private readonly logger = new Logger(CacheSerializer.name);

  /** `undefined` cannot be represented and is stored as an absent value, i.e. a future miss. */
  serialize<Value>(value: Value): string {
    return JSON.stringify({ value });
  }

  /** A corrupt entry is a miss, not a failure — it is a cache, and the caller can rebuild it. */
  deserialize<Value>(raw: string | null): Value | null {
    if (raw === null || raw === undefined) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as { value?: Value } | null;

      return parsed?.value ?? null;
    } catch (error) {
      this.logger.warn(
        `Dropping an unreadable cache entry: ${resolveErrorMessage(error, CACHE_ERROR_FALLBACK)}`,
      );

      return null;
    }
  }
}
