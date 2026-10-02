# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] — 2026-10-02 — `fix/image-preview-cron-customization`

The preview sweeps of `backend.storage` — the backstop that makes the image and PDF previews the
upload event did not — stop being a fixed 20 rows every 10 minutes. A sweep now drains its backlog
batch after batch within a time budget, gives up on a row that keeps failing, and stops instead of
counting failures while the provider is down. All of it is tuned by env, and nothing in it needs an
action on upgrade: the new variables have defaults, and the migration runs before the service
starts. The reasoning is in
[ADR-0037](docs/adr/0037-preview-sweep-drains-within-a-time-budget.md).

### Added

- **A sweep takes batch after batch** while there is a backlog and its budget lasts —
  `STORAGE_{IMAGE,DOCUMENT}_PREVIEW_SWEEP_BUDGET_MINUTES`, 8 of every 10 minutes by default, 0 for
  one batch a sweep. A backlog drains at the pace of the renders, with no pace to guess.
- **A row is given up on after a cap of failed sweeps** —
  `STORAGE_{IMAGE,DOCUMENT}_PREVIEW_SWEEP_MAX_ATTEMPTS`, 12 by default (two hours at the least), 0
  for never. The count is the new `preview_attempts` column on `images` and `files`; a row the cap
  marked is told from one no retry can help by that count, and
  [`docs/env.md`](docs/env.md) has the statement that queues such rows again.
- **Ten failures in a row stop a sweep, uncounted** —
  `STORAGE_{IMAGE,DOCUMENT}_PREVIEW_SWEEP_BREAKER_THRESHOLD`, 10 by default, 0 for never: that many
  at once is the provider down, not the rows, so an outage does not spend the cap of a backlog.
  Keep the threshold at or under the batch limit.
- **A tick is skipped while the previous sweep is still running**, per process.

### Changed

- The batch size and the grace of both sweeps are env's:
  `STORAGE_{IMAGE,DOCUMENT}_PREVIEW_SWEEP_LIMIT` (20) and `…_SWEEP_GRACE_MINUTES` (10), the values
  that were constants. The limit is a batch size now, not a pace.
- The image and the document sweeps run on one code — `PreviewSweepUseCase` and
  `PreviewSweepScheduler`. In the log a PDF's row reads `Document <id>` where it read `File <id>`.
- A migration's `--name` label is written in `snake_case`; the rule is in `backend/CLAUDE.md`.

### Fixed

- **A batch of failing rows no longer holds a sweep back for good.** A sweep read the oldest rows
  without a preview every time, so a limit's worth of rows that kept failing was all it ever read.
  It now goes on from a cursor and passes them.

## [2.0.0] — 2026-10-01 — `feat/storage-updates`

The event bus moves from NATS to Redis/BullMQ, media bytes stop crossing the backend, storage
becomes a closed per-owner folder tree with a Drive-like browser in the admin panel, and auth gets
RS256 access tokens with revocable, rotating refresh sessions. Around that: a cache package, a
rate-limited gateway, migrations through the MikroORM CLI, a CI workflow, and a documentation layout
of ADRs and generated env tables. All entries below are relative to `1.0.0`; the reasoning behind
each structural change is in [`docs/adr/`](docs/adr/README.md).

### Upgrade notes

A 1.0.0 deployment does not start on this release unchanged. Every variable is tabulated in
[`docs/env.md`](docs/env.md).

- **Broker.** Provision Redis and set `REDIS_URL` on `backend.auth`, `backend.storage` and
  `backend.api-gateway`. `NATS_URL` is no longer read by any service. Keep the instance on
  `maxmemory-policy noeviction` — it holds durable queues.
- **JWT.** `ACCESS_JWT_SECRET` is gone. Generate an RSA pair (snippet in `README.md`) and set
  `JWT_ACCESS_PRIVATE_KEY_BASE64` + `JWT_ACCESS_PUBLIC_KEY_BASE64` on auth and the public half on
  the gateway. Every token issued by 1.0.0 is refused: users sign in again.
