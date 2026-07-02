# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Conversation compaction policy

When compacting the conversation, you MUST preserve:

- **Current working scope**: which service/package is being edited right now, and in which worktree/branch.
- **All proto-contract changes** (`packages/proto`) and the reason for each. Contracts are cross-service — losing them breaks consumers.
- **Added/changed NATS subjects** and the shape of their payloads.
- **Database schema changes and migrations** (FinTech — critical, never collapse these).
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

Personal-website monorepo: a Turborepo + pnpm workspace of NestJS gRPC microservices (backend) and a Next.js/Refine admin panel (frontend), wired together by Protobuf codegen and a NATS JetStream event bus. Requires Node ≥22.22, pnpm 11.0.9, and `protoc` (only for proto compilation).

## Workspaces & naming

`pnpm-workspace.yaml` globs four package roots; package names follow a strict convention used everywhere in turbo `--filter` and imports:

- `backend/apps/*` → `backend.<name>` (deployable services: `api-gateway`, `auth`, `storage`)
- `backend/packages/*` → `@backend/<name>` (shared backend libs: `common`, `grpc`, `nats`, `pg`, `mongo`, `proto`, `event-bus`)
- `frontend/apps/*` → `frontend.<name>` (`admin`)
- `frontend/packages/*` → `@frontend/<name>` (`proto`)
- `packages/*` → `@packages/<name>` (cross-stack: `common`, `proto`, `compiler-utils`, `configs`)

Inside an app, TS path aliases are `@/*` (src), `@modules/*`, `@common/*`, and `@compiler/*` (proto package only). Cross-package imports always use the `@backend/…`/`@packages/…` names, never relative paths.

**Layering invariant:** `@packages/*` are framework-agnostic — imported by **both** backend and the Next frontend, so keep Nest/React out of them. `@backend/*` may depend on Nest. Dependencies flow downward: proto/common → packages → apps.

## Common commands

Run from the repo root (turbo fans out to workspaces; append `--filter=<pkgname>` to scope):

```bash
pnpm dev                      # all backend + frontend in watch mode
pnpm dev:backend.auth         # one service (also .api-gateway, .storage, frontend.admin)
pnpm build                    # build everything (runs ^compile then ^build)
pnpm build:backend.auth       # one service
pnpm lint                     # eslint --fix across workspaces
pnpm format                   # prettier
pnpm docker:local             # postgres + nats only (for local dev against real infra)
pnpm docker                   # full stack in prod mode
pnpm gen:package              # scaffold a new package via turbo generator (packages only; apps are hand-made)
```

**Codegen — rerun after editing a contract, before `build`:**

```bash
pnpm compile:proto            # .proto → @backend/proto, @frontend/proto, @packages/proto
pnpm compile:event-bus        # EventBusStrategy → @backend/event-bus + @backend/nats (generated/)
pnpm compile                  # run every package's compile task
```

`compile:proto` needs a `protoc` binary (override with env `PROTOC_PATH`); set `GRPC_COMPILER_CONTEXT=backend|frontend|all` (default `all`) to generate only some targets.

**Database migrations** (run inside a backend service dir, e.g. `backend/apps/auth`):

```bash
pnpm migrate:new              # generate a new MikroORM migration from entity diff
pnpm migrate                  # run pending migrations + data-seeding tasks
pnpm migrate:tasks            # run only the data-seeding tasks (migrator/tasks/)
```

**Tests, lint & strictness:** Jest is configured per backend app (`pnpm test`, `pnpm test:watch`, single file: `pnpm test -- path/to/file.spec.ts`), but **no `*.spec.ts` files exist yet** — there is currently no test suite. The backend ESLint preset is deliberately loose (off: `no-floating-promises`, `no-unsafe-*`, `no-unused-vars`, `no-explicit-any`), so the linter won't catch those. TypeScript `strict` is **on** for `@packages/*` / `@frontend/*` / admin but **off** for backend apps and `@backend/packages/*`.

## Code navigation (LSP vs grep)

A TypeScript LSP (the `typescript-lsp` plugin) may be available in a session. Two rules specific to this monorepo:

