# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
