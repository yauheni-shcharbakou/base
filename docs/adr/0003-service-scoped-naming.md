# 0003 — Generated event-bus names are service-scoped, not host-scoped

**Status:** Accepted (2026-09-06)
**Applies to:** `@backend/event-bus`, `@backend/event-bus-redis`, `@backend/event-bus-nats`

## Context

`EventBusStrategy` is shaped `[host][service][event]`, so every generated artifact could be named
after either the `(host, service)` pair or the service alone. Host-prefixed names
(`AuthUserEventBus`, `NatsAuthUserTransport`) are collision-proof by construction but verbose at
every call site — and a use-case injecting a bus already knows which host it is running in.

## Decision

Generated class and interface names are derived from the **service name alone**; the host is
dropped: `<Service>EventBus`, `Nats<Service>Transport`, `Redis<Service>EventController`, and so on.

Wire identifiers keep the host, because they are addresses in a shared namespace rather than local
symbols:

- event ids — dot-cased `host.service.event` (`auth.user.create`), used verbatim as Redis queue
  names and kebab-cased into NATS subjects (`auth-user-create`);
- JetStream stream names — `host-service-stream` (`auth-user-stream`).

## Consequences

- **Service names must be unique across all hosts** in `EventBusStrategy`. Two hosts declaring a
  service of the same name make the compiler emit colliding class names. This is the one real trap
  of the decision, and it is recorded as a rule in `backend/packages/event-bus/CLAUDE.md`.
- The compiler exposes event ids raw (`method.eventId`) and each adapter decides how to shape them,
  so a future transport can pick its own encoding without touching the ports package.
