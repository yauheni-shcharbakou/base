# CLAUDE.md — @backend/cache

Guidance for working inside `backend/packages/cache`. Read `backend/CLAUDE.md` first for the shared
package conventions (cjs-only, the root `src/index.ts` barrel, specs next to their subject). This
file is the package internals.

## What this is

The application cache: a `CacheStore` port with two adapters — Redis (`ioredis`) and an in-memory
one — behind a single `CacheModule`. Services inject `CacheService` and never learn which driver is
running.

**Status: live in `backend.auth`**, which caches the identity read behind the gateway's per-request
access check (`cache:auth:user:<id>`) — see that service's `CLAUDE.md` for the wiring and
[ADR-0011](../../../docs/adr/0011-identity-cached-in-auth.md) for why the cache sits there and not
in the gateway. `backend.api-gateway` wires it for its rate-limit counters (`increment`, below), not
to cache data — [ADR-0024](../../../docs/adr/0024-gateway-rate-limit-counters-in-redis.md).

Not to be confused with `MemoryCache` in `@backend/common` — a `setTimeout`-per-key Map that no
service imports any more. Anything that needs a cache uses this package instead.

> **Why one package instead of a package per adapter (the shape the event bus uses), and why its
> own Redis connection:** [docs/adr/0009-cache-one-package-driver-switch.md](../../../docs/adr/0009-cache-one-package-driver-switch.md)

## Layout (hexagonal adapter)

```
src/
  domain/
    services/cache.store.ts      # the port: get / set / has / delete / deleteByPrefix / increment
    types/cache.types.ts         # CacheDriver, CacheServiceOptions, CacheCounter
  infrastructure/
    configs/                     # cacheConfig() + getCacheDriver()
    connections/                 # CacheConnectionService — the package's own ioredis socket
    constants/                   # DI tokens, CACHE_ERROR_FALLBACK, key separator, SCAN count, increment script
    metrics/                     # CacheMetrics — counters for what fail-soft swallows
    serializers/                 # CacheSerializer — the wire format both adapters share
    stores/                      # RedisCacheStore, MemoryCacheStore
    services/cache.service.ts    # what consumers inject
    utils/cache.key.ts           # buildCacheKey()
  cache.module.ts                # composition root
```

`layerGuard()` is wired in `eslint.config.mjs`: `infrastructure/` may import `domain/`, never the
other way round. `cache.module.ts` sits outside any layer directory and is exempt, which is how it
gets to wire concrete adapters.

## The port and its adapters

`CacheStore` is the only thing a new driver implements. Keys reach it fully built — prefixing,
namespacing and TTL defaults are `CacheService`'s job — and adapters **throw** rather than swallow;
the service is the single place that decides what a failure means.

- `RedisCacheStore` takes a `Redis` client in its constructor (the module owns the lifecycle, a spec
  hands it a stub). `set` uses `EX`; `delete` uses **UNLINK**, not DEL, so freeing a large value
  does not block the server. `deleteByPrefix` walks a `SCAN … MATCH <prefix>* COUNT 100` loop —
  **never `KEYS`**, which blocks the server for the whole scan and is the classic way a cache
  invalidation stalls production. SCAN is per-node, so this clears one node only; the repository
  runs a single Redis.
- `MemoryCacheStore` is a `Map` with **lazy** expiry (checked on read, no timers — a `setTimeout`
  per key keeps jest from exiting). A key nobody reads again holds its memory until
  `deleteByPrefix`. Dev and tests only.
- **A value crosses the cache as JSON**, whichever adapter is running, so a `Date` field comes back
  an ISO **string** even where the type says `Date` — the same property `@backend/event-bus`
  documents for its payloads. Rebuild timestamps on the way out (`AuthGetUserByTokenUseCase` is the
  live example) or the first consumer that serializes them will throw.
- `CacheSerializer` wraps values as `{ value }` before `JSON.stringify`, so `null`, `0`, `false` and
  `''` survive the round-trip — a bare parse cannot tell a stored `null` from a missing key. Both
  adapters use it, which is what keeps the memory driver from handing back live references while
  Redis hands back copies. A corrupt entry is logged and read as a miss.
