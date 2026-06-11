# CLAUDE.md — @backend/common

Guidance for working inside `backend/packages/common`. The hexagonal/use-case architecture these abstractions support is described in the root `CLAUDE.md` *Backend service architecture* section — read it first.

## What this is

The hand-written core of the backend's data layer: the abstract **contracts** that every service's domain depends on and that `@backend/pg` / `@backend/mongo` implement. Layered like the apps (`domain` / `application` / `infrastructure`), split into three areas re-exported from `src/index.ts`: `database/` (CRUD contracts), `migration/` (migration contracts — mirrors the `migration/` area in `@backend/pg` / `@backend/mongo`), and `common/` (cross-cutting primitives, infrastructure-only). NOT generated — edit freely.

## What it exports

**`database/` — the data-layer CRUD contract:**
- `DatabaseRepository<Entity, Query, Create, Update>` (in `domain/repositories`) — abstract repository with the full CRUD + bulk surface, all `Either`-typed (`getById`/`getOne`/`getMany`/`getList`, `saveOne`/`saveMany`, `updateById`/`updateOne`/`updateMany`, `delete*`, `count`, `distinct`, `bulkUpdate`). Every service domain repository extends this; `@backend/pg`/`@backend/mongo` provide the impls.
- Helper types (in `domain/types`): `QueryOf`, `CreateOf`, `UpdateOf` (`{ set, remove, inc }`), `OptionsOf` (`populate`), `BulkUpdate`, `DatabaseRepositoryGetList(Res)`, `ExcludeDatabaseSystemFields`.
- Abstract CRUD **use-cases**: `GetUseCase`, `CreateUseCase`, `UpdateUseCase`, `DeleteUseCase`, `IsExistsUseCase` — thin `Either` wrappers over a repository. Service use-cases extend these instead of re-implementing CRUD.
- `DatabaseRunnerService` (`isolatedRun()` for transactions) + `EmptyDatabaseRunnerService` no-op impl (`infrastructure/services`).

**`migration/` — migration contracts (mirrors the `migration/` area in `@backend/pg` / `@backend/mongo`):**
- `MigrationTask` (`up()`), `MigrationService` (`runTasks()`), the `Migration` entity and `MigrationStatus` enum. The SQL / data-seeding impls live in `@backend/pg` / `@backend/mongo`.

**`common/` — cross-cutting primitives (infrastructure-only):**
- `commonConfig()` / `CommonConfig` — base config (`port`, `isDevelopment`) every service `config.ts` spreads.
- `MemoryCache<Value>` — TTL Map cache (per-key `setTimeout` eviction).
- `HttpExceptionMapper.getMessage()` — extracts a string message from a Nest `HttpException`.

## Commands

```bash
pnpm build            # tsdown → dist (cjs + d.ts)
pnpm dev              # tsdown --watch
pnpm lint             # eslint --fix
pnpm format           # prettier src
pnpm reset            # rm -rf .turbo dist node_modules
```

Consumers resolve `dist/`; turbo's `^build` rebuilds before downstream `build`/`compile`. Rebuild after changes or run `pnpm dev`.

## When editing

- This package defines contracts, not behavior — keep DB-engine specifics in `@backend/pg` / `@backend/mongo`, not here.
- Adding a `DatabaseRepository` method? It ripples to every impl in pg/mongo — update them too.
- `lodash` (used by `MemoryCache`, `HttpExceptionMapper`) is declared in this package's deps, with `@types/lodash` in devDeps.
- Depends on `@backend/proto` (`NestCommon.Entity` etc.) and `@nestjs/common`, so it's backend-only; don't import it from frontend.