- **LSP within a package, grep across packages.** Cross-package imports (`@backend/*`, `@packages/*`) resolve to the built `dist/*.d.cts`, not source, so `findReferences` / `goToImplementation` on a *source* symbol only cover the same package — they miss consumers in sibling packages (e.g. pg/mongo/auth/storage that consume a `@backend/common` contract). For "who across the repo uses this shared symbol", use grep/Explore; use the LSP for within-package definition / hover / references / diagnostics, where it is precise.
- **Warm up with a repeat query.** tsserver indexes lazily, so the first `findReferences` / `workspaceSymbol` right after the server connects under-reports (can return just the declaration). Run the query a second time for the complete result.

## Protobuf codegen pipeline (the backbone)

`.proto` files in `packages/proto/pkg/` are the single source of truth for all cross-service contracts. The custom compiler in `packages/proto/compiler/` (run by `pnpm compile:proto`) parses them and emits three flavors via separate adapters:

- **Nest adapter** → `backend/packages/proto/src` (`@backend/proto`): typed message namespaces (`NestAuth`, `NestCommon`, `NestStorage`, `NestGoogle`) plus per-service **Transports** (e.g. `GrpcUserTransport`) and controller/client interface types (`GrpcUserServiceController`, `GrpcUserServiceClient`).
- **Client adapter** → `frontend/packages/proto/src` (`@frontend/proto`).
- **Browser adapter** → `packages/proto/src` (`@packages/proto`): browser-safe shared types.

Generated `src/` is committed. Edit the `.proto`, recompile, then `build`. A Transport (`GrpcXTransport`) bundles `.service` (the gRPC service-name string, which also serves as the DI token for `@InjectGrpcService`), `.ControllerMethods()` (class decorator that registers gRPC handlers), and message types — these are how controllers and clients bind to a service.

**Generated exports by target** (each per-service contract comes in audience variants — base / `Admin` / `Web` / `Public`):
- `@backend/proto` → `Nest*` namespaces + `Grpc<X>Transport` / `Grpc<X>ServiceController` / `Grpc<X>ServiceClient`.
- `@frontend/proto` → `Client*` namespaces + `Grpc<X>Repository`. The admin frontend should call the **`Admin`** repositories.

At runtime the gRPC loader reads the original `.proto` from `node_modules/@packages/proto/pkg`, so `pkg/` is a runtime dependency of the services, not just a codegen input. Both codegen compilers (proto and event-bus) share primitives from `@packages/compiler-utils` (Pug templating + ts-morph import handling).

## Event-bus codegen pipeline (NATS events)

A second custom compiler, parallel to the proto one, generates the typed event bus. The single source of truth is the **`EventBusStrategy` interface** in `backend/packages/event-bus/src/strategy/index.ts`, shaped `[host][service][event]: PayloadType` (e.g. `auth.user.create: NestAuth.User`). Payloads are usually proto types; custom non-proto payloads live in `src/strategy/events/` (e.g. `StorageObjectParentUpdateEvent`).

The compiler in `backend/packages/event-bus/compiler/` (run by `pnpm compile:event-bus`) parses that interface with **ts-morph** (not protobufjs) and emits in two stages:

- **Abstract buses** → `@backend/event-bus/src/generated/index.ts`: a base `EventBus`, one abstract `<Service>EventBus` per service with `emit<Event>(event)` + `emitMany<Event>(events)`, and the `EventBusHost` enum.
- **Nats adapter** (the only adapter, pug-templated) → `@backend/nats/src/generated/index.ts`: per-service `Nats<Service>Transport` (event-pattern constants, a `.ControllerMethods()` class decorator, and `.EventBus` = the abstract class), subscriber interfaces `Nats<Service>EventController`, cross-host handler interfaces `Nats<Service><Event>EventHandler` (method `on<Service><Event>`), and `NatsClientFactory` (maps each abstract bus → its concrete `NatsJetStreamClientProxy`-backed impl).

**Naming is service-scoped, not host-scoped**: generated class/interface names (`<Service>EventBus`, `Nats<Service>Transport`, `Nats<Service>EventController`, …) are derived from the service name alone — the host is dropped. This means service names must stay unique **across all hosts** in `EventBusStrategy`, or the compiler emits colliding class names.

