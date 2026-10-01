# 0001 — Redis/BullMQ is the live event-bus transport, NATS stays dormant

**Status:** Accepted (2026-09-06)
**Applies to:** `@backend/event-bus-redis`, `@backend/event-bus-nats`, `backend.auth`, `backend.storage`

## Context

The event bus is deliberately broker-agnostic: `@backend/event-bus` owns the abstract ports, and a
transport package supplies the adapter. Two adapters exist and both are complete — NATS JetStream
came first, Redis/BullMQ second.

Redis was already in the stack for other reasons, and the deployment target runs it as a managed
add-on. Running a second broker only for the event bus would have doubled the operational surface
of a system whose event volume is small.

## Decision

`backend.auth` and `backend.storage` run on `@backend/event-bus-redis`. `docker-compose.yml` starts
a `redis` service in the `local`/`all` profiles and no `nats` container.

`@backend/event-bus-nats` stays in the repo, generated, built and unit-tested, but is imported by no
service. It is maintained as the alternative broker, not deleted.

## Consequences

- Swapping transports is a matter of module and controller imports — the abstract buses that
  use-cases depend on do not change.
- The NATS package has to keep working when the event bus changes, without a service exercising it.
  Its e2e suite against a real broker is the only thing that proves the adapter end to end, which
  is why that suite is worth its maintenance cost.
- BullMQ is a work queue, not pub/sub, which forces a fan-out stage the NATS adapter does not need
  — see [0004](0004-redis-mediator-fan-out.md).
