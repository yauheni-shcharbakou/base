# CLAUDE.md — @backend/pg

Guidance for working inside `backend/packages/pg`. The data-layer contracts (`DatabaseRepository`, `MigrationTask`, …) live in `@backend/common`; the migrator sub-app and the `migrate*` app scripts are covered in the root `CLAUDE.md`. This file is the package internals.

## What this is

The **active** data layer: a MikroORM + PostgreSQL implementation of the `@backend/common` contracts, used by `auth` and `storage`. Sibling of `@backend/mongo`, but unlike it this one is wired in, supports real transactions, and has SQL schema migrations.

## Module (`pg.module.ts`)

- `PgModule.forRoot({ database })` — MikroORM `forRootAsync` (Postgres, `DATABASE_URL`, `dbName` from the `Database` enum). Binds `DatabaseRunnerService` → `PgDatabaseRunnerServiceImpl` (wraps work in a MikroORM `RequestContext`) and registers `APP_INTERCEPTOR` → `PgRequestInterceptor`. Global.
- `PgRequestInterceptor` runs every gRPC handler inside `isolatedRun()`, i.e. a fresh `RequestContext` / EntityManager + identity map **per request** — relevant for transactional correctness.
- `PgModule.forFeature(...entities)` — `MikroOrmModule.forFeature`.

## Repository (`pg.repository.impl.ts`)

`PgRepositoryImpl<Doc, Entity, …>` `implements DatabaseRepository` over an `EntityManager`. `convertUpdate` maps `UpdateOf` `{ set, remove, inc }` → `assign` / `null` / `+=`. `updateMany`/`deleteMany` page in batches of 100; `bulkUpdate` groups by filter key and `$in`s. Returns `Either`; misses → `NotFoundException`; rows mapped via `PgMapper`.

## Entities & IDs

- `PgEntity<OptProps>` — abstract base with `id`, `createdAt`, `updatedAt` (auto `onUpdate`). Decorate concretes with `@PgSchema({ tableName })` (use a `*DatabaseEntity` enum value from `@packages/common`) and `@PgProp.*`.
- **IDs are application-generated monotonic ULIDs** (`pgId()` from `ulid`), set in the entity default — not DB sequences/UUIDs. So `id` is a sortable string (matches `NestCommon.Entity.id: string`).

## Migrations (two kinds)

`PgMigrationModule.register({ database, tasks, entities })` wires the MikroORM migrator + a `nest-commander` CLI `pg-migration`. Modes (these back the app `migrate*` scripts): no args → `migrator.up()` (SQL) **then** `runTasks()` (data); `--initial` → create initial; `--new [name]` → create from entity diff; `--up` → SQL only; `--tasks` → data tasks only. SQL files: `dist/migrator/migrations` (+ `src/migrator/migrations` in dev), `transactional` + `allOrNothing`, table `mikro_orm_migrations`. `PgMigrationServiceImpl.runTasks()` runs each task once, idempotently.

## Commands & gotchas

```bash
pnpm build / dev / lint / format / reset
```
- `lodash` is used but not declared in deps (resolves via workspace hoist — fragile).
- cjs-only; consumers resolve `dist/`, rebuild after changes (turbo `^build`).
