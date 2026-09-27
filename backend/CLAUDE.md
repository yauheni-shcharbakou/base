# CLAUDE.md — backend

Conventions shared by every backend app and package. The monorepo-wide rules (workspace naming,
commands, codegen pipelines) are in the root `CLAUDE.md`; each app and package has its own file
with its specifics.

**`backend/apps/auth` is the reference implementation** — match its structure for new code.

## Service architecture (hexagonal / use-case)

Each service `src/modules/<feature>/` has four layers:

```
domain/          # abstract contracts: repositories/*.repository.ts, services/*.service.ts,
                 #   interfaces, entities — depend on nothing concrete
application/     # use-cases/*.use-case.ts (one class, one execute()), DTOs
infrastructure/  # concrete impls: pg/repositories/*.repository.impl.ts, pg/entities,
                 #   pg/mappers, services/*.service.impl.ts, configs
interface/       # adapters in: grpc/*.controller.ts, cron/*.scheduler.ts (+ web/rpc in gateway)
```

`backend.api-gateway` is the deliberate exception — **two layers only** (`interface` +
`application`), because it has no persistence. See its own `CLAUDE.md`; don't add domain/infra
layers there.

Key conventions, all visible in the auth module:

- **DI binds abstract → impl**: the module lists `{ provide: UserRepository, useClass: PgUserRepositoryImpl }`. Use-cases and controllers depend on the abstract class (`domain/`), never the impl. The data-layer **contracts** (`DatabaseRepository`, `MigrationService`, `DatabaseRunnerService`, and base CRUD use-cases `GetUseCase` / `CreateUseCase` / …) live in `@backend/common`; concrete impls live in `@backend/pg` (**active**) and `@backend/mongo` (**dormant — unused; resolves the README's "Mongoose + MikroORM" ambiguity**). Service repositories extend `DatabaseRepository<...>` and service CRUD use-cases extend the abstract bases.
- **Proto types are domain-safe unless `Grpc`-prefixed**: `Nest*` message namespaces may be imported from any layer, `domain/` included; `Grpc*` artifacts are framework-bound and stay in `interface/` / `infrastructure/`. Full rule in `backend/packages/proto/CLAUDE.md`.
- **Errors flow as `Either` monads** (`@sweet-monads/either`), not thrown. Use-cases return `Promise<Either<Error, T>>`; controllers unwrap with `GrpcRxPipe` (`.unwrapEither`, `.toArrayItems`) from `@backend/grpc`.
- **gRPC controllers** are thin: implement the generated `Grpc<X>ServiceController`, decorate with `@GrpcController()` + `Grpc<X>Transport.ControllerMethods()`, and delegate each method to a use-case via `from(useCase.execute(...)).pipe(GrpcRxPipe.…)`.
- **Domain events** are emitted via injected abstract `@backend/event-bus` buses (e.g. `UserEventBus.emitCreate`) after a successful write, and consumed by `interface/redis/*.controller.ts` subscribers — see `backend/packages/event-bus-redis/CLAUDE.md`.
- **Bootstrap** (`main.ts`) is uniform: create the Nest app, then `connectMicroservice` for both `GRPC_MICROSERVICE_OPTIONS` (`@backend/grpc`) and `REDIS_MICROSERVICE_OPTIONS` (`@backend/event-bus-redis`). `app.module.ts` wires `GrpcModule.forRoot({ host })`, `RedisModule.forRoot({ host })`, `PgModule.forRoot({ database })`, and `ConfigModule` loading `config.ts`. **The bootstrap promise ends in a real handler** — `resolveErrorMessage` into `Logger.error`, then `process.exit(1)`. An empty catch turns any startup failure into an exit with code 0 and no log line, because a rejection means `app.init()` never ran and nothing holds the event loop ([ADR-0013](../docs/adr/0013-event-bus-fails-loud.md)).
- **A config factory publishes plain fields; a member is a function only when it takes an argument.** `commonConfig().port`, `cacheConfig().keyPrefix`, `redisConfig().queueOptions` — a zero-argument getter is a wrapper around a value that was already computed at factory time. What genuinely depends on a caller's input stays a function: `pgConfig().postgres(dbName)`, `getConnectionOptions(host)`, `getSubscriptionKey(eventId)`. The corollary of a field is that its value is built **once** and shared by every consumer, so an object field is spread into the consumer's own literal, never mutated in place.
- **A package config factory that publishes generic getter names is namespaced** with `registerAs('<package>', …)`, and its module injects `xConfig.KEY` rather than looking values up on `ConfigService`. `ConfigModule.forFeature` merges plain factories into one flat store, so two packages using the same getter name silently overwrite each other in whichever order the app imports them ([ADR-0012](../docs/adr/0012-namespaced-package-config.md)).
- **Config** (`config.ts`) spreads `commonConfig()` from `@backend/common` and validates service-specific env with `validateEnv(zod schema)` from `@packages/common`. That call owns the variable's type and default; the tables in [`docs/env.md`](../docs/env.md) are generated from it, so change the schema and run `pnpm compile:env-docs` rather than editing a table.
- **Data layer**: entity IDs are application-generated monotonic **ULIDs** (`pgId`), not DB sequences/UUIDs (so `id` is a sortable string); table/database names come from `@packages/common` `database/enums`; every gRPC handler runs inside a per-request MikroORM `RequestContext` (transactional isolation via `PgRequestInterceptor`).
- **gRPC topology**: the host → URL → services map is centralized in `@backend/grpc` `grpcConfig` (driven by `*_GRPC_URL` env vars). Adding a service or host means editing it **and** the env var.
- **Layer direction is lint-enforced**: `auth`, `storage`, `api-gateway` and the `@backend/pg` / `mongo` / `cache` / `event-bus-redis` / `event-bus-nats` packages (and every package `pnpm gen:package` creates) wire a shared `layerGuard()` flat-config helper (`@packages/configs/eslint/layer-guard.mjs`) alongside `nestConfig` in their `eslint.config.mjs`. It forbids outward-to-inward imports (`domain` can't import `application`/`infrastructure`/`interface`, etc.) by path segment, regardless of nesting depth; `*.module.ts`/`main.ts` composition roots are exempt.

## Migrations & the migrator sub-app

Backend services with a DB are NestJS **monorepo projects** (`nest-cli.json` defines `service` +
`migrator` apps). `src/migrator/` is a standalone `nest-commander` entrypoint: `migrations/` holds
MikroORM SQL migrations (+ `.snapshot-*.json`), and `tasks/` holds idempotent data-seeding tasks
(`implements MigrationTask` with an `up()`, e.g. `create-admin.task.ts`). Production startup runs
`node dist/migrator/main -- postgres-migration && node dist/main`.

A data task may call **other services over gRPC** by declaring `appClientStrategy` in the migrator
module (e.g. storage's `create-root-folders` backfills via the auth `GrpcUserService`). A fresh
deployment seeds its first admin via the `create-admin` task from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Run inside the service directory (e.g. `backend/apps/auth`):

```bash
pnpm migrate:new              # generate a migration from the entity diff
pnpm migrate                  # pending migrations + data-seeding tasks
pnpm migrate:tasks            # only the data-seeding tasks
```

## Package conventions

These hold for every `backend/packages/*` — don't restate them in a package's own `CLAUDE.md`:

- **cjs-only** output (backend services are CommonJS). Consumers resolve `dist/`, and turbo's
  `^build` rebuilds before a downstream `build`/`compile` — rebuild after changes, or run `pnpm dev`.
- **Public API is the flat root `src/index.ts` barrel.** Inside a package, `@/*` aliases `src/*`.
- **Specs sit next to their subject** (`*.spec.ts` / `*.e2e-spec.ts` under `src/`). They are
  excluded from the turbo `build` inputs and are not part of the tsdown entry graph, but they *are*
  in the tsconfig, so `tsc` and `eslint` type-check them — `layerGuard()` included, where it is
  wired. Target lib is ES2021: assign `cause` via `Object.assign`, not `err.cause =`.
- **`src/generated/**` is never hand-edited** — fix the source of truth (a `.proto`, the
  `EventBusStrategy`, or a compiler template) and recompile.
