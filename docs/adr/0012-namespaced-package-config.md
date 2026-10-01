# 0012 — A package's config factory is registered under its own namespace

**Status:** Accepted (2026-09-07)
**Applies to:** @backend/cache, @backend/event-bus-redis, @backend/event-bus-nats

## Context

Each infrastructure package ships a config factory of getters and hands it to
`ConfigModule.forFeature`, then reads a value back by name:

```ts
imports: [ConfigModule.forFeature(redisConfig)],
useFactory: (configService) => configService.getOrThrow('getConnectionOptions', { infer: true })(host),
```

A plain factory has no namespace, so `forFeature` merges its keys into **one flat store** shared by
every other plain factory in the process. Three packages had independently picked the obvious names
for the obvious job — `getConnectionUrl` and `getConnectionOptions` in `cacheConfig`, `redisConfig`
and `natsConfig`. Nothing collided while a service wired at most one of them.

`backend.auth` then wired two. `CacheModule` is imported after `RedisModule`, so the cache's getters
overwrote the event bus', and the event bus opened its connection with the cache's options: the
client came up named `auth-cache-client`, on `CACHE_REDIS_URL ?? REDIS_URL`, and — the part that
mattered — **without `maxRetriesPerRequest: null`**, which BullMQ requires for its blocking
commands. The result was not a startup error but a process that died the moment Redis became
unreachable, on an unhandled `error` event from a BullMQ `RedisConnection` whose listeners were
never wired. Nothing in the type system, the linter or any test could see it: both sides satisfied
the same key names with the same shapes, and the damage only showed up under an outage, in a
service that happened to import two modules in one order rather than the other.

Two ways out were considered. **Renaming the colliding getters** (`getCacheConnectionUrl`, …) is a
three-line change, but it only lowers the odds: the next package to want a `getTimeout` or a
`getKeyPrefix` re-runs the same accident, and the failure stays invisible until an outage. **A
namespace per package** is what `@nestjs/config` provides for exactly this, and it makes the
collision impossible rather than unlikely — the cost is that reads go through the namespaced token
instead of a bare string.

## Decision

Every infrastructure-package config factory is wrapped in `registerAs('<package>', …)` —
`'cache'`, `'eventBusRedis'`, `'eventBusNats'` — and its module injects `xConfig.KEY`, typed as the
factory's own return type, instead of injecting `ConfigService` and looking values up by string:

```ts
inject: [redisConfig.KEY],
useFactory: (config: RedisConfig) => new RedisConnectionService(
  config.getConnectionUrl(),
  config.getConnectionOptions(params.host),
),
```

The `*_CONFIG_SERVICE` tokens that existed only to alias `ConfigService` are gone. `xConfig.KEY` is
**not** re-exported from the module: it belongs to the imported `ConfigModule.forFeature`, and Nest
refuses to re-export a provider a module does not own — a consumer that needs the config imports the
same feature module.

Each package's config spec pins its namespace (`expect(cacheConfig.KEY).toBe('CONFIGURATION(cache)')`),
so a rename is a deliberate act rather than a silent one.

Configs whose top-level keys are already distinctive by nature — `commonConfig` (`port`),
`pgConfig` (`postgres`), `grpcConfig` (`loader`, per-host entries), the services' own `jwtConfig` /
`bcryptConfig` — are left as plain factories. The rule applies to a package that publishes generic
getter names.

## Consequences

- Two packages can pick the same getter name forever without interfering, and module import order
  in an app stops being load-bearing.
- Reads are typed against the factory's return type directly, so a renamed getter is a compile
  error rather than a `getOrThrow` that finds someone else's function at runtime.
- A new infrastructure package must remember `registerAs`. Nothing enforces it; the spec that pins
  the namespace is the reminder, and this ADR is linked from all three packages' `CLAUDE.md`.
- The bug this closes is why [ADR-0013](0013-event-bus-fails-loud.md) exists at all: the outage
  behaviour underneath was only reachable once the process stopped dying on the way to it.
