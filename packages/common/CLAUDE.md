# CLAUDE.md — @packages/common

Guidance for working inside `packages/common`. For monorepo-wide conventions (workspace naming, turbo, codegen, architecture), see the root `CLAUDE.md`.

## What this package is

The lowest-level shared library: **framework-agnostic** (no NestJS, no React) helpers imported by _both_ backend services/packages and the frontend admin. Keep it that way — only add code safe to import from any runtime. Dependencies: `zod` (env validation) and `@grpc/grpc-js`, **types only** — the stream helper's stream type and the status-table key. The admin's browser bundle imports this package, so a value import of grpc-js here would pull the Node client into it; use `import type`.

Single barrel — everything re-exports through `src/index.ts`. Always import via `@packages/common`, never deep paths.

## Layout & exports

- `database/enums` — canonical database + table/collection names. `Database` (`auth` | `main` | `storage`) plus per-DB entity-name enums: `AuthDatabaseEntity`, `StorageDatabaseEntity`, `MainDatabaseEntity`. **Source of truth for table names** — entities, migrations, and `@backend/pg`/`@backend/mongo` modules key off these; don't hardcode strings.
- `validation` — env handling. `validateEnv(zodShape)` parses `process.env` and **throws** `Env validation failed` on error (used by every service `config.ts` and package config). Prebuilt shapes `NodeValidationSchema` (`PORT`, `NODE_ENV`) and `DatabaseValidationSchema` (`DATABASE_URL`), spread into other packages rather than redeclared — their types and defaults are tabulated in [docs/env.md](../../docs/env.md); type helper `SchemaTypeOf<Shape>`; derived `NodeEnvironment` / `DatabaseEnvironment`.
- `grpc/constants` — `HTTP_STATUS_BY_GRPC_STATUS`, the canonical gRPC → HTTP status table (google.rpc.Code). The one copy behind `GrpcStatusCodeMapper.fromGrpcToHttp` (`@backend/grpc`) and the admin's `GrpcErrorMapper`. Keyed by the numeric codes, checked against `Record<status, number>`, for the reason above.
- `stream` — `sendToWritable` / `sendToGrpcStream`: backpressure-aware promise wrappers around `Writable.write` / gRPC client streams (resolve on write or `drain`, reject on `error`).
- `utils/regexp` — file-extension regexes (`PROTO_EXT_REG_EXP`, `TS_EXT_REG_EXP`, `PUG_EXT_REG_EXP`) used by the codegen compilers.

## Commands

Run inside `packages/common/`, or from root with `--filter=@packages/common`:

```bash
pnpm build            # tsdown → dist (esm + cjs + d.ts)
pnpm dev              # tsdown --watch
pnpm format           # prettier src
pnpm reset            # rm -rf .turbo dist node_modules
```

No `compile`, `lint`, or `test` task in this package. Consumers resolve the built `dist/` (entry `src/index.ts`), so **rebuild after changes** — or run `pnpm dev` while iterating. Turbo's `^build` rebuilds it automatically before downstream builds.

## When editing

- Adding an export → wire it through the area barrel; it flows out via `src/index.ts`.
- New table or database → add it to `database/enums` first.
- `main` DB and `MainDatabaseEntity` are defined but no `main` service exists yet — scaffolding for a planned service.
- Never pull in NestJS/React or heavy runtime deps; that breaks frontend and leaf-package consumers.
