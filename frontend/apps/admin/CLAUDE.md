# CLAUDE.md — frontend.admin

Guidance for working inside `frontend/apps/admin`. Stack basics (Next 15 App Router, Refine 5, MUI 6, `@frontend/proto`) are in the root `CLAUDE.md`. This file is the app-specific map.

## What it is

The admin panel. Refine resources under `src/app/`: `auth/{users,temp-codes}` and `storage/{files,images,videos,storage-objects}`, each with list / show / edit / create (+ `create-many`) pages, plus auth pages (login, register, forgot-password).

## Data access (the core path)

1. Refine's `grpcDataProvider` (`'use client'`, `features/grpc/providers`) delegates every CRUD call to **Next server actions** (`'use server'`, `features/grpc/actions/grpc.data.actions.ts`).
2. Those actions resolve a repository by resource via `grpcDataService.getRepository(resource)` and call `getById`/`getList`/`createOne`/… on a `Grpc*Repository` from `@frontend/proto`.
3. **gRPC runs on the Next server, not in the browser** — `@grpc/grpc-js` is a Node client. Browser → server action → gRPC → api-gateway (`BACKEND_GRPC_URL`). `authService.getAuthMetadata()` injects the JWT into gRPC metadata on every call.

## ⚠️ Known issue: repositories use the wrong audience

The data layer currently instantiates the base `Grpc*Repository` (see `common/clients/index.ts`, `features/grpc/repositories/`), but an admin panel should use the **`Grpc*AdminRepository`** variants from `@frontend/proto`. This is a known incorrectness slated to be fixed — prefer the `Admin` repositories when adding/adjusting resource access.

## Binary media (separate path)

File/video upload, download, open, and player do **not** go through the data provider. They use Next **route handlers** under `src/app/api/{files,videos}/[id]/...` (multipart via `busboy`, client calls through `internalHttpClient` baseURL `/api`). Chunked upload is sized by `CHUNK_SIZE_MB`; see `features/storage` (`use-single/multiple-file-upload`, uploader, per-type action providers) and `features/video`/`image`.

## Layout (feature-sliced)

- `src/app/` — App Router: resource pages + auth pages + `api/` route handlers.
- `src/common/` — reusable Refine wrappers (`app-create/edit/show`), layouts, entity/edit fields, hooks (`use-validated-form`, `use-resource-show`), `config.service`, grid-columns builder.
- `src/features/` — `grpc` (data access), `auth` (authProvider + JWT cookie), `storage`, `image`, `video`.

## Config & commands

`config.service` reads env: `BACKEND_GRPC_URL` (api-gateway), `DEFAULT_EMAIL` / `DEFAULT_PASSWORD`, `CHUNK_SIZE_MB`, `PORT`, `HOSTNAME`.

```bash
pnpm dev              # refine dev (Refine CLI wrapping Next)
pnpm build / start    # refine build / start
pnpm lint             # next lint
```
