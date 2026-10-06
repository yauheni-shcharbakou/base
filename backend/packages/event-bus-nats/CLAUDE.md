# CLAUDE.md — @backend/event-bus-nats

Guidance for working inside `backend/packages/event-bus-nats`. Read first: the root `CLAUDE.md`
*Event-bus codegen pipeline* section, `backend/packages/event-bus/CLAUDE.md` (the abstract ports, the
naming rules and the **bus-wide semantics** — JSON payloads, at-least-once, error messages), and
`backend/CLAUDE.md` (shared package conventions). This file is the NATS JetStream runtime.

**Status: dormant.** `auth`/`storage` run on `@backend/event-bus-redis`, so no service imports this
package and `docker-compose.yml` starts a `nats` container only under the `e2e` profile. It stays generated, built and
unit-tested as the alternative broker — keep it working when changing the event bus.

## Dual nature

`src/generated/index.ts` is **emitted by this package's own compiler** (`compiler/`, run as its own
turbo `compile` task) — transports (`Nats<Service>Transport`), subscriber/handler interfaces,
`NatsClientFactory` and `NATS_HOST_STREAMS`. Everything else (`infrastructure/`, `interface/`,
`nats.module.ts`) is hand-written runtime.

```
compiler/
  main.ts           # builds the context, runs the adapter, writes ../src/generated/index.ts
  nats.adapter.ts   # EventBusAdapter subclass: imports, per-service transports, client, registry
  templates/*.pug   # nats.controller / nats.client / nats.registry
```

Mirrors `@backend/event-bus-redis/compiler/` structurally; the difference is in the templates, which
kebab-case `eventId` into subjects instead of using it verbatim as a queue name.

> **Why each package compiles itself:** [docs/adr/0002-codegen-task-per-package.md](../../../docs/adr/0002-codegen-task-per-package.md)

## Controllers

```ts
@NatsController({ consumer: 'storage.file' })
@NatsVideoTransport.ControllerMethods()
export class NatsFileController
  implements NatsVideoEventController, NatsUserCreateEventHandler
{
  async onUploaded(event: NestStorage.Video): Promise<void> {}
  async onUploadFinish(event: NestStorage.Video): Promise<void> {}
  async onUploadFail(event: NestStorage.Video): Promise<void> {}

  @NatsEvent(NatsUserTransport.CREATE)
  async onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: NatsMessageContext) {}
}
```

- **`ControllerMethods()` binds every event of its service**, so the class needs a handler for each —
  one it lacks throws a `TypeError` at class load (Nest's `EventPattern` reads the missing method's
  descriptor), and a new event in the strategy breaks every such class. To take a subset, subscribe
  per event with `@NatsEvent` and the `Nats<Service><Event>EventHandler` interface, as `backend.storage` does.
- `consumer` is the controller's system-wide id (`<host>.<module>`). Declared once, in
  `@NatsController`.
- **Keep `@NatsController` above the transport decorator.** It runs last (class decorators apply
  bottom-up) and rewrites `PATTERN_METADATA` into `<subject>@<consumerId>`; a pattern that reaches
  the strategy without the suffix fails bootstrap with an explicit message.
- The `@` suffix is a **process-local Nest map key only** — unlike Redis, where the same string names
  a real BullMQ queue. `NatsEventBusServer` strips it before touching NATS: the subject stays
  `auth-user-create`, and the consumer id goes into the durable name
  (`storage-file-auth-user-create`, see `buildDurableName`).
- `context?: NatsMessageContext` is only injected when decorated with `@Ctx()` (and then the payload
  needs `@Payload()`) — standard Nest behaviour.

> **Why subscriptions carry a consumer id:** [docs/adr/0006-consumer-scoped-subscriptions.md](../../../docs/adr/0006-consumer-scoped-subscriptions.md)
> **Why there is no fan-out mediator here:** [docs/adr/0004-redis-mediator-fan-out.md](../../../docs/adr/0004-redis-mediator-fan-out.md)

## Layer map (hexagon)

Concrete adapter for the abstract ports of `@backend/event-bus`:

- **infrastructure/** — driven/outbound: `configs/` (connection, stream and consumer options),
  `constants/` (DI tokens, pattern/durable helpers), `types/` (`NatsStreamData`,
  `NatsConsumerSubscription`), `utils/` (`globalStreamRegistry`, `globalConsumerRegistry`),
  `connections/` (the shared `NatsConnection`), `clients/` (`NatsJetStreamClient` — the publisher),
  `provisioners/` (`NatsStreamProvisionerService` — declares the host's streams).
- **interface/** — driving/inbound: `decorators/` (`@NatsController`, `@NatsEvent`), `contexts/`
  (`NatsMessageContext`), `interceptors/` (ack/nak), `servers/` (`NatsEventBusServer`, the
  `CustomTransportStrategy` that runs the durable consumers).
- **nats.module.ts** — composition root.
- **generated/** — one codegen file spanning both layers.

## The client — nats.js v3

The package sits directly on the nats.js v3 client and owns its connection, client and server,
mirroring the connection → client → server layout of `@backend/event-bus-redis`. Three scoped
packages are declared instead of the deprecated monolithic `nats`: `@nats-io/transport-node`
(`connect`, `NodeConnectionOptions`), `@nats-io/jetstream` (everything JetStream) and
`@nats-io/nats-core` (`nanos()`, `NatsConnection`, `WithRequired` — declared explicitly because
`transport-node` re-exports it only through an `/internal` subpath).

> **Why no wrapper library, and what v3 changed:** [docs/adr/0007-natsjs-v3-direct.md](../../../docs/adr/0007-natsjs-v3-direct.md)

## Module (`nats.module.ts`)

- `NatsModule.forRoot({ host: EventBusHost, onlyEmitting? })` — global. Always provides the shared
  connection, `NatsJetStreamClient` and the **stream provisioner**: a host must declare the streams of
  the events it owns even when it only emits, otherwise it publishes into a stream that does not
  exist. Unless `onlyEmitting`, it also provides `NATS_MICROSERVICE_OPTIONS`, connected in `main.ts`
  via `app.connectMicroservice(app.get(NATS_MICROSERVICE_OPTIONS))`.
- `NatsModule.forFeature({ EventBus })` — binds an abstract bus to its concrete client via
  `NatsClientFactory`.
- The connection provider is registered **last** on purpose: Nest runs shutdown hooks in provider
  order, so the socket is drained after the consumers are stopped.

## Streams & registries

- Stream names stay host-scoped: `<host>-<service>-stream` (`auth-user-stream`); subjects are the
  kebab-cased event ids (`auth-user-create`).
- `globalStreamRegistry` accumulates `stream → subjects` as `ControllerMethods()` / `@NatsEvent` run
  on class load; the server strategy reads it to declare the streams it **consumes** (their owner may
  not have started yet) and to resolve a subject to its stream.
- `globalConsumerRegistry` accumulates `NatsConsumerSubscription` entries as `@NatsController` runs;
  the strategy reads it at `listen()` to create one durable per entry. Mirrors `globalQueueRegistry`.
- `NATS_HOST_STREAMS` (generated) maps host → the streams it **owns**; `forRoot` feeds the host's
  entry to the provisioner. Mirrors `REDIS_HOST_EVENTS`.
- Stream declaration is idempotent: an existing stream only gets its `subjects` updated, so manual
  operator tuning of retention/storage survives a redeploy. Durables are created only when absent.

## Delivery semantics

One durable per (subject, consumerId): `ack_policy` explicit, `ack_wait` 30 s, `max_deliver` 10,
`max_ack_pending` 1. `NatsControllerInterceptor` acks on success and naks on failure;
`NatsEventBusServer` naks whatever throws outside the interceptor's observable (a decode failure,
say). After `max_deliver` the server stops redelivering and emits a
`$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES` advisory — **there is no DLQ** the way BullMQ's `failed`
set is one, so failures have to be caught in the logs.

Because the log line is the only record, both places resolve the message through
`resolveErrorMessage()` from `@backend/common` (fallback `NATS_ERROR_FALLBACK`). The two must not
both answer for the same failure, which is what `NatsMessageContext.isAnswered()` is for: an error
the interceptor already handled still surfaces in the server's `catch`, but by then Nest's
`RpcExceptionsHandler` has replaced it with a bare `Internal server error` — logging that would bury
the interceptor's accurate line under a useless one, and nak an already-naked message. So the server
bails out on an answered context and only reports what nothing else saw.

`max_ack_pending` — not any client-side buffer — is what bounds in-flight messages: the server
withholds the next one until the current is acked. It is the equivalent of the Redis worker
`concurrency`, overridable globally with `NATS_CONSUMER_CONCURRENCY` or per controller with
`@NatsController({ concurrency })`.

### Difference from the Redis adapter

`deliver_policy` defaults to `all`, so a subscriber added later replays the stream from the beginning
the first time its durable is created — full history, bounded only by the stream's retention. The
Redis adapter has no equivalent: it parks unrouted events in a capped list and replays only that tail
(see [ADR-0005](../../../docs/adr/0005-parking-unrouted-events.md)). Set `NATS_DELIVER_POLICY=new` to
opt out of the replay.

## Env

`src/infrastructure/configs/nats.config.ts` owns every default; the five `NATS_*` variables are
tabulated in [docs/env.md](../../../docs/env.md).

## Commands & gotchas

```bash
pnpm build            # format:generated → tsdown → dist
pnpm test             # unit vitest; single file: pnpm test -- nats.consumer.constants
pnpm test:e2e         # broker-backed suite; auto-skips when no broker answers
pnpm dev / test:watch / lint / format / format:generated / reset
```

- No `compile` here — `src/generated/` is regenerated by `pnpm compile:event-bus`.
- The unit suite covers the mechanism this adapter exists for: `@NatsController` rewriting patterns
  and two controllers on one subject ending up with two distinct durables.

### The e2e suite

`src/interface/servers/nats.transport.e2e-spec.ts` is the only place the adapter is exercised against
a real broker, since no service wires this package:

```bash
pnpm docker:e2e          # from the root; or: docker run --rm -p 4222:4222 nats:2-alpine -js
pnpm test:e2e
```

- It boots a **real Nest microservice** the way `main.ts` does, with three controllers carrying
  different `consumer` ids on `auth.user.create`. That is what makes it the only coverage
  `NatsControllerInterceptor` has: the handlers never ack, so a green run proves the interceptor
  acked, and the redelivery ladder proves it naked.
- Two things happen before the spec is imported, both for timing: `nats.config.ts` validates env
  at module load, so `NATS_MAX_DELIVER=3` is set in `vitest.e2e.config.mts`'s `env`; and
  `test/nats-broker.setup.ts`, a Vitest `globalSetup`, probes the broker and `provide`s the answer,
  so the spec picks `describe` vs `describe.skip` through `inject('natsBroker')` at module scope.
  Without a broker the suite reports as *skipped* rather than passing on an empty run.
- It wipes `auth-user-stream` in `beforeAll` (`deliver_policy: all` would otherwise replay the
  previous run's history) and leaves it behind afterwards, so a failure can be inspected in the
  broker. Reruns stay deterministic either way.
