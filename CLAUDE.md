# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Documentation layout.** Facts have a single owner: this file covers the monorepo as a whole,
`backend/CLAUDE.md` the backend conventions, and each app/package its own internals. Rationale for
structural decisions ("why it was built this way") lives in [`docs/adr/`](docs/adr/README.md) and is
linked from the rule it explains — read an ADR only when the *why* matters. When something changes,
update the one owning file rather than restating it in a second one.

## Conversation compaction policy

When compacting the conversation, you MUST preserve:

- **Current working scope**: which service/package is being edited right now, and in which worktree/branch.
- **All proto-contract changes** (`packages/proto`) and the reason for each. Contracts are cross-service — losing them breaks consumers.
- **Added/changed event-bus events** (queues/subjects) and the shape of their payloads.
- **Database schema changes and migrations** — critical, never collapse these.
- **The list of changed files with status**: done / in-progress / still needs work.
- **Open failing tests** and any fixes that were found.
- **Architectural decisions made**, with their rationale.
- **Dead-end approaches that did NOT work** (so they are not retried from scratch).

You may compact aggressively:

- Exploration and file reads that led to no changes.
- Full tool output (keep only the conclusion).
- Contents of files that are already applied and committed.
- Intermediate reasoning that does not affect the current state.

## Overview

Personal-website monorepo: a Turborepo + pnpm workspace of NestJS gRPC microservices (backend) and a Next.js/Refine admin panel (frontend), wired together by Protobuf codegen and a Redis/BullMQ event bus. Requires Node ≥22.22, pnpm 11.9.0 (pinned by `packageManager`), and `protoc` (only for proto compilation).

## Workspaces & naming

`pnpm-workspace.yaml` globs four package roots; package names follow a strict convention used everywhere in turbo `--filter` and imports:

- `backend/apps/*` → `backend.<name>` (deployable services: `api-gateway`, `auth`, `storage`)
- `backend/packages/*` → `@backend/<name>` (shared backend libs: `cache`, `common`, `grpc`, `pg`, `mongo`, `proto`, `event-bus`, `event-bus-nats`, `event-bus-redis`)
- `frontend/apps/*` → `frontend.<name>` (`admin`)
- `frontend/packages/*` → `@frontend/<name>` (`proto`)
- `packages/*` → `@packages/<name>` (cross-stack: `common`, `proto`, `compiler-utils`, `configs`)

Inside an app, TS path aliases are `@/*` (src), `@modules/*`, `@common/*`, and `@compiler/*` (proto package only). Cross-package imports always use the `@backend/…`/`@packages/…` names, never relative paths.

**Dependency versions:** a dependency more than one workspace declares is pinned once, in the `catalog:` block of `pnpm-workspace.yaml`, and each manifest asks for it as `"lodash": "catalog:"`. The workspace still declares what it imports — that is what the tsdown factory and `import-x/no-extraneous-dependencies` read — while the version cannot drift between packages. Bump a shared version in `pnpm-workspace.yaml`, not in a manifest; a dependency only one workspace uses keeps its literal version there. This is not `overrides` (further down the same file): a catalog resolves what a workspace *asks* for, an override rewrites what the whole tree *gets*, transitive dependencies included.

**Build config:** every package that ships a `dist/` builds with tsdown through one shared factory — `nodePackageConfig(import.meta.url)` from `@packages/configs/tsdown/package.config.mjs`. It reads the package's **own** `package.json` to decide what stays external, so an import the package does not declare gets bundled into `dist/` instead of being required at runtime. Declare the dependency; don't hand-extend `neverBundle`.

**Layering invariant:** `@packages/*` are framework-agnostic — imported by **both** backend and the Next frontend, so keep Nest/React out of them. `@backend/*` may depend on Nest. Dependencies flow downward: proto/common → packages → apps.

## Common commands

Run from the repo root (turbo fans out to workspaces; append `--filter=<pkgname>` to scope):