Subjects are kebab-cased `host-service-event` (`auth-user-create`); JetStream streams stay host-scoped too — `host-service-stream` (`auth-user-stream`) — even though the generated class/interface names (bus, transport, controller) dropped the host prefix (see naming note above). Both packages' `src/generated/` are committed — edit the strategy, `pnpm compile:event-bus`, then `build`.

**Runtime wiring (NATS JetStream):**
- **Emit**: a feature module imports `NatsModule.forFeature({ EventBus: Nats<X>Transport.EventBus })`, binding the abstract bus to its concrete client; use-cases inject the abstract `<X>EventBus` and call `emit<Event>` after a successful write.
- **Subscribe**: a controller under `interface/nats/*.controller.ts`, decorated `@NatsController()` + `Nats<X>Transport.ControllerMethods()`, implements `Nats<X>EventController`. To consume an event owned by **another** host, implement that `Nats…EventHandler` interface and decorate the method with `@NatsEvent(Nats<Other>Transport.<CONSTANT>)` (see `NatsStorageObjectController` consuming `auth-user-create`).
- **Streams**: `ControllerMethods()` / `@NatsEvent` register subjects in `globalStreamRegistry`; `NatsModule.forRoot({ host: EventBusHost.X })` reads it to declare JetStream streams at bootstrap.
- **Delivery**: at-least-once (`manualAck`, `maxDeliver` 10, `maxAckPending` 1) — subscriber handlers must be idempotent.

## Backend service architecture (hexagonal / use-case)

This is a **clean-architecture redesign** (branch `feat/use-case-architecture`). **`backend/apps/auth` is the reference implementation** — match its structure for new code. Each service `src/modules/<feature>/` has four layers:

```
domain/          # abstract contracts: repositories/*.repository.ts, services/*.service.ts,
                 #   interfaces, entities — depend on nothing concrete
application/     # use-cases/*.use-case.ts (one class, one execute()), DTOs
infrastructure/  # concrete impls: pg/repositories/*.repository.impl.ts, pg/entities,
                 #   pg/mappers, services/*.service.impl.ts, configs
interface/       # adapters in: grpc/*.controller.ts, cron/*.scheduler.ts (+ web/rpc in gateway)
```

Key conventions, all visible in the auth module:

