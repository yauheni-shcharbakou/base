# CLAUDE.md — frontend.admin

Guidance for working inside `frontend/apps/admin`. Stack basics (Next 15 App Router, Refine 5, MUI 6, `@frontend/proto`) are in the root `CLAUDE.md`. This file is the app-specific map.

## What it is

The admin panel. Refine resources under `src/app/`: `auth/{users,temp-codes}` and `storage/{files,images,videos,storage-objects}`, each with list / show / edit / create (+ `create-many`) pages, plus auth pages (login, register, forgot-password).

## Data access (the core path)

1. Refine's `grpcDataProvider` (`'use client'`, `features/grpc/providers`) delegates every CRUD call to **Next server actions** (`'use server'`, `features/grpc/actions/grpc.data.actions.ts`).
2. Those actions resolve a repository by resource via `grpcDataService.getRepository(resource)` (`features/grpc/services/grpc.data.service.ts`) and call `getById`/`getList`/`createOne`/… on the **`Grpc*AdminRepository`** variant from `@frontend/proto` — the admin panel talks to the api-gateway `Admin` audience.
3. **gRPC runs on the Next server, not in the browser** — `@grpc/grpc-js` is a Node client. Browser → server action → gRPC → api-gateway (`BACKEND_GRPC_URL`). `authService.getAuthMetadata()` injects the JWT into gRPC metadata on every call.
4. **A server action never throws; it returns an `ActionResult`** (`features/grpc/types`). Wrap its body in `runAction`. The caller unwraps with `unwrapActionResult`, which throws an `Error` carrying `statusCode`, the `HttpError` Refine reads. A 4xx keeps the backend's message. A 5xx or an error without a gRPC status gets a fixed message, and the original is logged on the Next server (`GrpcErrorMapper`, `features/grpc/mappers`; `reportError` does the mapping and the logging). An `app/api` route handler answers a caught error with `errorResponse(error)`, the same mapping as `{ message }` with its status — never `getErrorMessage`, which returns grpc-js `details` verbatim and is for client code. `run-action.ts`, `report-error.ts` and `error-response.ts` load grpc-js, so they are imported by path, and only from server modules. `features/grpc/helpers` has no barrel on purpose.

   > **Why failures travel as values:** [docs/adr/0020-server-action-failures-as-values.md](../../../docs/adr/0020-server-action-failures-as-values.md)

`features/grpc/repositories/index.ts` is the **single source** of `Admin` repository singletons (user, temp-code, file, image, storage-object, video). They are consumed by:

- `features/grpc/services/grpc.data.service.ts` — `GrpcDataService` builds the resource→repository map behind the CRUD data provider from these singletons (no longer instantiates its own).
- the binary-media **route handlers** (`app/api/*`) and the storage create/folder **server actions** (`features/storage/actions/*`), which import the storage repos directly.

The **auth** flow (`features/auth/services/auth.service.ts`) is separate and deliberately uses the `Web`/`Public` audiences (`GrpcUserWebRepository`, `GrpcAuthPublicRepository`): login / refresh / current-user are web-audience calls, not admin CRUD. `getAuthMetadata()` is the single source of gRPC metadata for every authenticated call, upload confirmations included. Login and refresh carry `getClientMetadata()` instead — the browser's address as `x-client-ip`, which the gateway rate-limits them by (see `backend/apps/api-gateway/CLAUDE.md`).

## Binary media (separate path)

Upload, download, open, and player do **not** go through the data provider. Download/open/player use Next **route handlers** under `src/app/api/{files,videos}/[id]/...`, reached by browser navigation alone — `<a download>` (`DownloadButton`), `<a href>`, the player `<iframe>`, the preview `<Image>` — so no script reads their error body: an iframe or a new tab shows the raw JSON, a download or an image just fails. The two download handlers proxy the signed CDN URL through `features/storage/helpers/download-proxy.ts` (imported by path): **never pass `request.headers` to that `fetch`** — it carries the admin's session cookies to a third party. `toUpstreamHeaders` forwards an allow-list (`Range`, `If-Range`, and `Referer` cut to its origin — the Stream pull zone rejects a request without an allowed referrer) with `Accept-Encoding: identity`, and `toDownloadResponseInit` returns the CDN's status (206 for a range) with `Content-Range` / `Accept-Ranges` / `ETag` / `Last-Modified`, so a browser can resume. **`next/image` runs unoptimized** (`images.unoptimized` in `next.config.mjs`): nothing resizes an image — the storage pull zone has no Optimizer — so an `<Image>` takes its `src` as given, with no `loader`, and the `open` handler redirects to the signed URL untouched ([ADR-0026](../../../docs/adr/0026-folder-listing-carries-signed-previews.md)). See `features/storage` (`use-single/multiple-file-upload`, uploader, per-type action providers) and `features/video`/`image`.

