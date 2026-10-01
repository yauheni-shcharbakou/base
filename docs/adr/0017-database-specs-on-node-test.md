# 0017 — Database specs run on `node:test` against a migrated Postgres, not on Jest

**Status:** Accepted (2026-09-26)
**Applies to:** `backend.storage`

## Context

The deletion paths of `backend.storage` end in Postgres, not in application code:
- the FK cascades `files` → `images` / `videos` / `storage-objects`;
- the recursive `UPDATE` of `markDeletedWithDescendants`;
- the bottom-up `DELETE` of `deleteEmptyDeletedFolders`, which is only safe because `parent_id` is `on delete set null`.

A mocked repository proves none of that. It is the SQL and the schema that have to be exercised.

Jest cannot load MikroORM at all:
- MikroORM 7 ships ESM only.
- `@backend/pg` is built as CommonJS, like every backend package, and reaches MikroORM through Node's `require(esm)`.
- Jest's module runtime implements its own `require`, and that `require` cannot load ESM.

Rejected alternatives:

- **Let ts-jest transform MikroORM out of `node_modules`.** It fails on `import.meta.resolve` in `MikroORM.js`, which has no CommonJS equivalent.
- **Run Jest in ESM mode** (`--experimental-vm-modules`, `useESM`). The specs then load as ESM, but `@backend/pg`'s CommonJS `dist` still `require`s MikroORM inside Jest's runtime and fails the same way. Making it work would mean an ESM build of every backend package.
- **Build the schema from the entities** (`orm.schema.create`). It would test what the metadata *would* generate, not the FK rules production has. The migrations are what production has.

## Decision

- **Unit specs stay on Jest.** `*.spec.ts` under `src/` covers use-cases and services with their ports mocked, as in `backend.auth`.
- **Database specs are `test/*.e2e-spec.ts`, run by `node --test` under `ts-node/register/transpile-only` and `tsconfig-paths/register`.**
  - The loader is real Node, so `require(esm)` works.
  - ts-node emits decorator metadata, which MikroORM's `ReflectMetadataProvider` needs and `tsx` / esbuild do not produce.
  - `--no-experimental-strip-types` keeps Node's own type stripping from claiming `.ts` files first.
- **`test/pg.e2e.ts` owns the setup.** It targets a dedicated `storage_e2e` database, drops and recreates its `public` schema, then applies the real migrations. The migrations are passed as `migrationsList`, because MikroORM's own loader `import()`s them and cannot read `.ts` there.
- **The suite skips itself when no server answers,** like the Redis e2e suites. Only a connection error skips it; a server that answers and then fails, for example a bad password or a broken migration, fails the run.
- **The connection is made in a `before` hook, never in an async `describe` body.** `node:test` reports an error thrown in a suite body but still exits 0.

## Consequences

- Two runners in one service. `pnpm test` is Jest and `pnpm test:e2e` is `node:test`. They use different assertion APIs: `expect` in the unit specs, `node:assert` in the database specs.
- `test/` is type-checked by `pnpm typecheck` and linted by `pnpm lint`, but no `build` compiles it.
- The same setup fits `backend.auth` the day it needs a database spec.
- Should MikroORM ship CommonJS again, or Jest gain `require(esm)`, the database specs could move back to Jest. Until then, that move fails at the first import.
