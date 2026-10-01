# 0009 — The cache is one package with a driver switch, not a package per adapter

**Status:** Accepted (2026-09-07)
**Applies to:** `@backend/cache`

## Context

The repository already has a port-with-adapters subsystem, and it is split the other way: the event
bus is `@backend/event-bus` (the ports) plus `@backend/event-bus-redis` and
`@backend/event-bus-nats` (the transports), three packages and three `compile` tasks. Copying that
shape for the cache — `@backend/cache` + `@backend/cache-redis` + `@backend/cache-memory` — is the
obvious move, and it is the one a future reader will propose unless the asymmetry is written down.

What justifies the event bus' split does not exist here:

- **Codegen.** Each transport package *generates* its own `src/generated/` from the
  `EventBusStrategy`, which is why each needs its own turbo task ([ADR-0002](0002-codegen-task-per-package.md)).
  The cache generates nothing.
- **Dependency weight.** `@backend/event-bus-redis` pulls in `bullmq`, the NATS one pulls
  `nats`. A service must be able to take one without the other. The cache's two adapters cost
  `ioredis` and nothing — and `ioredis` is already in the dependency closure of every service that
  runs the event bus.
- **Divergent surface.** The transports differ in what they *are* (a work queue that needs a
  mediator vs. a broker that does not — [ADR-0004](0004-redis-mediator-fan-out.md)). The two cache
  adapters implement five identical methods.

Against that, three packages cost three manifests, three build tasks, three `CLAUDE.md` files and a
version of `ioredis` to keep aligned, to hold roughly 200 lines of adapter.

## Decision

One package, `@backend/cache`. The port `CacheStore` lives in `src/domain/services/`; both adapters
(`RedisCacheStore`, `MemoryCacheStore`) live in `src/infrastructure/stores/`. `CacheModule.forRoot`
picks one from `CACHE_DRIVER` (read synchronously through `getCacheDriver()`, so the `memory` driver
registers no ioredis connection provider at all) and binds it to the abstract `CacheStore` token.
Consumers inject `CacheService`, which knows no driver.

The cache opens **its own** Redis connection (`CacheConnectionService`) rather than reusing the one
`@backend/event-bus-redis` owns: sharing it would make a cache impossible to enable without the
event bus, and would drag `bullmq` into a service that wanted a key-value store. It defaults to the
same `REDIS_URL`, with `CACHE_REDIS_URL` to split the instances when eviction policy demands it.

## Consequences

- Adding a third driver is a file in `stores/` plus a `CACHE_DRIVER` member — no new workspace, no
  new build task, no `pnpm install`.
- The cost lands the day an adapter needs a heavy dependency of its own (a Memcached or DynamoDB
  client): every service then carries it, whether or not it uses that driver. That is the trigger to
  split, and the split is mechanical — the port already exists and nothing imports an adapter
  directly.
- The two subsystems now look different for no reason a reader can see from the tree alone. This
  ADR is that reason.
- `ioredis` moved to the `catalog:` block in `pnpm-workspace.yaml`, since two workspaces declare it.
