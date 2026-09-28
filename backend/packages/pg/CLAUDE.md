# CLAUDE.md — @backend/pg

Guidance for working inside `backend/packages/pg`. The data-layer contracts (`DatabaseRepository`, `DatabaseRunnerService`, …) live in `@backend/common`; how services migrate (the MikroORM CLI, the `migrate*` app scripts) is covered in `backend/CLAUDE.md`. This file is the package internals.

## What this is

The **active** data layer: a MikroORM + PostgreSQL implementation of the `@backend/common` contracts, used by `auth` and `storage`. Sibling of `@backend/mongo`, but unlike it this one is wired in, supports real transactions, and has SQL schema migrations.

## Layout (hexagonal adapter)

This package is a pure **infrastructure adapter** — the domain/application layers (the `DatabaseRepository` and `DatabaseRunnerService` contracts, the CRUD use-cases, the `QueryOf`/`CreateOf`/`UpdateOf` DTOs) live in `@backend/common` by design and are **not** duplicated here. So there is no local `domain/`/`application/`; only the two adapter sides:

```
src/
  core/                       # generic PG building blocks (was `common`)
    infrastructure/           # driven/outbound adapters: configs, decorators, entities,
                              #   mappers, repositories, services, types, utils
    interface/                # driving/inbound adapters
      interceptors/           #   PgRequestInterceptor (per-request RequestContext)
    pg.module.ts
```

**Rules:** put concrete impls of `@backend/common` contracts and MikroORM-bound code (entities, config, mappers) in `infrastructure/`; put inbound entrypoints (interceptors — anything Nest *drives*) in `interface/`. The public API is the root `src/index.ts` barrel — consumers import flat symbols (`PgEntity`, `PgRepositoryImpl`, `PgMapper`, `PgProp`, `PgSchema`, `PgModule`, `definePgConfig`) from `@backend/pg`, never deep paths, so internal moves stay invisible as long as the barrel re-exports the same names. Inside the package, `@/core` aliases `core/`.

## Module (`pg.module.ts`)

- `PgModule.forRoot(ormConfig)` — `MikroOrmModule.forRoot` over the service's `src/mikro-orm.config.ts`, the object the MikroORM CLI reads too; no `autoLoadEntities`, so an entity must be listed or reached through a listed one's relations. Binds `DatabaseRunnerService` → `PgDatabaseRunnerServiceImpl` (wraps work in a MikroORM `RequestContext`) and registers `APP_INTERCEPTOR` → `PgRequestInterceptor`. Global.
- `PgRequestInterceptor` runs every gRPC handler inside `isolatedRun()`, i.e. a fresh `RequestContext` / EntityManager + identity map **per request** — relevant for transactional correctness.
- `PgModule.forFeature(...entities)` — `MikroOrmModule.forFeature`.

## Repository (`pg.repository.impl.ts`)

`PgRepositoryImpl<Doc, Entity, …>` `implements DatabaseRepository` over an `EntityManager`. `convertUpdate` maps `UpdateOf` `{ set, remove, inc }` → `assign` / `null` / `+=`. `updateMany`/`deleteMany` page in batches of 100; `bulkUpdate` groups by filter key and `$in`s. Returns `Either`; misses → `NotFoundException`; rows mapped via `PgMapper`.

Every subclass declares the abstract `resourceName` ("Storage object", "User"), and a miss is built with `this.notFound()` — "Storage object not found", also the name in `toRepositoryError`'s "already exists". Clients read a 4xx message verbatim (the admin shows it in its notification), so it never names the ORM class: no `getEntityName()`, no `Pg…Entity` stripped of its affixes. The name is declared rather than looked up from the `*DatabaseEntity` table enums, which name tables in the plural and would need a second map to stay readable.

**`PgMapper.transformListQuery`** turns a `getList`'s logical filters into a MikroORM query, one column per `field`. A field that is not a column (a relation's existence, a column of a related row) goes in the subclass's `computedFilters`: keyed by the field a client sends, each gets the operator's output and returns the condition to merge, or `undefined` to drop it.

