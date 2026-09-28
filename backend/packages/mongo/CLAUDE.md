# CLAUDE.md — @backend/mongo

Guidance for working inside `backend/packages/mongo`. The data-layer contracts it implements (`DatabaseRepository`, `DatabaseRunnerService`) live in `@backend/common`; see the root `CLAUDE.md` for the hexagonal architecture.

## Status: not currently wired in

This is a complete **Mongoose** implementation of the `@backend/common` data-layer contracts — the sibling of `@backend/pg`. **No service consumes it today**: `auth` and `storage` both use `@backend/pg` (PostgreSQL). Treat it as a maintained-but-dormant alternative engine; if you wire it into a service, mirror how `@backend/pg` is used there.

## Layout (hexagonal adapter)

Structurally mirrors `@backend/pg`: a pure **infrastructure adapter**, so the domain/application layers (the contracts, CRUD use-cases, and `QueryOf`/`CreateOf`/`UpdateOf` DTOs) stay in `@backend/common` and are **not** duplicated here.

```
src/
  core/                       # generic Mongo building blocks (was `common`)
    infrastructure/           # driven/outbound: configs, decorators, entities,
                              #   mappers, plugins, repositories, types, utils
    mongo.module.ts
```

Unlike `@backend/pg`, `core/` has **no `interface/` layer** — Mongo has no per-request interceptor (no transactional isolation), so there is no inbound adapter at all. Put concrete impls of `@backend/common` contracts and Mongoose-bound code in `infrastructure/`; an inbound entrypoint, should one appear, goes in `interface/`. Consumers import flat symbols from `@backend/mongo` via the root `src/index.ts` barrel, never deep paths. Inside the package, `@/core` aliases `core/`.

## What it provides

- `MongoModule.forRoot({ database })` — connects Mongoose (`DATABASE_URL`, `dbName` from the `Database` enum), installs `MongoIdPlugin` globally, and binds `DatabaseRunnerService` → `EmptyDatabaseRunnerServiceImpl` (Mongo path has **no transactional isolation**).
- `MongoModule.forFeature(...entities)` — registers entities as models via `convertEntitiesToMongoDefinitions` (model name = the entity's `collection`).
- `MongoRepositoryImpl<Doc, Entity, …>` — abstract `implements DatabaseRepository`; concrete service repositories extend it. Maps `UpdateOf` `{ set, remove, inc }` → Mongo `$set` / `$unset` / `$inc`, returns `Either`, errors → `NotFoundException`. A subclass declares the abstract `resourceName` and builds a miss with `this.notFound()`, the same rule as `@backend/pg` (its `CLAUDE.md` has the reason). `getList` and `distinct` fail loudly the same way too: logged (`toFailure`) and thrown, never an empty page or set. `updateMany`/`deleteMany` refuse a query that constrains nothing, also as there.
- Entity building blocks: `MongoEntity` (base `Document` with `id`/`createdAt`/`updatedAt`), `@MongoSchema({ collection })` (forces `timestamps` + `virtuals`), `@MongoProp`, `MongoMapper` (doc ↔ entity, query transform).
- `MongoIdPlugin` — rewrites `_id` → string `id` and strips `__v` in `toJSON`/`toObject`.

## Migrations

None. The data-task runner this package mirrored from `@backend/pg` went with pg's own, when migrations moved to the MikroORM CLI ([ADR-0022](../../../docs/adr/0022-migrations-through-the-mikro-orm-cli.md)); a service that wires Mongo in brings its own way to change data.

## Commands

```bash
pnpm build            # tsdown → dist (cjs + d.ts)
pnpm dev              # tsdown --watch
pnpm typecheck        # tsc --noEmit (the tsdown build does not check types)
pnpm lint             # eslint --fix
pnpm format / reset
```

## Gotchas

- Dormant: changes here are not exercised by any running service — verify against a real wiring before trusting them.
- `lodash` is used throughout and is declared in this package's deps, with `@types/lodash` in devDeps.
