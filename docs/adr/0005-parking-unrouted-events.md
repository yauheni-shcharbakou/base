# 0005 — Unrouted events are parked, not dropped

**Status:** Accepted (2026-09-06)
**Applies to:** `@backend/event-bus-redis`

## Context

The Redis mediator routes an event by reading the subscriber set a consumer publishes at bootstrap
([0004](0004-redis-mediator-fan-out.md)). An event emitted before a brand-new consumer has ever
registered finds an empty set.

Three options were on the table, and two of them fail:

- **Drop it** — the original behaviour. A deployment that starts the producer before the new
  subscriber silently loses the events in between, and there is no record that it happened.
- **Fail the job** — retries would not help, because nothing is going to register during the retry
  ladder. Worse, events with no subscriber *at all* (`storage.image.delete` is emitted into
  nothing today) would burn ten attempts each and fill the DLQ with non-failures.

## Decision

`RedisParkingService` writes the unrouted event into a plain Redis **list**
(`event-bus:parked:<eventId>`) — not a queue, because nothing should drain it in the background.
It is read exactly once, at a subscriber's first bootstrap: `RedisSubscriptionRegistry.publish()`
returns the subscriptions whose `SADD` answered `1`, and `RedisEventBusServer.listen()` replays
their parked entries into their own queues using the same `buildFanOutJobId()` the fan-out uses,
so an event that was both parked and fanned out is still delivered once.

The read is **non-destructive**: two brand-new consumers of one event need the same entries, and
there is no safe moment to delete them for everyone. The list is bounded instead — `LTRIM` to
`REDIS_PARKING_MAX_LENGTH`, `EXPIRE` to `REDIS_PARKING_TTL`, mirroring the job retention
(`count` of `removeOnComplete`, `age` of `removeOnFail`).

After parking, the mediator re-reads the consumer set **past** the 5 s TTL cache: a consumer that
registered between the cached read and the park would otherwise have replayed too early to see the
entry. That costs one extra `SMEMBERS` per parked event, in a background worker.

## Consequences

- No manual `SADD` seeding is needed when adding a subscriber to an existing event.
- Parking is unconditional, so an event nobody subscribes to also accumulates a capped list. That
  doubles as the answer to "what is being emitted into nothing":
  ```bash
  redis-cli -u "$REDIS_URL" LRANGE event-bus:parked:auth.user.create 0 -1
  ```
- `REDIS_PARKING_MAX_LENGTH=0` disables parking and restores the old drop-on-no-consumers
  behaviour.
- This is a narrower guarantee than the NATS adapter's, which does not need it:
  `deliver_policy: all` replays the stream from the beginning the first time a durable is created,
  so a late subscriber gets the full history rather than a capped tail
  (`NATS_DELIVER_POLICY=new` opts out).
