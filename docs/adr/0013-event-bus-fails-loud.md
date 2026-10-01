# 0013 — The event bus fails loudly where the cache fails soft

**Status:** Accepted (2026-09-07)
**Applies to:** @backend/event-bus-redis, @backend/cache, backend.auth, backend.storage, backend.api-gateway

## Context

`@backend/cache` swallows every store failure and answers with the empty result
([ADR-0010](0010-cache-fails-soft.md)). It is tempting to give the event bus the same treatment —
one Redis, one outage, why should two packages behave differently? Measuring an actual outage
against `backend.auth` showed why they must.

The shared bus connection runs with `maxRetriesPerRequest: null`, which BullMQ requires for its
blocking commands, and ioredis' offline queue holds everything else until the socket returns.
Nothing on that connection rejects on its own. Three consequences, all observed:

- `UserCreateOneUseCase` awaits `eventBus.emitCreate(...)`, so a `createOne` over gRPC **never
  returned** — no success, no error, a caller hanging until its own deadline.
- Booting with Redis down left the process at "Starting Nest application…" **forever**:
  `RedisEventBusServer.listen()` published subscriptions into the offline queue, and a strategy
  that never calls its callback is a service that neither starts nor fails.
- `SIGTERM` during an outage hung too — `quit()` and BullMQ's `close()` are commands, and they
  joined the same queue. The process ignored its own shutdown signal.

All three were hidden behind a fourth defect: `bootstrap().then().catch(() => {})` in all three
services, which turns any startup rejection into an exit with code 0 and no log line.

The alternative — make emitting fail-soft, log a warning, let the write succeed — was rejected on
what the two subsystems are for. A cache miss costs a Postgres query; the data is still there. A
dropped `auth.user.create` costs a root folder that `backend.storage` will never create, and there
is nowhere to recover it from: no retry queue holds it, because the queue *is* the thing that was
unreachable. Silence would trade a visible error now for an invisible divergence discovered later.

## Decision

The event bus fails loudly and quickly; the cache degrades quietly. Concretely:

- **Bootstrap reports and exits.** All three `main.ts` log the resolved message (through
  `resolveErrorMessage`, since ioredis raises a message-less `AggregateError`) and `process.exit(1)`.
  A crash loop under `restart: unless-stopped` is a better state than a silent absence.
- **A ready gate before the first command.** `RedisConnectionService.waitUntilReady(timeoutMs)`
  (`REDIS_READY_TIMEOUT`, 10s) runs at the head of `RedisEventBusServer.listen()` and of
  `RedisMediatorService.onApplicationBootstrap()` — two entry points because an `onlyEmitting`
  service registers no microservice and only runs the hook. A rejection there travels to the
  bootstrap handler above.
- **Emits are bounded.** `RedisQueueClient.emit` / `emitMany` race `REDIS_COMMAND_TIMEOUT` (5s) and
  throw; the use-case returns `left` and the gRPC caller learns the event did not go out. The
  mediator's fan-out deliberately uses the unbounded `getQueue()`: it runs in a worker, not a
  request, and resuming when the broker returns is correct there.
- **Shutdown is bounded.** `quit()` is only sent to a `ready` client (otherwise `disconnect()`), and
  every BullMQ `close()` is raced against the same timeout, so a shutdown *because* Redis went away
  still ends.
- **The cache keeps its own rule, and gains the settings that make it true in wall-clock time.**
  `enableOfflineQueue: false` plus `commandTimeout` (`CACHE_COMMAND_TIMEOUT`, 1s): a lookup against
  a dead socket fails immediately and reads as a miss. Before this, "fail-soft" meant ~30 seconds of
  ioredis' reconnect ladder per request — technically soft, operationally an outage.

Both connections also log one line per outage and one on recovery, instead of leaving ioredis to
print a raw stack on every reconnect attempt.

## Consequences

- A Redis outage now costs exactly the writes that emit events. Reads, logins and the whole gRPC
  surface keep answering from Postgres, and the cache adds milliseconds rather than seconds.
- A user created while the broker is down is written to Postgres and the call still fails. The
  divergence is real, but it is visible to the caller at the moment it happens — the point of the
  decision. A transactional outbox is the fix if that is ever unacceptable; this ADR is the record
  of why it was not needed yet.
- Two timeouts are now tunable per deployment. Both defaults assume a broker on the same network;
  `REDIS_READY_TIMEOUT` in particular has to cover a cold start where Redis and the service come up
  together (`depends_on` in `docker-compose.yml` waits for the container, not for readiness).
- The gate makes an unreachable broker a startup failure rather than a degraded start. That is the
  deliberate half of this decision: `backend.auth` owns `auth.user.create`, and a service that
  cannot announce its writes should not be serving them.
