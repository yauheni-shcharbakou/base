# CLAUDE.md — @backend/event-bus-redis

Guidance for working inside `backend/packages/event-bus-redis`. Read first: the root `CLAUDE.md`
*Event-bus codegen pipeline* section, `backend/packages/event-bus/CLAUDE.md` (the abstract ports,
the naming rules and the **bus-wide semantics** — JSON payloads, at-least-once, error messages), and
`backend/CLAUDE.md` (shared package conventions). This file is the Redis/BullMQ runtime.

**Status: the live transport.** `backend.auth` and `backend.storage` run on it (`RedisModule.forRoot`
+ `REDIS_MICROSERVICE_OPTIONS`, subscribers under `interface/redis/`); `@backend/event-bus-nats` is
dormant. `docker-compose.yml` runs a `redis` service in the `local`/`all` profiles and passes
`REDIS_URL` to both services. `backend.api-gateway` uses no event bus at all.

## Dual nature

`src/generated/index.ts` is **emitted by this package's own compiler** (`compiler/`, run as its own
turbo `compile` task) — transports (`Redis<Service>Transport`), subscriber/handler interfaces,
`RedisClientFactory` and `REDIS_HOST_EVENTS`. Everything else (`infrastructure/`, `interface/`,
`redis.module.ts`) is hand-written runtime.

```
compiler/
  main.ts            # builds the context, runs the adapter, writes ../src/generated/index.ts
  redis.adapter.ts   # EventBusAdapter subclass: imports, per-service transports, client, registry
  templates/*.pug    # redis.controller / redis.client / redis.registry
```

`main.ts` gets `EventBusAdapter` and `parseStrategy()` from `@backend/event-bus/compiler` and parses
`EventBusStrategy` itself; `outputPath` is local to this package. Editing a template here invalidates
only this package; a strategy edit invalidates all three `compile` tasks.

> **Why each package compiles itself:** [docs/adr/0002-codegen-task-per-package.md](../../../docs/adr/0002-codegen-task-per-package.md)

## Queue topology

BullMQ is a work queue, so fan-out is explicit — three stages:

```
emit  →  Queue('auth.user.create')                          the event queue (one owner: the host)
         Worker('auth.user.create')                         mediator, fan-out stage
           → SMEMBERS event-bus:subs:auth.user.create       ['storage.file', 'storage.storage-object']
           → Queue('auth.user.create@storage.file').add(…)  one queue per (event, controller)
         Worker('auth.user.create@storage.file')            consumer, calls the controller method
```

Queue names: the event id, dot-cased `host.service.event`, used verbatim; a subscriber queue appends
`@<consumerId>`. **`:` cannot be used** — BullMQ's `QueueBase` throws `Queue name cannot contain :`
because `:` is the Redis key delimiter (`<prefix>:<queueName>:<type>`). The same rule bites job ids,
plus numeric ids are rejected — that is why `buildFanOutJobId()` prefixes the source job id with the
event id.

> **Why a mediator (and why NATS has none):** [docs/adr/0004-redis-mediator-fan-out.md](../../../docs/adr/0004-redis-mediator-fan-out.md)

## Layer map (hexagon)

Concrete adapter for the abstract ports of `@backend/event-bus`:

