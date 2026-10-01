# 0024 — The gateway's rate-limit counters live in Redis, behind `@backend/cache`

**Status:** Accepted (2026-09-29)
**Applies to:** `backend.api-gateway`, `@backend/cache`

## Context

`GrpcThrottlerGuard` counts calls in `@nestjs/throttler`'s default `ThrottlerStorageService`, an
in-process `Map`. A restart resets every counter, which also resets the limit on a password guess.
A second gateway replica doubles the effective limit, because each replica counts only its own
share. A shared store fixes both, and the repository already runs one: Redis, reached through
`@backend/cache`.

That package's port could not hold a counter, though. `CacheStore` offered
`get` / `set` / `has` / `delete` / `deleteByPrefix`, and a counter built from `get` then `set` loses
increments whenever two replicas read the same value. Replicas are the reason for a shared store in
the first place.

Rejected alternatives:

- **`@nest-lab/throttler-storage-redis`.** It works out of the box, but it opens its own ioredis
  connection. That connection skips everything the repository built around its cache connection:
  fail-soft ([ADR-0010](0010-cache-fails-soft.md)), `CacheMetrics`, the
  `<prefix>:<namespace>:<key>` layout and the `CACHE_*` / `REDIS_*` configuration. The package would
  also be one more dependency to keep aligned with the Nest major.
- **Fail open on an outage**, meaning an uncounted call is allowed. For as long as Redis is down,
  login has no limit at all, and login is the endpoint the limit exists for.
- **Fail closed on an outage**, meaning an uncounted call is refused. A Redis outage would then take
  the whole admin down, even though Redis is an optional dependency everywhere else
  (ADR-0010, [ADR-0013](0013-event-bus-fails-loud.md)).

## Decision

`CacheStore` gains `increment(key, windowMs)`. It is atomic and uses a **fixed window**: the first
hit starts the expiry, and later hits do not extend it. `RedisCacheStore` implements it as a single
`EVAL` of `CACHE_INCREMENT_SCRIPT`. The script runs `INCR`, then `PEXPIRE` on the first hit or on a
key that has no TTL. `MemoryCacheStore` implements the same semantics on its `Map`. Both adapters
store a counter as a bare integer rather than through `CacheSerializer`, because `INCR` only works
on integers. `CacheService.increment` fails soft: a store error is logged, counted as
`errorsByOperation.increment`, and returned as `null`.

The gateway registers `CacheModule.forRoot({ namespace: 'api-gateway' })`. Its throttler storage is
`CacheThrottlerStorage` in `common/infrastructure/storages`, which runs over
`cache.scope('throttle')` and is wired through `GRPC_THROTTLER_MODULE_OPTIONS`. The throttler's key
is passed through `encodeURIComponent`, because `buildCacheKey` splits on `:` and drops blank
segments, which would fold IPv6 trackers into one another. When `increment` returns `null`, the hit
goes to an in-process `ThrottlerStorageService` owned by the storage. `blockDuration` is treated as
`ttl`, so a caller over the limit stays blocked until its window ends.

## Consequences

- Every gateway replica counts against one limit, and counters survive a restart.
- Redis becomes a **soft** dependency of the gateway: `REDIS_URL` is set in `docker-compose.yml`,
  and each unary call makes one more round trip.
- During an outage the limit holds per replica. Around the outage and the recovery, one caller's
  hits are briefly split between the two stores, so the limit is loose for about one window.
- A `blockDuration` longer than `ttl` is not supported. Supporting it means adding a separate block
  key and the extra round trip to check it.
- A counter key is readable only through `increment`. A `get` on the same key finds no
  `{ value }` wrapper, logs the entry as corrupt and returns a miss.
- This is the second consumer of `@backend/cache` and the first to use it for something other than
  caching. It does not reopen [ADR-0011](0011-identity-cached-in-auth.md): the gateway still caches
  no data.