- **`increment(key, windowMs)` is the one atomic operation** — a counter shared between replicas
  cannot be a `get` then a `set`, which loses hits to the race. It is a **fixed window**: the first
  hit starts the expiry, later ones do not extend it. Redis runs it as one `EVAL` of
  `CACHE_INCREMENT_SCRIPT` (INCR, then PEXPIRE on the first hit or on a key without a TTL); the
  memory store mirrors it, refusing a key that holds a value as `INCR` does. A counter is a **bare
  integer**, not a `CacheSerializer` envelope, so only `increment` reads it — `get` on it logs a
  corrupt entry and answers a miss.

## `CacheService`

Owns the three things adapters should not repeat:

- **Key layout** — `<CACHE_KEY_PREFIX>:<namespace>:<key>` via `buildCacheKey()`, which splits on
  `:`, trims and drops blanks, so `'user:1'` and `'user', '1'` produce the same key and no `::` ever
  reaches the keyspace. `scope('user')` returns a child bound to a deeper namespace.
- **Fail-soft** — a store error is logged (`resolveErrorMessage` + `CACHE_ERROR_FALLBACK`), counted
  on `CacheMetrics`, and becomes the empty result: `get` → `null`, `set` → `false`, `delete*` → `0`,
  `increment` → `null` (the caller decides what an uncounted hit means), `wrap` → the factory's own
  value. An error thrown by the `wrap` factory is **not** swallowed.
- **Single-flight `wrap`** — concurrent misses of one key run the factory once. The in-flight map is
  shared with every `scope()` child, so two scopes of the same key still dedupe.

Two behaviours worth knowing: `deleteByPrefix()` with no argument clears the namespace (the
separator is appended, so clearing `auth` cannot eat `authors`), and with an argument the match is a
**literal prefix** — `deleteByPrefix('user')` also drops `user-drafts:…`. And `wrap` recomputes a
cached `null`, because a stored `null` is indistinguishable from a miss; there is no negative
caching.

Fail-soft is only worth anything if it is fast, which is a **connection** setting, not a service
one: `enableOfflineQueue: false` plus `commandTimeout` (`CACHE_COMMAND_TIMEOUT`). With the offline
queue on — ioredis' default — a lookup issued while the socket is down waits out the reconnect
ladder, so "the cache degrades" meant roughly 30 seconds added to every request that touched it.
Off, the command rejects at once and `CacheService` reads that as a miss.

The corollary: a command sent **before the socket is ready** is a miss too, not a queued command.
That window is the first moments after boot and each reconnect, and for a cache it is the right
trade — a handful of extra Postgres reads instead of held requests. Nothing waits for the
connection at bootstrap, deliberately: that would make an optional dependency a required one.
`CacheConnectionService.waitUntilReady(timeoutMs)` exists for the callers that genuinely need a
connected client (the e2e suite; a health endpoint would too).

> **Why not `Either`, like every repository in this backend:** [docs/adr/0010-cache-fails-soft.md](../../../docs/adr/0010-cache-fails-soft.md)
> **Why the event bus does the opposite:** [docs/adr/0013-event-bus-fails-loud.md](../../../docs/adr/0013-event-bus-fails-loud.md)

## `CacheMetrics`

The counterpart to fail-soft, and the thing ADR-0010 names as the answer to its own cost: an
outage nobody is told about shows up as load on Postgres, not as errors. `CacheMetrics` counts
`hits` / `misses` / `writes` and `errors` (in total and per operation, with `lastErrorAt`), and
`errors` against `hits + misses` is the ratio worth an alert.

- Every swallowed failure goes through `CacheService.warn`, which is therefore where the counter
  lives — a new fail-soft path cannot forget to count.
- One instance per `CacheModule`, shared with every `scope()` child (the connection is up or down
  for all of them). Read it by injecting `CacheMetrics`, or `cacheService.getMetrics()` when the
  service is already at hand; `snapshot()` returns a copy, `reset()` supports delta scraping.
- **Deliberately a plain counter object, not a metrics client.** The repository runs no Prometheus,
  and a client declared here would land in the dependency closure of every service that only wanted
  a key-value store. Wiring it to a real exporter is the consumer's job — `snapshot()` is the seam.
- Nothing polls it yet. No service exposes the numbers; wiring them to a health or scrape endpoint
  is the next step, not something this package does.

## Module (`cache.module.ts`)

```ts
CacheModule.forRoot({ namespace: 'auth' }); // global; driver from CACHE_DRIVER
CacheModule.forRoot({ namespace: 'auth', driver: 'memory' }); // explicit override
```

- The driver is resolved **synchronously** through `getCacheDriver()`, before Nest resolves
  anything: with `memory` the ioredis connection provider is not registered at all, so the package
  runs with no Redis in sight.
