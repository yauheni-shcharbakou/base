/** Names the subsystem in a log line built by `resolveErrorMessage`. */
export const CACHE_ERROR_FALLBACK = 'Cache operation failed';

/** Redis' own key delimiter, so a cache key reads like the rest of the keyspace. */
export const CACHE_KEY_SEPARATOR = ':';

/** `COUNT` hint of the SCAN loop behind `deleteByPrefix`. */
export const CACHE_SCAN_COUNT = 100;

/**
 * `increment` in one round trip, atomic on the server: INCR, then start the window on the first
 * hit. A counter found without an expiry (`PTTL` -1 — written by something else, or a crash
 * between two commands of an older client) gets one too, so no counter lives forever.
 * Returns `{ value, ttlMs }`.
 */
export const CACHE_INCREMENT_SCRIPT = `
local value = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if value == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { value, ttl }
`;
