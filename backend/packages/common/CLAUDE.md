# CLAUDE.md — @backend/common

Guidance for working inside `backend/packages/common`. The hexagonal/use-case architecture these abstractions support is described in the root `CLAUDE.md` _Backend service architecture_ section — read it first.

## What this is

The hand-written core of the backend's data layer: the abstract **contracts** that every service's domain depends on and that `@backend/pg` / `@backend/mongo` implement. Layered like the apps (`domain` / `application` / `infrastructure`), split into three areas re-exported from `src/index.ts`: `database/` (CRUD contracts), `auth/` (the JWT payload contract shared by `auth` and `api-gateway`), and `common/` (cross-cutting primitives, infrastructure-only). NOT generated — edit freely.

## What it exports

**`database/` — the data-layer CRUD contract:**

- `DatabaseRepository<Entity, Query, Create, Update>` (in `domain/repositories`) — abstract repository with the full CRUD + bulk surface, all `Either`-typed (`getById`/`getOne`/`getMany`/`getList`, `saveOne`/`saveMany`, `updateById`/`updateOne`/`updateMany`, `delete*`, `count`, `distinct`, `bulkUpdate`). Every service domain repository extends this; `@backend/pg`/`@backend/mongo` provide the impls.
- Helper types (in `domain/types`): `QueryOf`, `CreateOf`, `UpdateOf` (`{ set, remove, inc }`), `OptionsOf` (`populate`), `BulkUpdate`, `DatabaseRepositoryGetList(Res)`, `ExcludeDatabaseSystemFields`.
- Abstract CRUD **use-cases**: `GetUseCase`, `CreateUseCase`, `UpdateUseCase`, `DeleteUseCase`, `IsExistsUseCase` — thin `Either` wrappers over a repository. Service use-cases extend these instead of re-implementing CRUD.
- `DatabaseRunnerService` (`isolatedRun()` for transactions) + `EmptyDatabaseRunnerService` no-op impl (`infrastructure/services`).

**`auth/` — the JWT contract shared by `auth` (signs) and `api-gateway` (verifies):**

- `AuthTokenPayload` (`id`, `login`, `role`) and `AuthTokenPayloadParsed` (adds `aud`, `iat`, `exp`, `iss`) — the access/refresh token payload. Both services must agree on it, so it lives here rather than inside `backend.auth`.
- `AuthTokenAudience` (`access` / `refresh`) — the token kind, carried as the standard `aud` claim. It is set and enforced through the jwt `audience` sign/verify option (part of every token config), never assembled into the payload by hand. Access is RS256 and refresh is HS256, so the signing key alone no longer separates the two kinds.
- `getAuthTokenIssuer(isDevelopment)` and `AUTH_TOKEN_ALGORITHM` (`RS256`) — access tokens are signed with an RSA private key in `auth` and verified with the public key in `api-gateway`; keeping issuer/algorithm here stops the two sides from drifting apart.

**`common/` — cross-cutting primitives (infrastructure-only):**

- `commonConfig()` / `CommonConfig` — base config (`port`, `isDevelopment`) every service `config.ts` spreads.
- `MemoryCache<Value>` — TTL Map cache (per-key `setTimeout` eviction). Exported but unused; a cache belongs in `@backend/cache`.
- `HttpExceptionMapper.getMessage()` — extracts a string message from a Nest `HttpException`.
- `resolveErrorMessage(error, fallback?)` — first non-empty message in an error's `cause` chain, descending into an `AggregateError`'s `errors`, with the error's class name as the last resort. A wrapper error often carries none of its own (a MikroORM `DriverException` over the `AggregateError` Node raises for a refused connection). Shared because both event-bus transports need it: `@backend/event-bus-redis` writes the result into a BullMQ job's `failedReason` (its DLQ), and `@backend/event-bus-nats` has no DLQ at all, so the log line is the only record of a failure. Callers pass their own `fallback` (`REDIS_ERROR_FALLBACK` / `NATS_ERROR_FALLBACK`) to name the subsystem.
- `decodeBase64Pem(value)` — decodes a base64-encoded PEM key from an env var (multi-line PEM does not survive `.env` / docker-compose / Railway).

## Commands

```bash
pnpm build            # tsdown → dist (cjs + d.ts)
pnpm dev              # tsdown --watch
pnpm test             # vitest; single file: pnpm test -- error.utils
pnpm test:watch
pnpm lint             # eslint --fix
pnpm format           # prettier src
pnpm reset            # rm -rf .turbo dist node_modules
```

A spec must import its subject by relative path, not through `@backend/common`: the barrel pulls in `commonConfig`, which validates env at import time.

## When editing

- This package defines contracts, not behavior — keep DB-engine specifics in `@backend/pg` / `@backend/mongo`, not here.
- Adding a `DatabaseRepository` method? It ripples to every impl in pg/mongo — update them too.
- `lodash` (used by `MemoryCache`, `HttpExceptionMapper`) is declared in this package's deps, with `@types/lodash` in devDeps.
- Depends on `@backend/proto` (`NestCommon.Entity` etc.) and `@nestjs/common`, so it's backend-only; don't import it from frontend.