- **DI binds abstract → impl**: the module lists `{ provide: UserRepository, useClass: PgUserRepositoryImpl }`. Use-cases and controllers depend on the abstract class (`domain/`), never the impl. The data-layer **contracts** (`DatabaseRepository`, `MigrationService`, `DatabaseRunnerService`, and base CRUD use-cases `GetUseCase` / `CreateUseCase` / …) live in `@backend/common`; concrete impls live in `@backend/pg` (**active**) and `@backend/mongo` (**dormant — unused; resolves the README's "Mongoose + MikroORM" ambiguity**). Service repositories extend `DatabaseRepository<...>` and service CRUD use-cases extend the abstract bases.
- **Proto types are domain-safe unless `Grpc`-prefixed.** Every `@backend/proto` export *without* a `Grpc` prefix — the `Nest*` message namespaces (`NestAuth`, `NestCommon`, `NestStorage`, `NestGoogle`) — is a pure data contract and may be imported from **any** layer, `domain/` included. The `Nest` prefix names the generated adapter, not a framework dependency: these are plain TS types with no Nest/RxJS/DI at runtime (domain repositories already extend `NestCommon.Entity`). Only the `Grpc*` exports (`Grpc<X>Transport`, `Grpc<X>ServiceController`, `Grpc<X>ServiceClient`) carry Nest decorators, RxJS `Observable`s and DI tokens — those are framework-bound and stay in `interface/` / `infrastructure/`. Rule of thumb: `Nest*` = domain-safe, `Grpc*` = framework-only.
- **Errors flow as `Either` monads** (`@sweet-monads/either`), not thrown. Use-cases return `Promise<Either<Error, T>>`; controllers unwrap with `GrpcRxPipe` (`.unwrapEither`, `.toArrayItems`) from `@backend/grpc`.
- **gRPC controllers** are thin: implement the generated `Grpc<X>ServiceController`, decorate with `@GrpcController()` + `Grpc<X>Transport.ControllerMethods()`, and delegate each method to a use-case via `from(useCase.execute(...)).pipe(GrpcRxPipe.…)`.
- **Domain events** are emitted via injected abstract `@backend/event-bus` buses (e.g. `UserEventBus.emitCreate`) after a successful write, and consumed by `interface/nats/*.controller.ts` subscribers — see *Event-bus codegen pipeline* above.
- **Bootstrap** (`main.ts`) is uniform: create the Nest app, then `connectMicroservice` for both `GRPC_MICROSERVICE_OPTIONS` (`@backend/grpc`) and `NATS_MICROSERVICE_OPTIONS` (`@backend/nats`). `app.module.ts` wires `GrpcModule.forRoot({ host })`, `NatsModule.forRoot({ host })`, `PgModule.forRoot({ database })`, and `ConfigModule` loading `config.ts`.
- **Config** (`config.ts`) spreads `commonConfig()` from `@backend/common` and validates service-specific env with `validateEnv(zod schema)` from `@packages/common`.
- **Data layer**: entity IDs are application-generated monotonic **ULIDs** (`pgId`), not DB sequences/UUIDs (so `id` is a sortable string); table/database names come from `@packages/common` `database/enums`; every gRPC handler runs inside a per-request MikroORM `RequestContext` (transactional isolation via `PgRequestInterceptor`).
- **gRPC topology**: the host → URL → services map is centralized in `@backend/grpc` `grpcConfig` (driven by `*_GRPC_URL` env vars). Adding a service or host means editing it **and** the env var.

### Migrations & the migrator sub-app

Backend services with a DB are NestJS **monorepo projects** (`nest-cli.json` defines `service` + `migrator` apps). `src/migrator/` is a standalone `nest-commander` entrypoint: `migrations/` holds MikroORM SQL migrations (+ `.snapshot-*.json`), and `tasks/` holds idempotent data-seeding tasks (`implements MigrationTask` with an `up()`, e.g. `create-admin.task.ts`). Production startup runs `node dist/migrator/main -- postgres-migration && node dist/main`.

A data task may call **other services over gRPC** by declaring `appClientStrategy` in the migrator module (e.g. storage's `create-root-folders` backfills via the auth `GrpcUserService`). A fresh deployment seeds its first admin via the `create-admin` task from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## api-gateway

The edge service: it serves REST + Swagger **and** runs as a gRPC server (`GrpcModule.forRoot({ host: 'apiGateway' })` — the admin frontend calls it over gRPC), terminating external requests and **proxying to internal gRPC services**. Controllers are split by audience under `modules/<feature>/interface/grpc/` (`*.web.controller.ts`, `*.admin.controller.ts`, `*.public.controller.ts`); each delegates to an `application/services/*.proxy.service.ts` that injects a generated gRPC client via `@InjectGrpcService(GrpcXTransport.service)` and calls `firstValueFrom(client.method(req).pipe(GrpcRxPipe.rpcException))`. The `grpc-access` module provides auth guards/interceptors over gRPC metadata.

> **Note:** api-gateway is mid-migration to the use-case layout and **currently does not compile** — some files still reference the deleted old structure (e.g. `@backend/transport`, `common/decorators/method.decorator.ts`). Don't treat it as a buildable reference. Treat the new `modules/<feature>/{interface,application}` layout (mirroring auth) as the target; don't reintroduce the old `common/`-rooted patterns.

## Frontend admin

Next.js 15 (App Router) + Refine 5 + MUI 6, run with the `refine` CLI. It consumes `@frontend/proto`/`@packages/proto` gRPC clients to talk to api-gateway. Refine data/auth providers live in `src/common/providers`; shared UI/hooks/helpers under `src/common`.

gRPC calls run on the **Next server** (server actions + `app/api` route handlers), never from the browser — `@grpc/grpc-js` is a Node client. The path is: browser → Next server action → gRPC → api-gateway.