- **Bunny.** `BUNNY_STORAGE_ZONE` (a storage zone created **with S3 compatibility**) and
  `BUNNY_STREAM_READ_ONLY_API_KEY` are new and required; `BUNNY_STORAGE_CDN_ZONE` now names the
  pull zone only. Moving an existing zone: the runbook in `backend/apps/storage/README.md`. "Token
  IP validation" must be off on both pull zones.
- **Storage is publicly reachable.** Its `PORT` is now a real HTTP listener serving the Bunny
  Stream webhook, must differ from the `STORAGE_GRPC_URL` port, and needs a public domain; the
  library's webhook URL is `https://<storage-domain>/webhooks/bunny/stream`.
- **Migrations.** The `migrator` sub-app is removed. Migrations live in `src/migrations` and run
  through the MikroORM CLI (`pnpm migrate`); the Docker images apply them before starting the app.
  The first admin is created by auth on start-up from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **Admin.** Runs as **one process** — refresh tokens rotate, and a second instance would spend the
  same token twice and end the session. `CHUNK_SIZE_MB` is gone; `CLIENT_IP_HEADER` names the header
  the proxy in front overwrites (`x-real-ip` by default).
- **Default ports** in the examples moved: gateway `9000`, auth `9001`, storage `9002`.
- **gRPC contracts** (for any other client of the gateway):
  - the client-stream `uploadOne` RPCs of `File*Service` and `Video*Service` are removed, with
    `UploadOne*` and `*UploadResponse`;
  - `createOne` / `createMany` of file, image and video return `*Created` / `*CreatedArray` — the
    entity plus its upload credentials — instead of the bare entity;
  - `FileCreateMany.items` is `repeated FileCreate` under a new tag; `FileCreateManyItem` is gone;
  - `uploadId` is removed from `File`, `Image`, `Video` and the create-many items; `ip` from
    `GetUrlMap` / `GetUrlMapShort`; `FileQuery.createdAfter` is now `createdBefore`.
- **Packages.** `@backend/nats` is now `@backend/event-bus-nats`; the events
  `storage.image.delete` and `storage.storageObject.parentUpdate` no longer exist.

### Added

#### Event bus

- **`@backend/event-bus-redis`, the live transport** — a BullMQ adapter generated from the same
  `EventBusStrategy` ([ADR-0001](docs/adr/0001-redis-as-live-transport.md)). A mediator fans each
  event queue out into one queue per subscriber
  ([ADR-0004](docs/adr/0004-redis-mediator-fan-out.md)); events emitted before anyone subscribed are
  parked and replayed ([ADR-0005](docs/adr/0005-parking-unrouted-events.md)); subscriptions are
  scoped by a consumer id ([ADR-0006](docs/adr/0006-consumer-scoped-subscriptions.md)); the worker
  and connection topology is reported at bootstrap.
- New events: `auth.user.delete`, `storage.file.purge`, `storage.file.ready`,
  `storage.video.uploaded`.
- Unit and broker-backed e2e suites for both transports.

#### Cache and rate limiting

- **`@backend/cache`** — one `CacheStore` port with Redis and in-memory adapters behind a single
  module ([ADR-0009](docs/adr/0009-cache-one-package-driver-switch.md)), failing soft
  ([ADR-0010](docs/adr/0010-cache-fails-soft.md)).
- `backend.auth` caches the identity read behind the gateway's per-request access check and evicts
  on every user write ([ADR-0011](docs/adr/0011-identity-cached-in-auth.md)).
- The gateway limits gRPC calls per user — reads apart from writes — and sign-in attempts per client
  address, answers `RESOURCE_EXHAUSTED` with a `retry-after` trailer, and keeps its counters in
  Redis so replicas share one limit
  ([ADR-0024](docs/adr/0024-gateway-rate-limit-counters-in-redis.md)).

#### Auth

- **RS256 access tokens**: auth signs with the private key, the gateway verifies locally with the
  public one; every token carries its kind as `aud`.