**No upload has a route handler — bytes go from the browser straight to Bunny.** `createOne`/`createMany` return the entity together with credentials, and both upload hooks take a required `uploadFileAction` (`features/storage/types`, the same `Action`-suffix trick as `createManyAction`, for Next's 71007 check) that spends them. Video: `uploadViaTus` (`features/video/helpers`) over Bunny Stream TUS. Files and images: `uploadViaPresignedUrl` (`features/storage/helpers`) PUTs to the pre-signed Bunny Storage URL, then calls the `completeFileUpload` server action — an image completes by its **`fileId`**, not its own id ([ADR-0015](../../../docs/adr/0015-file-uploads-presigned-s3-put.md)). `useMultipleFileUpload` keeps failed items with their created entity, so a retry creates only what has no row yet — or whose `upload.expires` is about to pass. That split and the merge of created entities back into the map are pure functions in `features/storage/helpers/upload-batch.ts`, unit-tested — change the retry rules there, not in the hook. A new selection replaces the old one, and the rows of dropped items (re-selected or removed from the failed list) are deleted through the generic `deleteOne` action, best effort. `VideoActionProvider`/`FileActionProvider`/`ImageActionProvider` flatten the `{ entity, upload }` pair so the hooks still see a flat record; the create pages strip `upload` before handing the record to Refine. **`uploadViaTus` disables tus's fingerprint URL storage on purpose** (`storeFingerprintForResuming: false`, no `findPreviousUploads`): that storage is keyed by the file, not by the `videoId`, so re-uploading the same file resumed the *previous* video's finished upload and left the new row `PENDING` with the UI claiming success. See [ADR-0014](../../../docs/adr/0014-video-uploads-bypass-the-backend.md).

The `file`/`image`/`video` resources are registered in `app/layout.tsx` with `dataProviderName: 'upload'` → a second data provider `grpcUploadDataProvider` (`features/grpc/providers`) whose `create`/`createMany` just echo their variables. Refine's built-in create step is intentionally a no-op for these: the entity row is created and its bytes uploaded by the create pages themselves (create/`create-many`) via the storage server actions + the direct upload helpers.

## Forms & fields

- `useValidatedForm(zodShape, props)` (`common/hooks`) wraps Refine's `useForm` with a Zod resolver and also surfaces `providerData` (the loaded record).
- **A backend rule is not checked again in the admin.** A refusal that belongs on a field comes back with a status that singles it out, and the form maps it there. The storage-object create and edit pages use `useStorageObjectForm` (`features/storage/hooks`): a 409 is a taken name, so it goes on `name` (or on `parent` for a move that kept its name) with the backend's message, in place of Refine's notification. There is no `isExists` lookup before the save. A FILE / IMAGE / VIDEO object places media picked in `MediaSelect` (`features/storage/components`), which lists only what the backend accepts: `placeableMediaFilters` (`features/storage/helpers/media-options.ts`) asks the owner's unplaced READY media, without a file backing an image or a video. The type → resource / create field map is `MEDIA_BY_TYPE` there.
- `TypedController` (`common/components/edit-fields/wrappers`) is a thin generic wrapper over RHF `Controller`; the `Controlled*` inputs (`ControlledTextField`, `ControlledSingleSelect`, `ControlledBooleanField`) and the register-based `*EditField` components build on it. `UserSelect` / `FolderSelect` / `MediaSelect` are async-option selects layered on `ControlledSingleSelect`.
- `GridColumnsBuilder` (`common/utils/grid-columns.builder.tsx`) is a fluent builder for MUI `DataGrid` columns (`.string()/.enum()/.date()/.ref()/.actions()…`), memoized per list page with `useMemo`.
- **List pages** (`common/components/pages/resource-list.page.tsx`) intentionally do **manual** URL sync (`syncWithLocation: false` + `router.push`/`useSearchParams`) behind an `isMounted` gate + `enabled: () => isMounted`. Do **not** migrate this to Refine's built-in `syncWithLocation` / a directly-rendered `DataGrid` — that was tried and reverted because Refine then never fires the initial `getList` (infinite loading) and React throws "state update on a component that hasn't mounted yet". See the note at the top of that file.
- **Perf & hooks:** subscribe to specific fields with `watch('field')` / `useWatch` (never the whole-form `watch()`), and read one-off values inside handlers with `getValues()`. Keep hooks at component top level (not inside a `Controller` `render` prop or a conditional) — the shared ESLint preset now enforces `react-hooks/rules-of-hooks` (error) and `react-hooks/exhaustive-deps` (warn).

## Layout (feature-sliced)

- `src/app/` — App Router: resource pages + auth pages + `api/` route handlers.
- `src/common/` — reusable Refine wrappers (`app-create/edit/show`), layouts, entity/edit fields, hooks (`use-validated-form`, `use-resource-show`), `config.service`, grid-columns builder.
- `src/features/` — `grpc` (data access), `auth` (authProvider + JWT cookie), `storage`, `image`, `video`.

## Config & commands

`config.service` validates env through `validateEnv`; that call owns each variable's type and default, and the table in [docs/env.md](../../../docs/env.md) is generated from it — change the schema and run `pnpm compile:env-docs` rather than editing the table. All of it is read on the Next server, so nothing there is a `NEXT_PUBLIC_*`.

```bash
pnpm dev              # refine dev (Refine CLI wrapping Next)
pnpm build / start    # refine build / start
pnpm lint             # next lint
pnpm test             # jest over src/**/*.spec.ts — pure helpers only, node environment
```

A spec imports its subject by path, never through a barrel that re-exports React or MUI code, so the suite stays a plain node run with no DOM. `next build` type-checks the specs too, and the tsconfig targets ES5: spread a `Map` iterator through `Array.from`.