- Binds the abstract `CacheStore` to the chosen adapter and exports it alongside `CacheService` and
  `CacheMetrics`, so a spec can override the port — and a health endpoint read the counters —
  without reaching through the service.
- `CACHE_CONNECTION` is registered **last** on purpose, the rule `RedisModule` follows: Nest runs
  shutdown hooks in provider order, so the socket closes after everything using it.
- No `forFeature` — namespace scoping is `cacheService.scope()`, which needs no extra DI token.

`CacheConnectionService.onApplicationShutdown` only sends `QUIT` when the client is `ready`. `quit()`
is a command, not a socket operation: on a client that is still connecting it waits in the offline
queue, which on a shutdown *because* Redis went away means waiting forever. Either way it then calls
`disconnect()`, or a process that closed mid-connect would keep an open handle and never exit. The
e2e suite covers both paths.

## Env

`src/infrastructure/configs/cache.config.ts` owns every default; the seven variables are tabulated in
[docs/env.md](../../../docs/env.md). Two worth knowing here: `CACHE_REDIS_URL` splits the cache off
the event bus' Redis when eviction policy demands it (otherwise both read `REDIS_URL`), and
`CACHE_TTL=0` stores without an expiry unless a call passes its own. There is deliberately **no**
`CACHE_IP_FAMILY`: the address family belongs to the network, not to a subsystem, so the cache reads
the event bus' `REDIS_IP_FAMILY`.

The factory's shape follows the repo convention — fields, functions only where a member takes an
argument; see `backend/CLAUDE.md`. `getCacheDriver()` is outside the factory for a different reason:
`CacheModule.forRoot` reads it synchronously, before Nest resolves anything.

The factory is registered as `registerAs('cache', …)` and read by injecting `cacheConfig.KEY`, never
by looking a getter up on `ConfigService`. That is load-bearing: `getConnectionOptions` is a name
`@backend/event-bus-redis` uses too, and an unnamespaced factory merges into one flat store where the
last module loaded wins — which once handed the event bus this package's connection options.

> **Why the namespace:** [docs/adr/0012-namespaced-package-config.md](../../../docs/adr/0012-namespaced-package-config.md)

## Commands & gotchas

```bash
pnpm build            # tsdown → dist
pnpm test             # unit jest; single file: pnpm test -- cache.service
pnpm test:e2e         # server-backed suite; auto-skips when no Redis answers
pnpm dev / test:watch / lint / format / reset
```

- The unit suite covers what the package exists for and what fails silently when broken: the key
  builder, the serializer's falsy round-trip, the SCAN loop (including that `KEYS` is never called),
  lazy expiry, and every fail-soft path with its log line and its counter.
- `pnpm lint` runs type-checked rules the backend preset does not disable — `no-misused-promises`
  and `no-base-to-string` both caught real code here. Compare a possibly-undefined promise with
  `!== undefined`, and put an `unknown` error through `resolveErrorMessage`, not `String()`.

### The e2e suite

```bash
pnpm docker:local:d      # or: docker run --rm -p 6379:6379 redis:latest
pnpm test:e2e
```

`src/cache.module.e2e-spec.ts` boots the real module and covers what a stub cannot prove: that a TTL
actually expires, that `deleteByPrefix` clears more keys than one SCAN cursor returns (1200 of
them), that falsy values come back as values, that 200 concurrent `increment`s of one key lose none and
its window really expires, and that shutdown closes the socket from both the
`ready` and the still-connecting state. Its `beforeAll` calls `waitUntilReady` first: `init()` does
not wait for the socket, and with no offline queue an early command answers as a miss rather than
being held — a suite asserting real server behaviour has to start from a connected client.

`test/cache-server.setup.js` is a jest `globalSetup`, not a `beforeAll`, for the same two timing
reasons as the event bus': the config validates env at module load, so overrides must be in place
before the spec is imported, and the server probe has to land in `process.env` for the spec to pick
`describe` vs `describe.skip` synchronously — without a server jest reports the suite as *skipped*
rather than passing on an empty run. It pins `CACHE_KEY_PREFIX=cache-e2e` so the suite cannot touch
a local dev run's keys, and `CACHE_TTL=2` so an expiry can be waited out. The probe is a raw socket:
a failed ioredis connection leaves reconnect machinery that keeps jest from exiting, on exactly the
path that has to stay quiet.