- **Refresh sessions in Postgres**: a refresh token is valid only while its `sessions` row exists
  ([ADR-0028](docs/adr/0028-refresh-sessions-in-postgres.md)), is replaced on every refresh, and a
  token spent twice ends the session ([ADR-0029](docs/adr/0029-refresh-token-rotation.md)). A
  `logout` RPC revokes a session; a password change ends all of the user's; expired rows are swept
  hourly.
- The first admin is seeded at start-up through the regular create use-case, so storage opens its
  root folder like any other user's.

#### Storage

- **Direct uploads.** Video goes browser → Bunny Stream over pre-signed TUS, with the outcome
  delivered by a signature-guarded webhook and a new `UPLOADED` status for the encoding window
  ([ADR-0014](docs/adr/0014-video-uploads-bypass-the-backend.md)); files and images go over a
  pre-signed S3 PUT confirmed by `completeUpload` / `completeMany`
  ([ADR-0015](docs/adr/0015-file-uploads-presigned-s3-put.md)). Bunny Storage is written over its
  S3 API; `pnpm storage:copy-zone` copies an old zone into an S3-enabled one.
- **A closed tree per owner**: a parent must be a live folder of the same owner, enforced by a
  composite foreign key and CHECK constraints
  ([ADR-0021](docs/adr/0021-storage-tree-closed-per-owner.md)); tree writes run under one advisory
  lock per owner ([ADR-0019](docs/adr/0019-tree-writes-under-one-advisory-lock.md)); one root folder
  per user, by a partial unique index; names are unique among a folder's live objects and sort
  through an ICU collation.
- **Folder reads**: `getFolderContent` (breadcrumbs, folders first, typed sorters and filters,
  signed `previewUrl` per item — [ADR-0026](docs/adr/0026-folder-listing-carries-signed-previews.md))
  and `getRootFolder`; `folderStats` — files, subfolders and bytes over the whole subtree, computed
  on read ([ADR-0033](docs/adr/0033-folder-stats-computed-on-read.md)).
- **Batch tree writes, all or none**: `deleteMany`, `moveMany`, `updatePublicMany`, `createFolders`.
  A move lands under a suffixed name when the name is taken; only a typed name is refused
  ([ADR-0030](docs/adr/0030-a-move-suffixes-a-taken-name.md)).
- **Previews**: an image gets a webp preview on upload
  ([ADR-0027](docs/adr/0027-image-preview-made-on-upload.md),
  [ADR-0034](docs/adr/0034-image-original-spooled-to-a-temp-file.md)); a PDF gets its first page,
  drawn by pdf.js in a worker thread
  ([ADR-0032](docs/adr/0032-pdf-preview-drawn-by-pdfjs-in-a-worker.md)). Sweeps backfill what an
  event missed.
- **Deletion that reaches the provider**: provider objects are purged over the event bus after
  their rows are gone, whatever the upload status; deleted storage objects are swept by a cron
  ([ADR-0016](docs/adr/0016-provider-purge-over-the-event-bus.md)); a deleted user's tree and media
  go with them, with a weekly sweep against auth as the backstop.
- An upload still `PENDING` once its upload window has closed turns `FAILED`; the video sync lifts
  to `READY` any video Bunny reports encoded.
- A `createOne` leaf can place media its owner already holds.

#### Admin panel

- **Folder browser** for a user's storage — Drive's grid and list, Finder's gallery, and a
  full-screen viewer. Selection by click, range, checkbox and marquee, kept across pages; batch
  move, delete and visibility; rename in place; drag and drop between folders; right-click menus;
  keyboard shortcuts that work on any layout; folder stats and decimal sizes; view state in the URL,
  preferences in a cookie.
- **Uploads in place**: files and whole folders dropped or picked, an upload box that outlives the
  page, batched creates and confirmations, cancel, retry, "upload again" for a failed item, and a
  pause that waits out the gateway's rate limit.
