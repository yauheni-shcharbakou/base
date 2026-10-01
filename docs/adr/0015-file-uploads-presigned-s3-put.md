# 0015 — File and image bytes go browser → Bunny Storage over a pre-signed S3 PUT, confirmed by a call

**Status:** Accepted (2026-09-26)
**Applies to:** `backend.storage`, `backend.api-gateway`, `frontend.admin`, `@packages/proto`

## Context

[ADR-0014](0014-video-uploads-bypass-the-backend.md) took video bytes off our infrastructure and
left files and images on the old path: browser → multipart POST into a Next route handler (busboy,
1 MB chunks, a hand-rolled ack protocol) → gRPC duplex `uploadOne` → api-gateway → a storage
use-case piping a `PassThrough` into Bunny Storage. Everything 0014 said against that path holds
here as well: every byte crosses three processes, two stay pinned for the whole transfer, and
backpressure is ours to get right.

The video design could not be copied, for three reasons:

- **Bunny Storage has no TUS endpoint.** Its HTTP API authenticates with the zone password in an
  `AccessKey` header, which cannot be handed to a browser. The only way to give a browser a scoped,
  expiring credential is the zone's **S3-compatible API**, which supports SigV4 pre-signed URLs.
- **S3 compatibility can only be turned on when a zone is created.** An existing zone cannot be
  converted, so the move needs a new zone and a copy of every object.
- **Bunny Storage reports nothing back.** Stream has the status webhook that ADR-0014 relies on;
  Storage has no events at all, so nothing tells us that a PUT landed.

Rejected alternatives:

- **Pre-signed S3 multipart.** It would resume across failed parts, but it needs create /
  sign-parts / complete / abort RPCs and part bookkeeping in the browser. Files here are capped at
  100 MB, which one PUT carries comfortably. This becomes worth it only if the cap grows past a few
  hundred MB.
- **Keeping the streaming path on the new zone.** It works (PR 1 of the move ran exactly that), but
  it keeps the cost the move exists to remove.
- **Trusting the browser's "done".** Without a provider signal the row would turn READY on the
  client's word, including for a truncated or never-sent body.

## Decision

- **A new S3-enabled zone per environment.** The storage zone (`BUNNY_STORAGE_ZONE`, the bucket and
  S3 access key id) and the pull zone in front of it (`BUNNY_STORAGE_CDN_ZONE`) are named
  separately. The pull zone survives the move and has only its origin repointed, so CDN hostnames,
  token keys and signed read URLs are unchanged. `StorageFileService` talks S3 through
  `@aws-sdk/client-s3` (`FILE_S3_CLIENT`), path-style, with checksums only `WHEN_REQUIRED`.
- **Keys are copied verbatim.** `scripts/copy-storage-zone.ts` lists the old zone over the HTTP API
  and streams each object into the new one with a SHA256 check. `files.provider_id` stays valid, so
  there is no database migration. It skips any key already present with the same size, which lets
  the same run pick up the delta after the cut-over.
- **Create returns credentials.** File and image `createOne`/`createMany` return
  `FileCreated { file, upload }` / `ImageCreated { image, upload }`. `FilePresignedUpload` carries
  `url`, `contentType` and `expires`. This follows ADR-0014's reasoning: the credentials stay
  separate from the read model. The URL signs `Content-Type` and `Content-Length`, and its lifetime
  is `BUNNY_STORAGE_UPLOAD_EXPIRES_IN_MINUTES`.
- **An explicit confirmation replaces the webhook.** After its PUT the browser calls
  `FileService.completeUpload` (an image uses its `fileId`). `FileCompleteUploadUseCase` HEADs the
  object:
  - absent → `Conflict`, row untouched;
  - size differs from `file.size` → `FAILED` plus a provider delete;
  - equal → `READY`, written conditionally over `PENDING`/`FAILED`.

  A READY file returns as is, so the call is idempotent.

- **`uploadOne` is gone**, together with the gateway proxy method, the storage use-case, the admin
  route handler, busboy and `CHUNK_SIZE_MB`.
- **File and image deletes purge the provider whatever the status.** Bytes can now exist before the
  row is READY, so `providerId` presence is the gate.

## Consequences

- **The Next server and the backend never carry file bytes.** The admin's `uploadViaPresignedUrl`
  PUTs straight to `*-s3.storage.bunnycdn.com`. The gRPC surface no longer has a single streaming
  RPC, so the gateway's stream guard is now unused.
- **Size is verified again,** which ADR-0014 lost for video. Two layers check it: the signed
  `Content-Length`, if Bunny enforces it, and the HEAD in `completeUpload`, which does not depend on
  the provider's signature handling.
- **An abandoned upload is the cleanup cron's job,** as before. A PUT that landed but was never
  confirmed stays `PENDING` until `STORAGE_PENDING_FILE_TTL_HOURS`, and the cron then deletes the
  row and the object.
- **A retry reuses the credentials of its first attempt while they are still good.** The
  multi-upload hook keeps the created entity so that a retry skips creation and leaves no second
  row. Once `upload.expires` is within a few minutes, the retry drops that entity and creates the
  item afresh, and the stale row is left to the cleanup cron. The same rule covers video's TUS
  signature, which carries the same `expires`. A batch signs every file up front, which is why the
  default window is an hour rather than minutes.
- **Dependence on a preview API.** Bunny's S3 layer is in preview: CORS is fixed at `*`, the zone
  allows 500 requests per second, and some error codes differ from AWS. If presigned PUTs
  regress, the fallback is the server-side streamed `PutObject` of the zone-move commit, which
  runs over the same zone and credentials.
- **Each environment moves on its own zone.** dev and prod never share an S3 zone. The copy runbook
  is in `backend/apps/storage/README.md`.
