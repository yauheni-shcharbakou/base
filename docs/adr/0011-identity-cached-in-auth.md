# 0011 — The identity read is cached in auth, not in the gateway's access guard

**Status:** Accepted (2026-09-07)
**Applies to:** `backend.auth`, `backend.api-gateway`, `@backend/cache`

## Context

Every unary gRPC call into `backend.api-gateway` passes `GrpcAccessUnaryGuard`, which calls
`AccessService.checkUnaryAccess` → `auth.me` over gRPC → `AuthGetUserByTokenUseCase` → one
`SELECT` by primary key. So a single REST request costs a gRPC hop plus a database read, on a value
that changes rarely.

The obvious place to cache it is where the cost is measured: in `checkUnaryAccess`, keyed by the
access token. That removes both the hop and the query, and it is the change a reader profiling the
gateway will propose.

It does not survive the invalidation question. The gateway holds no database and no event bus — by
design ([its `CLAUDE.md`](../../backend/apps/api-gateway/CLAUDE.md) states the absence as a
property, not an omission) — so it cannot learn that a user's role changed or that the user was
deleted. A token-keyed cache there can only expire, which turns "a revoked admin loses access
immediately" into "…within the TTL". Restoring the guarantee would mean subscribing the gateway to
`auth.user.*` events, i.e. giving the edge service a Redis connection, `bullmq`, and a second
reason to be redeployed when the bus changes.

The service that writes the user is `auth`. There, invalidation is a method call.

## Decision

`backend.auth` wires `CacheModule.forRoot({ namespace: 'auth' })`. `UserModule` provides the
`USER_CACHE` token — the global `CacheService` scoped to `user`, so keys read
`cache:auth:user:<id>`.

- `AuthGetUserByTokenUseCase` reads through that cache after parsing the access token, and stores
  the user on a miss. Cache errors are the `CacheService`'s fail-soft business
  ([ADR-0010](0010-cache-fails-soft.md)): a dead Redis degrades to today's behaviour.
- `UserUpdateOneUseCase` evicts the key of the entity it updated; `UserDeleteUseCase` evicts on
  `afterSingleDeletion` and clears the whole scope on `deleteMany`, which reports no ids.
- `AccessService.checkUnaryAccess` is unchanged. The gateway still asks auth on every request and
  still holds no cache of its own.

`CACHE_TTL` (300 s) stays as a second line of defence for writes that bypass the use-cases —
migrations, migrator tasks, manual SQL.

## Consequences

- The database read disappears from the hot path; the gRPC hop does not. That was the trade for
  keeping revocation immediate. If the hop ever shows up in a profile, the answer is a batched or
  streaming access check, not a cache the gateway cannot invalidate.
- Any future write path to a user must evict `cache:auth:user:<id>`. There are three today and all
  three go through use-cases; a repository-level write would silently serve a stale role for up to
  `CACHE_TTL`.
- The gateway's "no infrastructure" property holds, so this ADR is also the answer to "why doesn't
  the guard just cache?".
- A cached user crosses the store as JSON, so `createdAt` returns as a string and is rebuilt before
  the value leaves the use-case — the same trap the event bus documents for its payloads.