- A **folder picker** in Drive's "Move to" style replaces the folder select in every form;
  `MediaSelect` lists the media a new leaf may place.
- PDFs render in the gallery through pdf.js
  ([ADR-0031](docs/adr/0031-gallery-pdf-rendered-by-pdfjs.md)); videos play in an embedded Bunny
  player that keeps the page's keys.
- An expired session is refreshed in middleware before the page renders, with one gateway refresh
  per refresh token; logout revokes the session and ends with a document load
  ([ADR-0036](docs/adr/0036-a-session-ends-with-a-document-load.md)).
- Server actions return their failure as a value, so the backend's status and message reach the
  page ([ADR-0020](docs/adr/0020-server-action-failures-as-values.md)); a rate-limited query
  retries once the gateway's window resets.
- Unit suites for the pure helpers behind all of the above.

#### Tooling, CI and docs

- **CI** (`.github/workflows/check.yaml`) on every pull request into `main`: build, typecheck,
  lint, a dirty-tree guard, the docs and env checks, the migration guards, unit and e2e tests with
  Postgres, Redis and NATS beside the job. A docs-only change runs the docs checks alone. Actions
  are pinned to commits and moved by Dependabot.
- **`docs/adr/`** — 36 architecture decision records and an `/adr` skill; each `CLAUDE.md` keeps
  the rule and links the reason. `pnpm check:docs` holds the layout.
- **`@packages/env-docs`** generates the tables in `docs/env.md` from the zod schemas;
  `pnpm check:env-docs` fails on drift ([ADR-0008](docs/adr/0008-generated-env-tables.md)).
- **pnpm catalog** for shared dependency versions; one tsdown factory that reads each package's own
  manifest; `import-x/no-extraneous-dependencies` fails lint on an undeclared import.
- `pnpm typecheck` in every workspace; `pnpm test` / `test:e2e` through turbo; root `pnpm migrate`
  and `migrate:check`.
- `pnpm docker:db`, `docker:e2e`, `docker:local:d`, their stop commands and `pnpm e2e`; an ngrok
  tunnel for the Bunny webhook in the `local` profile.
- Database specs on `node:test` against a migrated Postgres
  ([ADR-0017](docs/adr/0017-database-specs-on-node-test.md)).
- A `/release` skill for this file, the root version and the README; `check:docs` invariants that
  the version and the top entry here agree and that the entry can be published; and a `release`
  job that tags the commit landing on `main` with `v<version>` and publishes a GitHub Release from
  the entry, once per version. `scripts/release-notes.sh` shapes the entry, with specs of its own
  (`pnpm check:scripts`).

### Changed

- **Migrations run through the MikroORM CLI**, outside Nest; a backfill is a migration
  ([ADR-0022](docs/adr/0022-migrations-through-the-mikro-orm-cli.md)).
- **Each proto target package generates its own code** in its own turbo task
  ([ADR-0023](docs/adr/0023-proto-codegen-task-per-package.md)), and so does each event-bus adapter
  ([ADR-0002](docs/adr/0002-codegen-task-per-package.md)). The imported well-known types are
  vendored and tool versions kept out of generated headers, so any `protoc` emits the same code;
  generated files are formatted as they are written.
- Generated event-bus names are service-scoped
  ([ADR-0003](docs/adr/0003-service-scoped-naming.md)); the NATS adapter sits directly on nats.js v3
  ([ADR-0007](docs/adr/0007-natsjs-v3-direct.md)).
- Package config factories are namespaced
  ([ADR-0012](docs/adr/0012-namespaced-package-config.md)); an unreachable broker fails the boot
  and an emit, instead of hanging ([ADR-0013](docs/adr/0013-event-bus-fails-loud.md)).
- Folder paths are computed on read and a folder's visibility cascades in its own transaction
  ([ADR-0018](docs/adr/0018-folder-paths-computed-on-read.md)); a public folder keeps its content
  public.