```bash
pnpm dev                      # all backend + frontend in watch mode
pnpm dev:backend.auth         # one service (also .api-gateway, .storage, frontend.admin)
pnpm build                    # build everything (runs ^compile then ^build)
pnpm build:backend.auth       # one service
pnpm test                     # unit suites of every package that has them
pnpm test:e2e                 # e2e suites; each skips itself when its server is unreachable (fails with E2E_REQUIRE_SERVERS=1) — start them with docker:e2e
pnpm e2e                      # CI's e2e step: docker:e2e, test:e2e with E2E_REQUIRE_SERVERS=1, then docker:e2e:stop — pass or fail, and even when those containers were already up
pnpm typecheck                # tsc --noEmit in every workspace (see below)
pnpm migrate                  # apply pending migrations in every DB-backed service (also :backend.auth, :backend.storage)
pnpm migrate:check            # fail while any service's entities and migration snapshot disagree (no DB needed)
pnpm lint                     # eslint --fix across workspaces
pnpm format                   # prettier
pnpm docker:local             # postgres + redis + the ngrok tunnel for Bunny Stream webhooks (local dev)
pnpm docker:local:d           # the same, detached
pnpm docker:db                # postgres + redis only, detached, no tunnel (docker:db:stop to stop)
pnpm docker:e2e               # the `e2e` compose profile: postgres, redis and nats — every server an e2e suite needs (docker:e2e:stop)
pnpm docker                   # full stack in prod mode
pnpm gen:package              # scaffold a new package via turbo generator (packages only; apps are hand-made)
```

**Codegen — rerun after editing a contract, before `build`:**

```bash
pnpm compile:proto            # .proto → @backend/proto, @frontend/proto, @packages/proto
pnpm compile:event-bus        # EventBusStrategy → @backend/event-bus + the two transport packages
pnpm compile:env-docs         # zod env schemas → the env tables in CLAUDE.md files
pnpm check:env-docs           # the same, read-only: fails when a table is stale
pnpm compile                  # run every package's compile task
```

`compile:proto` needs a `protoc` binary (override with env `PROTOC_PATH`); to generate only some
targets, narrow the filter (`turbo run compile --filter=@backend/proto`).

Creating a migration (and any other MikroORM CLI command) runs inside a service directory — see
`backend/CLAUDE.md`.

**CI.** `.github/workflows/check.yaml` runs on every pull request into `main` and every push to it (which seeds the turbo cache new pull requests start from): `build`, `typecheck`
and `lint`, then fails if they left the tree dirty (stale codegen, unformatted code, unapplied lint
fixes), then `check:env-docs`, `migrate:check`, a guard against a migration snapshot changed
without a new migration next to it, `test` and `test:e2e`. Postgres, Redis and NATS run beside the
job and `E2E_REQUIRE_SERVERS=1` turns a skipped e2e suite into a failure. Turbo's local cache
(`.turbo/cache`) is carried between runs, pruned of entries older than a week.

**Tests.** Jest is configured per package that has tests. Run repo-wide from the root (`pnpm test`,
`pnpm test:e2e`, scoped with `--filter=<pkgname>`) or inside a package (`pnpm test:watch`, single
file: `pnpm test -- path/to/file.spec.ts`). A package with no `*.spec.ts` under `src/` has no
suite — there is no central list. Both turbo tasks depend on `^build`, because specs import
sibling packages through their built `dist`; `test:e2e` is `cache: false` — whether a suite runs or
skips depends on a reachable broker or database, which turbo cannot hash. A backend app whose suite
is still empty passes `--passWithNoTests` in that script to keep the repo-wide run green (the
`test:e2e` of `api-gateway` and `auth`) — **drop the flag the moment the suite gets its first spec.**
**Nothing that loads MikroORM runs under Jest:** MikroORM 7 is ESM-only and Jest's runtime has no
`require(esm)`. A database spec runs on `node:test` instead — `backend.storage`'s `test:e2e` is the
template ([ADR-0017](docs/adr/0017-database-specs-on-node-test.md)).