**`getList`, `distinct`, `updateMany` and `deleteMany` fail loudly**: a failure is logged (`toFailure`) and thrown, never answered with an empty page, an empty set or a `false`, any of which reads as "nothing matched" and hides a broken query. `distinct` is a real `select distinct` over the whole match — no row cap, since capping rows rather than values silently drops the values past it (`validateObjectName` in `backend.storage` numbers `name (n).ext` from it). `updateMany`/`deleteMany` return `false` only when nothing matched, as the Mongo implementation does. Before querying, `getList` checks every filtered and sorted field (`PgMapper.listFields`, after `fieldNameConverter`, without `computedFilters`) against the entity's metadata and throws a `BadRequestException` naming the unknown ones. The check exists because MikroORM refuses such a field with a plain `Error` that names the ORM class and cannot be told from a real failure. Any other failure is logged and rethrown, so a client gets a 5xx. All four throw rather than return `Either`, like `getMany`/`getOne`: the contract returns the page, the set or the boolean itself, and callers let the gRPC filter or their cron's `catch` handle it (`FileCleanupUseCase` catches per sweep, so one failed sweep does not stop the other).

**`updateMany` and `deleteMany` refuse a query that constrains nothing** with a `BadRequestException` ("Storage object delete: a filter is required"), judged on what `transformQuery` produced, not on what the caller sent. A read is not guarded, by decision: `getMany({ ids: [] })` returns every row, because an empty list is no constraint, not a constraint nothing meets. The gRPC loader runs with `defaults`/`arrays`, so a client that sends no filter arrives as `{ ids: [] }`, and the mapper drops an empty list — without the check, one request writes every row. A use-case that reads the rows before writing them by id (`UserDeleteUseCase` in `backend.auth`) is past this guard by the time it writes, so it refuses first with `isUnfilteredQuery` from `@backend/common`.

`saveOne`/`saveMany` additionally run their `catch` through `toRepositoryError`, which turns a MikroORM `UniqueConstraintViolationException` into a `ConflictException`. Callers can then tell "this row already exists" from a real write failure — an at-least-once event handler treats the former as success and must retry on the latter (see `StorageObjectCreateRootFolderUseCase` in `backend.storage`).

## Entities & IDs

- `PgEntity<OptProps>` — abstract base with `id`, `createdAt`, `updatedAt` (auto `onUpdate`). Decorate concretes with `@PgSchema({ tableName })` (use a `*DatabaseEntity` enum value from `@packages/common`) and `@PgProp.*`.
- **IDs are application-generated monotonic ULIDs** (`pgId()` from `ulid`), set in the entity default — not DB sequences/UUIDs. So `id` is a sortable string (matches `NestCommon.Entity.id: string`).
- `PgProp.Date` pins `timestamptz` **`length: 6`** and `PgProp.Enum` pins **`columnType: 'text'`** so that the metadata matches what `auth` and `storage` already hold. Do not "tidy" these to `length: 3` / `varchar`: every `migrate:create` in both services would then regenerate the same `alter column … type` diff forever, and applying it rewrites the tables under an ACCESS EXCLUSIVE lock and rounds stored timestamps to milliseconds — for changes Postgres treats as no-ops.

## Config (`core/infrastructure/configs/pg.config.ts`)

`definePgConfig({ database, entities })` is a service's whole MikroORM configuration: `defineConfig`
over `DATABASE_URL` with `dbName` from the `Database` enum, `ReflectMetadataProvider`, UTC, and the
`Migrator` extension. Migrations: `dist/migrations`, plus `pathTs: src/migrations` outside
`production`; `transactional` + `allOrNothing`; table `mikro_orm_migrations`; file names
`<timestamp>[.<name>].migration.ts`; `snapshot` off for the CLI's `migration:up` / `:down` /
`:fresh`, which would otherwise rewrite it from the database (the rule is in `backend/CLAUDE.md`). It is a plain function, not a Nest config factory, because the
MikroORM CLI loads it without an app.

## Commands & gotchas

```bash
pnpm build / dev / typecheck / lint / format / reset
```
- `lodash` is declared in this package's deps, with `@types/lodash` in devDeps.
