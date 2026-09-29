# Architecture Decision Records

Dated records of *why* a structural decision was made. They are the counterpart to `CLAUDE.md`
files, and the split is strict:

| | `CLAUDE.md` | `docs/adr/` |
|---|---|---|
| Answers | *what is true now, what to do* | *why it was decided, what was traded away* |
| Lifetime | rewritten whenever reality changes | **immutable once merged** |
| Loading | pulled into context automatically | read on demand, via a link from the owning `CLAUDE.md` |

## Rules

- **An ADR is never edited after it lands** (typos aside). A decision that changes gets a *new*
  ADR with `Supersedes 000N` in its status; the old one is amended with `Superseded by 000M` —
  that one-line status edit is the only permitted change.
- **One owner per fact.** If a rationale lives here, the `CLAUDE.md` that owns the corresponding
  rule carries the rule plus a link — not a summary of the reasoning.
- **Numbering is sequential and never reused**, even if an ADR is superseded or rejected.
- Format is MADR-lite: `Status` / `Context` / `Decision` / `Consequences`, plus an
  `**Applies to:**` line naming the packages it governs.

Use the `/adr` skill (`.claude/skills/adr/`) to add one — it picks the next number, fills the
template, updates this index, and links the ADR from the owning `CLAUDE.md`.

## Index

| # | Title | Status | Applies to |
|---|---|---|---|
| [0001](0001-redis-as-live-transport.md) | Redis/BullMQ is the live event-bus transport, NATS stays dormant | Accepted | `@backend/event-bus-redis`, `@backend/event-bus-nats` |
| [0002](0002-codegen-task-per-package.md) | One event-bus codegen task per target package | Accepted | `@backend/event-bus*` |
| [0003](0003-service-scoped-naming.md) | Generated event-bus names are service-scoped, not host-scoped | Accepted | `@backend/event-bus*` |
| [0004](0004-redis-mediator-fan-out.md) | Redis fans out through a mediator; NATS needs none | Accepted | `@backend/event-bus-redis`, `@backend/event-bus-nats` |
| [0005](0005-parking-unrouted-events.md) | Unrouted events are parked, not dropped | Accepted | `@backend/event-bus-redis` |
| [0006](0006-consumer-scoped-subscriptions.md) | Subscriptions are scoped by a consumer id | Accepted | `@backend/event-bus-redis`, `@backend/event-bus-nats` |
| [0007](0007-natsjs-v3-direct.md) | Sit directly on the nats.js v3 client, drop the wrapper library | Accepted | `@backend/event-bus-nats` |
| [0008](0008-generated-env-tables.md) | Env tables are generated from the zod schemas | Accepted | `@packages/env-docs`, `docs/env.md` |
| [0009](0009-cache-one-package-driver-switch.md) | The cache is one package with a driver switch, not a package per adapter | Accepted | `@backend/cache` |
| [0010](0010-cache-fails-soft.md) | Cache operations fail soft instead of returning `Either` | Accepted | `@backend/cache` |
| [0011](0011-identity-cached-in-auth.md) | The identity read is cached in auth, not in the gateway's access guard | Accepted | `backend.auth`, `backend.api-gateway` |
| [0012](0012-namespaced-package-config.md) | A package's config factory is registered under its own namespace | Accepted | `@backend/cache`, `@backend/event-bus-redis`, `@backend/event-bus-nats` |
| [0013](0013-event-bus-fails-loud.md) | The event bus fails loudly where the cache fails soft | Accepted | `@backend/event-bus-redis`, `@backend/cache`, backend apps |
| [0014](0014-video-uploads-bypass-the-backend.md) | Video bytes go browser → Bunny directly, and the callback lands on storage | Accepted | `backend.storage`, `backend.api-gateway`, `frontend.admin` |
| [0015](0015-file-uploads-presigned-s3-put.md) | File and image bytes go browser → Bunny Storage over a pre-signed S3 PUT, confirmed by a call | Accepted | `backend.storage`, `backend.api-gateway`, `frontend.admin` |
| [0016](0016-provider-purge-over-the-event-bus.md) | Provider objects are purged over the event bus, and deleted storage objects are swept by a cron | Accepted | `backend.storage`, `@backend/event-bus`, `@backend/event-bus-redis` |
| [0017](0017-database-specs-on-node-test.md) | Database specs run on `node:test` against a migrated Postgres, not on Jest | Accepted | `backend.storage` |
| [0018](0018-folder-paths-computed-on-read.md) | Folder paths are computed on read, and a folder's visibility cascades in its own transaction | Accepted | `backend.storage`, `@backend/event-bus`, `@backend/event-bus-redis`, `@backend/event-bus-nats` |
| [0019](0019-tree-writes-under-one-advisory-lock.md) | Writes to the storage-object tree run under one advisory lock | Superseded in part by 0021 | `backend.storage` |
| [0020](0020-server-action-failures-as-values.md) | Admin server actions return their failure as a value, and the gateway keeps the callee's status | Accepted | `frontend.admin`, `@backend/grpc`, `backend.api-gateway` |
| [0021](0021-storage-tree-closed-per-owner.md) | A user's storage tree is closed, and its writes queue per owner | Accepted | `backend.storage`, `backend.api-gateway` |
| [0022](0022-migrations-through-the-mikro-orm-cli.md) | Migrations run through the MikroORM CLI, and auth seeds its own first admin | Accepted | `@backend/pg`, `@backend/common`, `@backend/mongo`, `backend.auth`, `backend.storage` |
| [0023](0023-proto-codegen-task-per-package.md) | One proto codegen task per target package | Accepted | `@packages/proto`, `@backend/proto`, `@frontend/proto` |
| [0024](0024-gateway-rate-limit-counters-in-redis.md) | The gateway's rate-limit counters live in Redis, behind `@backend/cache` | Accepted | `backend.api-gateway`, `@backend/cache` |