- **infrastructure/** — driven/outbound: `configs/` (connection, queue/worker/job options,
  subscription and parking keys), `constants/` (DI tokens, queue-name helpers), `types/`
  (`RedisQueueSubscription`), `utils/` (`globalQueueRegistry`), `connections/` (the shared ioredis
  client), `clients/` (`RedisQueueClient` — the queue pool used for emitting), `registry/`
  (`RedisSubscriptionRegistry`), `parking/` (`RedisParkingService`), `mediators/`
  (`RedisMediatorService` — the fan-out workers), `topology/` (`RedisTopologyReporter`).
- **interface/** — driving/inbound: `decorators/` (`@RedisController`, `@RedisEvent`), `contexts/`
  (`RedisJobContext`), `interceptors/` (error logging), `servers/` (`RedisEventBusServer`, the
  `CustomTransportStrategy` that runs the consumer workers).
- **redis.module.ts** — composition root.
- **generated/** — one codegen file spanning both layers.

## Module (`redis.module.ts`)

- `RedisModule.forRoot({ host: EventBusHost, onlyEmitting? })` — global. Always provides the shared
  connection, `RedisQueueClient`, `RedisSubscriptionRegistry`, `RedisParkingService`,
  `RedisTopologyReporter` and the **mediator** — an emit-only service still has to fan out the events
  it owns, so `onlyEmitting` does not disable it. Unless `onlyEmitting`, it also provides
  `REDIS_MICROSERVICE_OPTIONS`, connected in `main.ts` via
  `app.connectMicroservice(app.get(REDIS_MICROSERVICE_OPTIONS))`.
- `REDIS_TOPOLOGY` is injected by nobody: it exists for its bootstrap hook, which logs how many
  workers this process runs and roughly how many Redis connections that costs
  (`1 shared + 1 invalidation channel + 1 per worker` — BullMQ does not expose the sockets it
  duplicates, so the number is an estimate and is printed with a `~`). All of it is counted from the
  **declared** topology, never from live state: Nest calls a module's bootstrap hooks concurrently
  and the server strategy spawns its workers from `listen()`, so reading what has actually started
  would be a race.
- `RedisModule.forFeature({ EventBus })` — binds an abstract bus to its concrete client via
  `RedisClientFactory`.
- The connection provider is registered **last** on purpose: Nest runs shutdown hooks in provider
  order, so the socket closes after the workers and queues.

## Controllers

```ts
@RedisController({ consumer: 'storage.file' })
@RedisVideoTransport.ControllerMethods()
export class RedisFileController
  implements RedisVideoEventController, RedisUserCreateEventHandler
{
  async onUploaded(event: NestStorage.Video): Promise<void> {}
  async onUploadFinish(event: NestStorage.Video): Promise<void> {}
  async onUploadFail(event: NestStorage.Video): Promise<void> {}

  @RedisEvent(RedisUserTransport.CREATE)
  async onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: RedisJobContext) {}
}
```

- **`ControllerMethods()` binds every event of its service**, so the class needs a handler for each —
  one it lacks throws a `TypeError` at class load (Nest's `EventPattern` reads the missing method's
  descriptor), and a new event in the strategy breaks every such class. To take a subset, subscribe
  per event with `@RedisEvent` and the `Redis<Service><Event>EventHandler` interface, as `backend.storage` does.
- `consumer` is the controller's system-wide id (`<host>.<module>`), the second half of its queue
  names. Declared once, in `@RedisController`.
- **Keep `@RedisController` above the transport decorator.** It runs last (class decorators apply
  bottom-up) and rewrites `PATTERN_METADATA` into `<eventId>@<consumerId>`; a pattern that reaches
  the strategy without the suffix fails bootstrap with an explicit message instead of quietly idling
  a queue.
- `context?: RedisJobContext` is only injected when decorated with `@Ctx()` (and then the payload
  needs `@Payload()`) — standard Nest behaviour.

> **Why subscriptions carry a consumer id:** [docs/adr/0006-consumer-scoped-subscriptions.md](../../../docs/adr/0006-consumer-scoped-subscriptions.md)

## Delivery semantics

Per-job: `REDIS_JOB_ATTEMPTS` attempts with exponential backoff from `REDIS_JOB_BACKOFF_DELAY`,
`removeOnComplete` after 1h/1000 jobs, `removeOnFail` after 24h — **the `failed` set is the DLQ**.
There is no ack/nak: a rejected processor marks the job failed and BullMQ schedules the retry. Worker
`concurrency` defaults to 1 — override globally with `REDIS_WORKER_CONCURRENCY` or per controller
with `@RedisController({ concurrency })`.

Because the DLQ is the record, a job sitting there has to say why on its own. Two things erase
`failedReason` on the way, so both are handled: `RedisControllerInterceptor` re-wraps unknown errors
into `RpcException` **and resolves the message there**, while the `cause` chain still exists (Nest's
`RpcExceptionsHandler` would otherwise replace it with a bare "Internal server error" and drop the
original error object); `RedisEventBusServer.toError` does the same for handlers that throw outside
the interceptor's observable. Both use `resolveErrorMessage()` from `@backend/common` with
`REDIS_ERROR_FALLBACK` — see that package's `CLAUDE.md`.

## Registries & parking

- `globalQueueRegistry` (module singleton) accumulates `event → controller` subscriptions as
  `@RedisController` runs on class load; the strategy reads it at `listen()` to spawn the workers.
- `RedisSubscriptionRegistry` publishes those subscriptions into Redis
  (`SADD event-bus:subs:<eventId> <consumerId>`) so mediators in **other** processes can fan out to
  them, and reads them back with a 5 s TTL cache. Entries are durable — never removed on shutdown, so
  jobs pile up in a stopped consumer's queue and are delivered on restart. Retiring a consumer is a
  manual `SREM` plus queue cleanup.
- **Cache invalidation.** A newly registered subscription would stay invisible to already-running
  mediators until their TTL expires, so `publish()` also announces the changed event ids on
  `event-bus:subs:changed` and every process drops the matching cache entry at once. Only ids whose
  `SADD` returned 1 are announced, so restarting a known subscriber is silent. The channel needs its
  own socket (`connection.duplicate()`): ioredis refuses regular commands on a subscribed connection.
  Losing the channel is a soft failure — logged, and the TTL still expires on its own.
- `RedisParkingService` holds events a mediator could not route because nobody was subscribed yet, in
  a plain Redis **list** (`event-bus:parked:<eventId>`), replayed once at a subscriber's first
  bootstrap. Inspect what went nowhere:
  ```bash
  redis-cli -u "$REDIS_URL" LRANGE event-bus:parked:auth.user.create 0 -1
  ```

> **Why parking and not dropping or failing:** [docs/adr/0005-parking-unrouted-events.md](../../../docs/adr/0005-parking-unrouted-events.md)

## When Redis is unreachable

Nothing on this connection rejects by itself: `maxRetriesPerRequest: null` (BullMQ's requirement for
blocking commands) plus ioredis' offline queue means a command against a dead broker waits, silently
and forever. Every path that a caller or the process itself waits on is therefore bounded:

- **Boot** — `RedisConnectionService.waitUntilReady(REDIS_READY_TIMEOUT)` runs before the first
  command, at the head of `RedisEventBusServer.listen()` *and* of the mediator's bootstrap hook.
  Two places, because an `onlyEmitting` service registers no microservice and runs only the hook.
  A rejection reaches `main.ts`, which logs it and exits 1.
- **Emit** — `RedisQueueClient.emit`/`emitMany` are raced against `REDIS_COMMAND_TIMEOUT` and throw,
  so the gRPC call that awaited the event fails instead of hanging. `getQueue()` is deliberately
  unbounded: the mediator's fan-out runs in a worker, and resuming when the broker returns is
  correct there.
- **Shutdown** — `quit()` is a command too, so it is only sent to a `ready` client (otherwise a
  plain `disconnect()`), and every BullMQ `close()` is raced against the same timeout. Without
  this the process ignores its own SIGTERM for as long as the outage lasts.
- **Logging** — the shared connection and the invalidation channel each report one line per outage
  and one on recovery. Left to itself ioredis prints a raw stack on every reconnect attempt,
  outside the app logger.

> **Why loudly here and softly in `@backend/cache`:** [docs/adr/0013-event-bus-fails-loud.md](../../../docs/adr/0013-event-bus-fails-loud.md)

## Env

`src/infrastructure/configs/redis.config.ts` owns every default; the eleven `REDIS_*` variables are
tabulated and explained in [docs/env.md](../../../docs/env.md). Two behaviours worth knowing here:
`REDIS_PARKING_MAX_LENGTH=0` disables parking, and `REDIS_IP_FAMILY` exists because managed private
networks are often IPv6-only.

The factory's shape follows the repo convention — fields, functions only where a member takes an
argument; see `backend/CLAUDE.md`.

The factory is registered as `registerAs('eventBusRedis', …)` and read by injecting
`redisConfig.KEY`, never by looking a getter up on `ConfigService`. That is load-bearing:
`getConnectionOptions` is a name `@backend/cache` and `@backend/event-bus-nats` use too, and an
unnamespaced factory merges into one flat store where the last module loaded wins.

> **Why the namespace:** [docs/adr/0012-namespaced-package-config.md](../../../docs/adr/0012-namespaced-package-config.md)

## Commands & gotchas

```bash
pnpm build            # format:generated → tsdown → dist
pnpm test             # unit jest; single file: pnpm test -- redis.queue.constants
pnpm test:e2e         # server-backed suite; auto-skips when no Redis answers
pnpm dev / test:watch / lint / format / format:generated / reset
```

- No `compile` here — `src/generated/` is regenerated by `pnpm compile:event-bus`.
- The unit suite covers the mechanism this adapter exists for (`@RedisController` rewriting patterns,
  the mediator's fan-out and parking) plus the pieces a broken one fails silently in: the
  subscription registry's cache and announcements, the server's bootstrap assertions and error
  normalisation, the interceptor's message recovery, and the config's keys and knobs.
- Every worker costs a Redis connection (BullMQ duplicates the shared one for blocking commands):
  mediators for the host's own events plus one per subscription. `RedisTopologyReporter` prints the
  running total at bootstrap — watch it as events grow.

### The e2e suite

Two specs under `src/interface/servers/` exercise the adapter against a real server:

```bash
pnpm docker:db           # or: docker run --rm -p 6379:6379 redis:latest
pnpm test:e2e
```

- `redis.transport.e2e-spec.ts` boots a **real Nest microservice** the way `main.ts` does, with three
  controllers carrying different `consumer` ids on `auth.user.create`. That is the only place the
  mediator's fan-out is visible for what it is, and the only coverage of the `failedReason` chain:
  the failing controller walks its attempts and the spec reads the message back out of the `failed`
  set.
- `redis.parking.e2e-spec.ts` reproduces the first-boot race on `storage.file.purge`: an
  `onlyEmitting` app emits with nobody subscribed, a second app registers for the first time and gets
  the replay, a third restart gets nothing.
- `test/redis-server.setup.js` is a jest `globalSetup`, not a `beforeAll`, for two reasons that both
  come down to timing: `redis.config.ts` validates env at module load, so the overrides have to be
  set before the spec is imported; and the server probe has to land in `process.env` before the
  workers fork, so the spec can pick `describe` vs `describe.skip` synchronously. Without a server
  jest reports the suites as *skipped* rather than passing on an empty run.
- The setup pins `REDIS_QUEUE_PREFIX=bull-e2e` and `REDIS_EVENT_BUS_NAMESPACE=event-bus-e2e`, so the
  suite cannot touch a local dev run's queues and registries, and `REDIS_JOB_ATTEMPTS=3` with
  `REDIS_JOB_BACKOFF_DELAY=100` so the retry ladder takes milliseconds instead of minutes.
- It probes with a raw socket rather than ioredis: a failed client connection leaves reconnect
  machinery behind that keeps jest from exiting, and the skip path is exactly the one that has to
  stay quiet.
- Each spec wipes only **its own** event's keys in `beforeAll` — a blanket wipe of the prefixes would
  let two files in parallel workers destroy each other's state. Keys are left behind afterwards, so a
  failed run can be inspected.
