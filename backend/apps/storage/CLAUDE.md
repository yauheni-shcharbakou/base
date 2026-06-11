# CLAUDE.md — backend.storage

Guidance for working inside `backend/apps/storage`. The 4-layer hexagonal/use-case architecture, `Either` flow, gRPC controllers, and migrator sub-app are in the root `CLAUDE.md`; this service follows the same conventions as `backend.auth` (the reference). This file is the service-specific map.

## What this service is

The media / file storage microservice, backed by **Bunny CDN**. gRPC host `storage`, event-bus host `EventBusHost.STORAGE`, database `Database.STORAGE`. More involved than `auth`: 5 modules, an external provider, cross-module deps, NATS subscriptions, and cron sync.

## Modules (`src/modules/`)

- **storage** — provider abstraction over Bunny (no DB, no controller). `StorageFileService` → Bunny **Storage** API, `StorageVideoService` → Bunny **Stream** API, each via its own axios client (`FILE_HTTP_CLIENT` / `VIDEO_HTTP_CLIENT`). `bunnyStorageConfig` builds API URLs, signed CDN URLs (private key + expiry), and `rootDir` = `dev`/`prod`. Exports the two services.
- **storage-object** — a virtual folder tree (`folderPath`, `isPublic`, `isFolder`). NATS (`NatsStorageObjectController`): on `auth.user.create` → create the user's root folder; on `storage-object.parentUpdate` → cascade `folderPath`/`isPublic` to children. Emits `parentUpdate`. Exports `StorageObjectValidationService`.
- **file** — plain files (Bunny Storage); upload + hourly `FileCleanupUseCase` cron.
- **image** — images; gRPC + NATS.
- **video** — videos (Bunny Stream); upload, url/download maps, and `VideoSyncWithProviderUseCase` (cron) that pages Bunny and `bulkUpdate`s `duration`/`views` by `providerId`. Emits `uploadFinish`/`uploadFail`.

## Entities & migrator

- Note: PG entities live in `src/common/infrastructure/pg/entities/` (shared across modules), unlike `auth` where entities sit inside each module.
- Migrator tasks: `create-root-folders` backfills root folders for existing users — it injects the **auth** `GrpcUserServiceClient` (the migrator declares `appClientStrategy: { auth: [GrpcUserTransport.service] }`), which is why `AUTH_GRPC_URL` is set even though the runtime never calls auth. `add-storage-object-is-folder` backfills the `isFolder` flag.

## Config / env

`config.ts` is just `commonConfig()`; the Bunny config lives in the storage module. Env: `DATABASE_URL`, `STORAGE_GRPC_URL`, `AUTH_GRPC_URL` (migrator only), `NATS_URL`, and `BUNNY_STORAGE_*` / `BUNNY_STREAM_*` (API keys, CDN zones, private keys, expiries, stream library id).

## Commands & gotchas

```bash
pnpm start:dev        # nest start --watch service
pnpm build / migrate (:new/:initial/:sql/:tasks) / lint
```
- NATS handlers must stay idempotent (at-least-once redelivery).
- Heavy cross-module wiring (`video` imports `file` + `storage-object` + `storage`) — check for cycles when adding deps.
