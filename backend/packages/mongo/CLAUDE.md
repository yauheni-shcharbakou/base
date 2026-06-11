# CLAUDE.md — @backend/mongo

Guidance for working inside `backend/packages/mongo`. The data-layer contracts it implements (`DatabaseRepository`, `MigrationService`, `MigrationTask`, `DatabaseRunnerService`) live in `@backend/common`; see the root `CLAUDE.md` for the hexagonal architecture.

## Status: not currently wired in

This is a complete **Mongoose** implementation of the `@backend/common` data-layer contracts — the sibling of `@backend/pg`. **No service consumes it today**: `auth` and `storage` both use `@backend/pg` (PostgreSQL). Treat it as a maintained-but-dormant alternative engine; if you wire it into a service, mirror how `@backend/pg` is used there.

## What it provides

- `MongoModule.forRoot({ database })` — connects Mongoose (`DATABASE_URL`, `dbName` from the `Database` enum), installs `MongoIdPlugin` globally, and binds `DatabaseRunnerService` → `EmptyDatabaseRunnerServiceImpl` (Mongo path has **no transactional isolation**).
- `MongoModule.forFeature(...entities)` — registers entities as models via `convertEntitiesToMongoDefinitions` (model name = the entity's `collection`).
- `MongoRepositoryImpl<Doc, Entity, …>` — abstract `implements DatabaseRepository`; concrete service repositories extend it. Maps `UpdateOf` `{ set, remove, inc }` → Mongo `$set` / `$unset` / `$inc`, returns `Either`, errors → `NotFoundException`.
- Entity building blocks: `MongoEntity` (base `Document` with `id`/`createdAt`/`updatedAt`), `@MongoSchema({ collection })` (forces `timestamps` + `virtuals`), `@MongoProp`, `MongoMapper` (doc ↔ entity, query transform).
- `MongoIdPlugin` — rewrites `_id` → string `id` and strips `__v` in `toJSON`/`toObject`.

## Migrations

Mongo migrations are **data tasks only** — there are no schema migrations (unlike `@backend/pg`'s MikroORM SQL migrations). `MongoMigrationModule.register({ database, tasks, entities })` wires `MongoMigrationServiceImpl` (`MigrationService` impl) + a `nest-commander` CLI command. `runTasks()` runs each `MigrationTask.up()` once, idempotently, recording status in the `migrations` collection (`CommonDatabaseEntity.MIGRATION`); a failure stops the run and is logged with error/stack.

## Commands

```bash
pnpm build            # tsdown → dist (cjs + d.ts)
pnpm dev              # tsdown --watch
pnpm lint             # eslint --fix
pnpm format / reset
```

## Gotchas

- Dormant: changes here are not exercised by any running service — verify against a real wiring before trusting them.
- `lodash` is used throughout but not declared in this package's deps (resolves via workspace hoist — fragile).
- cjs-only output; consumers resolve `dist/`, so rebuild after changes (turbo `^build` handles downstream).
