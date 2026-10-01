# 0006 — Subscriptions are scoped by a consumer id

**Status:** Accepted (2026-09-06)
**Applies to:** `@backend/event-bus-redis`, `@backend/event-bus-nats`

## Context

Nest keys `messageHandlers` by pattern. Two controllers of the same host subscribing to one event
therefore collapse: the second registration replaces the first, and both end up behind a single
subscription that load-balances instead of fanning out.

That was the behaviour of the old NATS wiring
(`@nestjs-plugins/nestjs-nats-jetstream-transport`, see [0007](0007-natsjs-v3-direct.md)), which
derived one durable per `(host, subject)` from a single `consumerOptions` object per host. The
Redis adapter would have the same problem for the same reason.

## Decision

A controller declares its system-wide id once, in its class decorator —
`@RedisController({ consumer: 'storage.file' })` / `@NatsController({ consumer: 'storage.file' })`,
shaped `<host>.<module>` — and every subscription it registers is scoped by it.

Mechanically: method decorators run before class decorators, so `ControllerMethods()` and
`@RedisEvent` / `@NatsEvent` can only store the bare event id or subject. The class decorator runs
last (class decorators apply bottom-up) and rewrites `PATTERN_METADATA` into
`<eventId>@<consumerId>`.

What the suffix then means differs by transport:

- **Redis** — it names a real BullMQ queue (`auth.user.create@storage.file`).
- **NATS** — it is a process-local Nest map key only. `NatsEventBusServer` strips it before touching
  NATS: the subject stays `auth-user-create` and the consumer id goes into the durable name
  (`storage-file-auth-user-create`, see `buildDurableName`).

## Consequences

- **`@RedisController` / `@NatsController` must sit above the transport's `ControllerMethods()`.**
  Decorator order is load-bearing, not stylistic. A pattern that reaches the strategy without the
  suffix fails bootstrap with an explicit message rather than quietly idling a queue or a durable.
- Retiring a consumer is manual on the Redis side — an `SREM` plus queue cleanup — because registry
  entries are deliberately durable: jobs pile up in a stopped consumer's queue and are delivered on
  restart, matching JetStream durable-consumer semantics.
- Renaming a controller's `consumer` id orphans its queue or durable and starts a fresh one.
