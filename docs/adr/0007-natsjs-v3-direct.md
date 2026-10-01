# 0007 — Sit directly on the nats.js v3 client, drop the wrapper library

**Status:** Accepted (2026-09-06)
**Applies to:** `@backend/event-bus-nats`

## Context

The adapter was built on `@nestjs-plugins/nestjs-nats-jetstream-transport`, which takes the Nest
pattern as the subject and builds one consumer config per host. That shape cannot express a
per-controller durable, which is what [0006](0006-consumer-scoped-subscriptions.md) requires.

Separately, nats.js v3 deprecated the monolithic `nats` package and split it into scoped ones.

## Decision

Drop the wrapper. The package owns its connection, client and server directly, mirroring the
connection → client → server layout of `@backend/event-bus-redis`, and declares three scoped
packages instead of one:

- **`@nats-io/transport-node`** — `connect()` and `NodeConnectionOptions` (what `connect` actually
  takes; it narrows `tls` to the Node shape, so `natsConfig.getConnectionOptions` returns it rather
  than the core `ConnectionOptions`).
- **`@nats-io/jetstream`** — everything JetStream: `jetstream(nc)` / `jetstreamManager(nc)`,
  `JsMsg`, `ConsumerMessages`, `PubAck`, the config types and the policy enums.
- **`@nats-io/nats-core`** — `nanos()`, `NatsConnection`, `WithRequired`. Declared explicitly even
  though `@nats-io/transport-node` re-exports it, because that re-export goes through the
  `@nats-io/nats-core/internal` subpath.

## Consequences

Three v3 API changes shaped the code:

- **`NatsConnection#jetstream()` / `#jetstreamManager()` are gone.** `NatsConnectionService` builds
  both through the module-level functions and memoizes them — creating the manager round-trips to
  the server, and the strategy asks for one per subscription.
- **`JSONCodec` is gone.** `NatsJetStreamClient.emit` publishes `JSON.stringify(event)` (a `Payload`
  may be a string, which the client encodes as UTF-8 itself, so the wire bytes are unchanged) and
  the server decodes with `msg.json()`, which throws on a malformed payload exactly where the codec
  used to — the catch turns that into a nak.
- **`jsm.streams.add()` requires `name`**, which is why `getStreamConfig` returns
  `WithRequired<Partial<StreamConfig>, 'name'>`.
