# 0022 — Migrations run through the MikroORM CLI, and auth seeds its own first admin

**Status:** Accepted (2026-09-28)
**Applies to:** `@backend/pg`, `@backend/common`, `@backend/mongo`, `backend.auth`, `backend.storage`

## Context

Every DB-backed service carried a second Nest application, `src/migrator/`, driven by
`nest-commander`. `PgMigrationCommand` (`pg-migration`) in `@backend/pg` applied the MikroORM
migrations, then ran data tasks: `MigrationTask` classes, logged in a `migrations` table. Four things
were wrong with it:

- **A failure exited 0.** The command caught and only logged, `runTasks()` returned on the first
  failed task, and `main.ts` ended in `.catch(() => {})`. `node dist/migrator/main.js … && node
  dist/main.js` therefore started the service over a migration that had not been applied — the
  failure mode [0013](0013-event-bus-fails-loud.md) rules out for a bootstrap.
- **It wrapped a subset of the CLI** (up, create, initial, tasks) behind a full `nest build` with
  `deleteOutDir`, which wiped the `dist` a running `pnpm dev` served from.
- **Its entity list was a second copy.** The migrator module listed the entities to diff, while the
  app collected its own through `autoLoadEntities`; nothing kept the two in step.
- **The first admin bypassed the event bus.** The `create-admin` task wrote the row through the
  `EntityManager`, so `auth.user.create` never went out and storage never opened the admin's root
  folder. `create-root-folders` repaired that over gRPC, but only when auth already answered: on a
  fresh deployment the folder waited for storage's next restart.

Of the three data tasks, `create-admin` was a seed; `create-root-folders` and
`add-storage-object-is-folder` were one-off backfills, applied everywhere — the latest storage
migration refuses a table whose `is_folder` was never backfilled.

Rejected alternatives:

- **Keep the tasks, drop only `nest-commander`**, running them from a bare
  `NestFactory.createApplicationContext`. The smallest diff, but it keeps two migration mechanisms, a
  Nest bootstrap to run three classes, and the root-folder race.
- **MikroORM seeders** (`@mikro-orm/seeder`, `seeder:run` on every deploy). A seeder gets an
  `EntityManager` and nothing else: the admin would still bypass the event, and the root-folder
  backfill would need a hand-built gRPC client calling auth in the middle of storage's deploy.
- **The admin as an idempotent migration.** Tracked once, but still a raw insert that emits nothing.

## Decision

- **The MikroORM CLI (`@mikro-orm/cli`) runs every migration command, outside Nest.** Each service's
  `src/mikro-orm.config.ts` default-exports `definePgConfig({ database, entities })` from
  `@backend/pg`. The CLI reads it (`"mikro-orm".configPaths` in the service `package.json`), and so
  does `PgModule.forRoot(ormConfig)`, which no longer sets `autoLoadEntities`.
- **Scripts:** `pnpm orm <command>` passes through to the CLI, `pnpm migrate` is `migration:up`,
  `pnpm migrate:create` is `migration:create`. Migrations live in `src/migrations/`.
- **Production** runs `mikro-orm migration:up --config dist/mikro-orm.config.js && exec node
  dist/main.js`, with `MIKRO_ORM_CLI_PREFER_TS=false`: the image holds no TypeScript loader, and the
  lookup would only print a warning.
- **Sources load through swc** (`"tsLoader": "swc"`). The entities rely on `emitDecoratorMetadata`,
  which tsx/esbuild never emits, and `auto` may pick `tsx`, which `backend.storage` depends on for a
  script.
- **Data changes are migrations; there is no task runner.** `MigrationTask`, `MigrationService`,
  `MigrationStatus`, `PgMigrationModule`, `MongoMigrationModule` and `CommonDatabaseEntity` are gone,
  and a migration in each database drops the `migrations` table. The two backfills are deleted as
  applied.
- **auth seeds its first admin at startup.** `LifecycleUserSeeder` (`OnApplicationBootstrap`) runs
  `UserEnsureAdminUseCase`, which creates an admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` through
  `UserCreateOneUseCase` only while no user holds the `ADMIN` role. The create emits
  `auth.user.create`, on which storage opens the root folder — parked until storage first subscribes
  if it is not up yet ([0005](0005-parking-unrouted-events.md)). A failure fails the bootstrap.

## Consequences

- A failed migration keeps the service down, and the whole CLI is available: `migration:down`,
  `:list`, `:pending`, `:fresh`, and `:check`, which exits non-zero while the entities and the
  snapshot disagree.
- The CLI and the app discover the same entities: the listed ones and whatever their relations
  reach. One registered through `forFeature` but reached by neither fails the app's bootstrap,
  instead of going missing from the next generated migration.
- swc still differs from tsc in one place: it emits no `design:type` for an unannotated getter,
  where tsc emits `Object`. A `persist: false` getter therefore declares its `type`; the CLI refuses
  loudly when one does not.
- `@mikro-orm/cli` is a production dependency of the services, since the image runs it.
- MikroORM rewrites the snapshot after `migration:up` / `:down` / `:fresh` from the database it
  ran against. For storage that pulls in the owner-scoped parent key, which exists only as raw SQL,
  and the next `migration:create` would drop it. `definePgConfig` therefore turns the snapshot off
  for those three commands, keying on `process.argv`; only `migration:create` moves it. A path the
  toggle misses — a programmatic `migrator.up()` over the service config — is caught by CI,
  which refuses a pull request that changes a snapshot without adding a migration.
- The admin semantics moved: deleting every admin makes the next start create one from the
  environment again. An existing admin — its password included — is never touched.
- No call crosses services at deploy time any more. Storage's one remaining caller of
  `AUTH_GRPC_URL` is the weekly user sweep.
- A database must show all three tasks as `success` in `migrations` before this change reaches it:
  the table goes, and their history with it.