- Signed read URLs are bound to no client address, with a window-aligned expiry so a browser reuses
  what it fetched ([ADR-0025](docs/adr/0025-read-urls-bound-to-no-client-address.md)).
- The gateway keeps a callee's gRPC status; the canonical gRPC → HTTP status table is shared from
  `@packages/common`.
- The client address is read from the one header the proxy overwrites
  ([ADR-0035](docs/adr/0035-client-address-from-one-trusted-header.md)).
- `next/image` runs unoptimized; a grid never loads an original.
- The root manifest no longer hoists dependencies — each workspace declares what it imports.
- Turbo hashes each `.env` only into the tasks that load it and never caches `prod`.
- `README.md` and the `CLAUDE.md` files brought in line with all of the above.

### Removed

- `@backend/nats` (renamed and rewritten as `@backend/event-bus-nats`) and the NATS service from
  the default compose profiles.
- The `migrator` sub-apps, their task runner and the migration modules of `@backend/pg`,
  `@backend/mongo` and `@backend/common`.
- The streaming upload path: `uploadOne` RPCs, their use-cases, the admin's `upload` route handlers
  and temp-code authorization of uploads.
- The persisted `uploadId` — a create-many answers by position.
- `.github/workflows/deploy.yaml` (a stub) and `MALLOC_ARENA_MAX` from the Dockerfiles (musl
  ignores it).

### Fixed

- **`@backend/pg` / `@backend/mongo`**: lists, `distinct` and bulk writes fail loudly instead of
  answering empty; a bulk write whose query constrains nothing is refused; an omitted query
  defaults to `{}`; filters work on booleans and computed fields; unique violations map to
  `ConflictException`; repository errors name the resource, not the ORM class; the recurring
  `timestamptz` / enum schema diff is gone.
- **Storage**: a rename or move checks the name in the target folder; deleting an image or a video
  deletes its file row; a video's provider object is purged whatever its status; root-folder write
  failures are no longer swallowed; deleted folders stay out of `getFolders`.
- **API gateway**: the gRPC rate limit is actually enforced; every web handler binds its request
  with `@Payload()`, so validation runs; DTO fields are required unless declared optional.
- **Auth**: an update whose password cannot be hashed fails whole; `SALT_ROUNDS` is coerced from
  its string.
- **Admin**: a signed-out session is a 401, not a 500; a sign-in after a logout is no longer signed
  out by the previous session's cache; a list is fetched once per sort and Back leaves it; the
  admin's cookies are not forwarded to the CDN on download; a media create form saves without a
  folder.
- **Build**: every workspace declares the packages it imports; the package generator scaffolds
  files again; `NODE_ENV=test` passes env validation; package-less protos no longer emit an empty
  `_PACKAGE_NAME`.

## [1.0.0] — 2026-07-06 — `feat/use-case-architecture`

A full clean-architecture (hexagonal / use-case) redesign of the backend
microservices, a rebuilt Protobuf and event-bus codegen pipeline, a migration to
the `tsdown` bundler, and an adaptation + performance audit of the admin panel.
All entries below are relative to `main`.

### Added

- **Hexagonal / use-case backend architecture.** Each feature is split into
  `domain` (abstract contracts), `application` (one-`execute()` use-cases + DTOs),
  `infrastructure` (concrete impls), and `interface` (gRPC/cron/NATS adapters).
  `backend/apps/auth` is the reference implementation; `storage` follows it.
- **Event-bus codegen pipeline.** A second custom compiler parses the
  `EventBusStrategy` interface (`[host][service][event]: Payload`) with ts-morph
  and emits typed abstract buses (`@backend/event-bus`) plus a NATS JetStream
  adapter (`@backend/nats`) with per-service transports, subscriber/handler
  interfaces, and a client factory. Delivery is at-least-once (manual ack,
  `maxDeliver` 10) — subscribers must be idempotent.