**Lint & strictness.**

- The backend ESLint preset is deliberately loose (off: `no-floating-promises`, `no-unsafe-*`, `no-unused-vars`, `no-explicit-any`) — the linter won't catch those.
- The one substantive rule it enforces is `import-x/no-extraneous-dependencies`: a package must declare what it imports, and `src/` may not use devDependencies. The admin's `nextConfig` carries it too.
- No ESLint config at all: `@packages/{common,proto,compiler-utils,configs}`, `@backend/proto`, `@frontend/proto`.
- TypeScript `strict` is **on** for `@packages/*` / `@frontend/*` / admin, **off** for backend apps and `@backend/packages/*`.
- **Only `typecheck` type-checks the whole workspace, so every workspace with a tsconfig declares it** (`tsc --noEmit`; the `gen:package` templates include it). No build covers it: `tsx` strips types without checking them, tsdown's declaration emit builds straight through a type error, and `nest build` reads `tsconfig.build.json`, which excludes the specs. `compiler/`, `scripts/` and spec files are checked by this task alone — a new workspace needs it, not the assumption that `compile` or `build` covers it.

## Code navigation (LSP vs grep)

A TypeScript LSP (the `typescript-lsp` plugin) may be available in a session. Two rules specific to this monorepo:

- **LSP within a package, grep across packages.** Cross-package imports (`@backend/*`, `@packages/*`) resolve to the built `dist/*.d.cts`, not source, so `findReferences` / `goToImplementation` on a *source* symbol only cover the same package — they miss consumers in sibling packages (e.g. pg/mongo/auth/storage that consume a `@backend/common` contract). For "who across the repo uses this shared symbol", use grep/Explore; use the LSP for within-package definition / hover / references / diagnostics, where it is precise.
- **Warm up with a repeat query.** tsserver indexes lazily, so the first `findReferences` / `workspaceSymbol` right after the server connects under-reports (can return just the declaration). Run the query a second time for the complete result.

## Protobuf codegen pipeline (the backbone)

`.proto` files in `packages/proto/pkg/` are the single source of truth for all cross-service contracts. A custom compiler parses them and emits three flavors. Each target package generates its own flavor in its own turbo `compile` task, with its own adapter, against the shared core `@packages/proto` exports as `@packages/proto/compiler`:

- **Nest adapter** (`backend/packages/proto/compiler`) → `@backend/proto` — the backend services.
- **Client adapter** (`frontend/packages/proto/compiler`) → `@frontend/proto` — the admin frontend, which should call the **`Admin`** repositories.
- **Browser adapter** (`packages/proto/compiler`) → `@packages/proto` — browser-safe shared types.

`pnpm compile:proto` runs all three (`--filter="@*/proto"`). A `.proto` edit invalidates the two
targets through the hash of `@packages/proto#compile`, upstream of theirs.

> **Why a task per target:** [docs/adr/0023-proto-codegen-task-per-package.md](docs/adr/0023-proto-codegen-task-per-package.md)

Each per-service contract comes in audience variants (base / `Admin` / `Web` / `Public`). What each
target exports is documented in that package's own `CLAUDE.md`.

Generated `src/` is committed: edit the `.proto`, `pnpm compile:proto`, then `build`. At runtime the
gRPC loader reads the original `.proto` from `node_modules/@packages/proto/pkg`, so `pkg/` is a
runtime dependency of the services, not just a codegen input. Both codegen compilers (proto and
event-bus) share primitives from `@packages/compiler-utils` (Pug templating + ts-morph import handling).

## Event-bus codegen pipeline

A second custom compiler generates the typed event bus. The single source of truth is the
**`EventBusStrategy` interface** in `backend/packages/event-bus/src/strategy/index.ts`, shaped
`[host][service][event]: PayloadType` (e.g. `auth.user.create: NestAuth.User`). Add an event by
adding a key there, run `pnpm compile:event-bus`, then `build`; every target's `src/generated/` is
committed and never hand-edited.

