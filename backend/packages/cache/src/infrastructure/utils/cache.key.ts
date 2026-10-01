import { CACHE_KEY_SEPARATOR } from '../constants';

/**
 * Joins key segments into `prefix:namespace:key`.
 *
 * Segments are split on the separator first, so a caller passing `'user:1'` produces the same
 * key as one passing `'user', '1'`, and empty or blank parts collapse instead of leaving the
 * `::` that makes a keyspace unreadable and a prefix scan ambiguous.
 */
export const buildCacheKey = (...segments: (string | undefined)[]): string =>
  segments
    .flatMap((segment) => (segment ?? '').split(CACHE_KEY_SEPARATOR))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(CACHE_KEY_SEPARATOR);
