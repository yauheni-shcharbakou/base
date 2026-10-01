# 0010 — Cache operations fail soft instead of returning `Either`

**Status:** Accepted (2026-09-07)
**Applies to:** `@backend/cache`

## Context

Everything else in this backend that can fail returns `Either<Error, T>`: `DatabaseRepository`, the
CRUD use-cases, the service use-cases built on them. A `CacheService` that swallows its errors
therefore looks like an oversight, and the consistent-looking option is to make every method return
an `Either` too.

The two cases are not the same failure. A repository's error *is* the answer — a row that will not
save must reach the caller, and the domain decides what that means. A cache miss and a cache outage
are indistinguishable from where the caller stands: both mean "compute it yourself". Redis being
down does not make a read impossible, only slower, and there is exactly one sensible reaction to it
at every call site.

So an `Either`-returning cache produces `.unwrapOr(null)` at every one of those call sites — the
same handling, written by hand, N times, with N chances to write `.unwrap()` instead and turn a
degraded cache into a 500. Throwing has the same shape with `try`/`catch`.

## Decision

`CacheService` catches every `CacheStore` error, logs it through `resolveErrorMessage(error,
CACHE_ERROR_FALLBACK)` from `@backend/common`, and returns the empty result: `get` → `null`, `set` →
`false`, `has` → `false`, `delete`/`deleteByPrefix` → `0`, `wrap` → whatever the factory returns.

The `CacheStore` adapters do **not** catch — they throw, and `CacheService` is the single layer that
decides. That keeps an adapter's spec honest about what Redis actually did.

One thing is deliberately *not* swallowed: an error thrown by the `wrap` factory. That is the
caller's real work — a database read, an HTTP call — and it propagates untouched.

## Consequences

- A caller cannot distinguish "not cached" from "cache is down". The log line and the `set` boolean
  are the only signals; a silent Redis outage shows up as load on Postgres, not as errors. If that
  becomes a problem the answer is a metric on the warn path, not an `Either`.
- `wrap` recomputes a legitimately cached `null` every time, because a stored `null` and a miss are
  the same value. Negative caching needs a wrapper object (`{ found: false }`).
- The asymmetry with `DatabaseRepository` is now intentional and documented. A future contract that
  is *not* an optimisation — a distributed lock built on the same Redis, say — should return
  `Either` and not be squeezed into `CacheService`.