- **Layer-direction ESLint guard** (`@packages/configs/eslint/layer-guard.mjs`)
  enforcing the inward dependency direction
  (`interface → infrastructure → application → domain`) by path segment; wired in
  `auth`, `storage`, `@backend/pg`, `@backend/mongo`, `@backend/nats`.
- **Audience-scoped proto contracts** (base / `Admin` / `Web` / `Public`) with
  per-service Transports, controller, and client interface types across the Nest,
  client, and browser adapters.
- **Migrator sub-app** per DB-backed service: MikroORM SQL migrations plus
  idempotent data-seeding tasks (`create-admin`, storage root-folder backfill via
  cross-service gRPC).
- **`eslint-plugin-react-hooks`** wired into the shared Next preset
  (`rules-of-hooks: error`, `exhaustive-deps: warn`).
- Production Turbo pipeline (`turbo.prod.json`) and per-package `tsdown` configs;
  `emitMany` support in the event-bus compiler.

### Changed

- **Protobuf codegen redesigned:** namespace-based message types, removal of the
  proxy-controller layer, a single generated style, and exclusion of external
  deps from package bundling. Emits Nest / client / browser flavors from the same
  `.proto` source of truth.
- **Data layer split** into `infrastructure`/`interface` (`@backend/pg` active,
  `@backend/mongo` dormant); application-generated monotonic **ULID** ids; every
  gRPC handler runs inside a per-request MikroORM `RequestContext`.
- Backend packages migrated to **abstract classes as DI injection tokens**;
  `@backend/common` redesigned; the backend `postgres` package renamed to `pg`.
- **api-gateway** fully redesigned as the edge service — REST + Swagger and a gRPC
  server — proxying internal gRPC services, with audience-split controllers
  (`*.web` / `*.admin` / `*.public`) and gRPC-metadata access guards.
- Frontend proto package and the Turbo package generator migrated to the new
  `tsdown` bundler configuration.
- Consolidated pnpm `overrides` (`react-hook-form`, `sanitize-html`) into
  `pnpm-workspace.yaml`; updated dependencies, Dockerfiles, `protoc` version,
  `README.md`, and the `CLAUDE.md` docs across packages.

#### Admin panel — performance & correctness audit

- Fixed Rules-of-Hooks violations: extracted `DropzoneField` out of a `Controller`
  render prop; made the `folder-select` effect unconditional.
- Fixed a stale-closure bug in `user-select` where `onOptionsLoaded` received the
  previous (empty) options array.
- Replaced whole-form `watch()` with targeted field subscriptions in the storage
  create pages to cut per-keystroke re-renders.
- Memoized the `ColorModeContext` value and `toggleTheme`.
- Deduplicated the `Admin` gRPC repository singletons into a single source
  (`features/grpc/repositories`); `GrpcDataService` now consumes them.
- Memoized upload-hook handlers and removed a fragile `useCallback(handleDelete, [])`.
- Renamed the `createFactory` prop to `createManyAction` to satisfy Next's
  client-component serializable-props check.
- Corrected the date display format `hh:mm:ss` → `HH:mm:ss` (24-hour).
- Gated the Refine devtools panel behind `NODE_ENV === 'development'`.
- Removed the embedded `UserSelect` / `currentUserId` from
  `StorageObjectMetaFormSection`; create pages now render `UserSelect` directly.

### Fixed

- Reset `isUploading` in a `finally` block so it no longer stays `true` on a
  successful single-file upload.
- Corrected NATS JetStream stream naming (host-scoped `host-service-stream`).
- Fixed MikroORM/mongo `update`, id-plugin, and query-mapper bugs.
- Fixed a `pgMapper` type issue.
- Moved gRPC token-utils to `infrastructure` to satisfy the layer-direction guard.
- Registered the missing api-gateway temp-code controllers.

### Notes

- The `resource-list.page.tsx` admin list view intentionally keeps its manual URL
  sync (`syncWithLocation: false` + an `isMounted` gate). Do **not** migrate it to
  Refine's built-in `syncWithLocation` — that was tried and reverted because Refine
  then never fires the initial `getList`.
