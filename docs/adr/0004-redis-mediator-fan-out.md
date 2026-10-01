# 0004 — Redis fans out through a mediator; NATS needs none

**Status:** Accepted (2026-09-06)
**Applies to:** `@backend/event-bus-redis`, `@backend/event-bus-nats`

## Context

The two transports differ in one property that shapes everything downstream of it.

JetStream is **pub/sub**: one subject, many durable consumers, each getting its own copy. BullMQ is
a **work queue**: a job is delivered to exactly one worker. A single BullMQ queue therefore cannot
feed several subscribers — whichever worker grabs the job first is the only one that sees it.

## Decision

**Redis** re-publishes explicitly, in three stages:

```
emit  →  Queue('auth.user.create')                          the event queue (one owner: the host)
         Worker('auth.user.create')                         mediator, fan-out stage
           → SMEMBERS event-bus:subs:auth.user.create       ['storage.file', 'storage.storage-object']
           → Queue('auth.user.create@storage.file').add(…)  one queue per (event, controller)
         Worker('auth.user.create@storage.file')            consumer, calls the controller method
```

The consumer id has to name a real queue, so subscribers are discovered at runtime through a
Redis-backed registry (`SADD event-bus:subs:<eventId>`) that every service publishes at bootstrap.
`RedisMediatorService` owns the fan-out stage; it belongs to the host that owns the event, so
`RedisModule.forRoot` provides it even in `onlyEmitting` mode.

**NATS** does none of this. One durable per `(subject, consumerId)` is the whole mechanism — the
consumer id goes into the durable name (`storage-file-auth-user-create`) instead of into a
re-published queue, and the distributed subscription registry has no counterpart. The slot the
mediator occupies in `RedisModule.forRoot` is taken by `NatsStreamProvisionerService`.

## Consequences

- Redis pays one extra queue and one extra worker per `(event, subscriber)` pair, and every worker
  costs a Redis connection (BullMQ duplicates the shared one for blocking commands).
  `RedisTopologyReporter` prints the running total at bootstrap so the growth stays visible.
  The cheaper alternative, if it ever matters, is fanning out in the producer instead of via the
  mediator.
- Fan-out is at-least-once on top of at-least-once delivery, so subscriber handlers must be
  idempotent either way.
- The registry introduces a first-start race — an event emitted before a brand-new consumer has
  registered has nowhere to go. See [0005](0005-parking-unrouted-events.md).
- `:` cannot appear in a queue name (BullMQ's `QueueBase` throws, because `:` is the Redis key
  delimiter in `<prefix>:<queueName>:<type>`), which is why the subscriber suffix is `@`.