Three packages, each compiling its own generated code in its own turbo task:

| Package | Role |
|---|---|
| `@backend/event-bus` | Strategy + compiler. Emits the abstract `<Service>EventBus` ports and `EventBusHost`. Owns the naming rules and the bus-wide semantics. |
| `@backend/event-bus-redis` | **The live transport** (Redis/BullMQ) — `auth` and `storage` run on it. |
| `@backend/event-bus-nats` | The dormant alternative (NATS JetStream) — generated, built and tested, wired into no service. |

Each package's `CLAUDE.md` covers its internals; the decisions behind the split are ADRs
[0001](docs/adr/0001-redis-as-live-transport.md)–[0007](docs/adr/0007-natsjs-v3-direct.md).

## Env-table codegen pipeline

A third generator, `@packages/env-docs`, keeps documentation from restating what a zod schema
already says. Every environment variable is owned by the `validateEnv` argument that declares it,
and **[docs/env.md](docs/env.md) is the one place the tables live** — read on demand, like
`docs/adr/`, so no `CLAUDE.md` carries a deployment checklist it would load into every session.
`pnpm compile:env-docs` rewrites the marked regions there; `pnpm check:env-docs` fails when a table
and its schema have drifted, and the docs hook runs it on any edit to a file that validates env, to
a workspace manifest, or to the page itself. Prose around the markers is untouched — the generator
owns values, hand-written text owns reasons. It also enforces two invariants that fail the build:
every `validateEnv` call is named by some marker, and the service → packages map on that page
matches the `workspace:*` dependency closure. The marker syntax and the parser's deliberate
strictness are in that package's `CLAUDE.md`; the rationale is
[ADR-0008](docs/adr/0008-generated-env-tables.md).

## Backend

Service architecture (4-layer hexagonal / use-case), the `Either` flow, migrations and the
shared package conventions are in **`backend/CLAUDE.md`**. `backend/apps/auth` is the reference
implementation; `backend.api-gateway` is a deliberate two-layer exception.

**Caching** is `@backend/cache`: one `CacheStore` port with a Redis and an in-memory adapter behind a
single `CacheModule`, injected as `CacheService`. Unlike the event bus it is *not* split per
transport — the reasoning is [ADR-0009](docs/adr/0009-cache-one-package-driver-switch.md), the
internals are in that package's `CLAUDE.md`. `backend.auth` is its one cache consumer: it caches the
user behind the gateway's per-request access check, and evicts on every user write — why there and
not in the gateway's guard is [ADR-0011](docs/adr/0011-identity-cached-in-auth.md).
`backend.api-gateway` uses it only for its rate-limit counters, through the port's atomic `increment`
([ADR-0024](docs/adr/0024-gateway-rate-limit-counters-in-redis.md)).

**`backend.storage` is the one service with a public HTTP surface**, and it is a single route: the
Bunny Stream status webhook. Video bytes no longer cross the backend at all — the browser uploads
straight to Bunny with pre-signed TUS credentials the create call returns, and that callback is how
an upload's outcome gets back in ([ADR-0014](docs/adr/0014-video-uploads-bypass-the-backend.md)).
File and image bytes take the same shortcut to Bunny Storage — a pre-signed S3 PUT, then an
explicit `completeUpload` call in place of the webhook Storage does not have
([ADR-0015](docs/adr/0015-file-uploads-presigned-s3-put.md)). No RPC streams bytes any more.

## Frontend admin

Next.js 15 (App Router) + Refine 5 + MUI 6, run with the `refine` CLI. It consumes `@frontend/proto`/`@packages/proto` gRPC clients to talk to api-gateway. Refine data/auth providers live in `src/common/providers`; shared UI/hooks/helpers under `src/common`.

gRPC calls run on the **Next server** (server actions + `app/api` route handlers), never from the browser — `@grpc/grpc-js` is a Node client. The path is: browser → Next server action → gRPC → api-gateway.
