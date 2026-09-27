# CLAUDE.md — @backend/pg

Guidance for working inside `backend/packages/pg`. The data-layer contracts (`DatabaseRepository`, `MigrationTask`, …) live in `@backend/common`; the migrator sub-app and the `migrate*` app scripts are covered in the root `CLAUDE.md`. This file is the package internals.

## What this is

The **active** data layer: a MikroORM + PostgreSQL implementation of the `@backend/common` contracts, used by `auth` and `storage`. Sibling of `@backend/mongo`, but unlike it this one is wired in, supports real transactions, and has SQL schema migrations.

## Layout (hexagonal adapter)

This package is a pure **infrastructure adapter** — the domain/application layers (the `DatabaseRepository`, `MigrationService`, `MigrationTask` contracts, the CRUD use-cases, the `QueryOf`/`CreateOf`/`UpdateOf` DTOs) live in `@backend/common` by design and are **not** duplicated here. So there is no local `domain/`/`application/`; only the two adapter sides, split per feature:

```
src/
  core/                       # generic PG building blocks (was `common`)
    infrastructure/           # driven/outbound adapters: configs, decorators, entities,
                              #   mappers, repositories, services, types, utils
    interface/                # driving/inbound adapters
      interceptors/           #   PgRequestInterceptor (per-request RequestContext)
    pg.module.ts
  migration/                  # migration sub-feature
    infrastructure/           # driven: entities, services, constants
    interface/                # driving
      cli/                    #   PgMigrationCommand (nest-commander `pg-migration`)
    pg.migration.module.ts
```

**Rules:** put concrete impls of `@backend/common` contracts and MikroORM-bound code (entities, config, mappers) in `infrastructure/`; put inbound entrypoints (interceptors, CLI commands — anything Nest/nest-commander *drives*) in `interface/`. The public API is the root `src/index.ts` barrel — consumers import flat symbols (`PgEntity`, `PgRepositoryImpl`, `PgMapper`, `PgProp`, `PgSchema`, `PgModule`, `PgMigrationModule`) from `@backend/pg`, never deep paths, so internal moves stay invisible as long as the barrel re-exports the same names. Inside the package, `@/core` aliases `core/`.

## Module (`pg.module.ts`)

- `PgModule.forRoot({ database })` — MikroORM `forRootAsync` (Postgres, `DATABASE_URL`, `dbName` from the `Database` enum). Binds `DatabaseRunnerService` → `PgDatabaseRunnerServiceImpl` (wraps work in a MikroORM `RequestContext`) and registers `APP_INTERCEPTOR` → `PgRequestInterceptor`. Global.
- `PgRequestInterceptor` runs every gRPC handler inside `isolatedRun()`, i.e. a fresh `RequestContext` / EntityManager + identity map **per request** — relevant for transactional correctness.
- `PgModule.forFeature(...entities)` — `MikroOrmModule.forFeature`.

## Repository (`pg.repository.impl.ts`)

`PgRepositoryImpl<Doc, Entity, …>` `implements DatabaseRepository` over an `EntityManager`. `convertUpdate` maps `UpdateOf` `{ set, remove, inc }` → `assign` / `null` / `+=`. `updateMany`/`deleteMany` page in batches of 100; `bulkUpdate` groups by filter key and `$in`s. Returns `Either`; misses → `NotFoundException`; rows mapped via `PgMapper`.

Every subclass declares the abstract `resourceName` ("Storage object", "User"), and a miss is built with `this.notFound()` — "Storage object not found", also the name in `toRepositoryError`'s "already exists". Clients read a 4xx message verbatim (the admin shows it in its notification), so it never names the ORM class: no `getEntityName()`, no `Pg…Entity` stripped of its affixes. The name is declared rather than looked up from the `*DatabaseEntity` table enums, which name tables in the plural and would need a second map to stay readable.

`saveOne`/`saveMany` additionally run their `catch` through `toRepositoryError`, which turns a MikroORM `UniqueConstraintViolationException` into a `ConflictException`. Callers can then tell "this row already exists" from a real write failure — an at-least-once event handler treats the former as success and must retry on the latter (see `StorageObjectCreateRootFolderUseCase` in `backend.storage`).

## Entities & IDs

- `PgEntity<OptProps>` — abstract base with `id`, `createdAt`, `updatedAt` (auto `onUpdate`). Decorate concretes with `@PgSchema({ tableName })` (use a `*DatabaseEntity` enum value from `@packages/common`) and `@PgProp.*`.
- **IDs are application-generated monotonic ULIDs** (`pgId()` from `ulid`), set in the entity default — not DB sequences/UUIDs. So `id` is a sortable string (matches `NestCommon.Entity.id: string`).
- `PgProp.Date` pins `timestamptz` **`length: 6`** and `PgProp.Enum` pins **`columnType: 'text'`** so that the metadata matches what `auth` and `storage` already hold. Do not "tidy" these to `length: 3` / `varchar`: every `migrate:new` in both services would then regenerate the same `alter column … type` diff forever, and applying it rewrites the tables under an ACCESS EXCLUSIVE lock and rounds stored timestamps to milliseconds — for changes Postgres treats as no-ops.

## Migrations (two kinds)

`PgMigrationModule.register({ database, tasks, entities })` wires the MikroORM migrator + a `nest-commander` CLI `pg-migration`. Modes (these back the app `migrate*` scripts): no args → `migrator.up()` (SQL) **then** `runTasks()` (data); `--initial` → create initial; `--new [name]` → create from entity diff; `--up` → SQL only; `--tasks` → data tasks only. SQL files: `dist/migrator/migrations` (+ `src/migrator/migrations` in dev), `transactional` + `allOrNothing`, table `mikro_orm_migrations`. `PgMigrationServiceImpl.runTasks()` runs each task once, idempotently.

## Commands & gotchas

```bash
pnpm build / dev / lint / format / reset
```
- `lodash` is declared in this package's deps, with `@types/lodash` in devDeps.
