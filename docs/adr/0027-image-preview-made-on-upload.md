# 0027 — An image's grid preview is a webp made on upload, and a grid never shows the original

**Status:** Accepted (2026-09-29); how the original is read superseded by 0034 (2026-10-01), how much one sweep takes on by 0037 (2026-10-02)
**Applies to:** `backend.storage`, `@backend/event-bus`, `@packages/proto`

## Context

[ADR-0026](0026-folder-listing-carries-signed-previews.md) put a signed `previewUrl` on each item of
a folder listing. For an image that URL was the original, on the assumption that a client would ask
Bunny Optimizer for a smaller width. The storage pull zone runs no Optimizer and will not, so a
`width` on the URL resizes nothing, and a grid of sixty 5 MB photos downloads 300 MB. Originals also
include GIFs of up to 100 MB, which a single tile would pull whole.

Rejected alternatives:

- **Bunny Optimizer** — a paid add-on the project does not take.
- **Next's `/_next/image` on the admin server** — every original would stream through the admin
  process, with the resized copies cached on a container disk that a redeploy wipes. The admin now
  runs `next/image` unoptimized.
- **Resizing on read** in `backend.storage` — the same cost, moved to the service that also serves
  the gRPC calls, once per viewer instead of once per image.
- **A preview key derived from the original's, with no column** — a listing cannot tell a preview
  that exists from one still being made, and would sign an object that is not there.
- **Falling back to the original until the preview exists** — the 100 MB GIF case again, for as
  long as the preview is missing, and for good when it cannot be made.
- **An animated preview of an animated original** — decoding every frame of a 100 MB GIF is the
  expensive part, and the result would still weigh megabytes.

## Decision

- **`images.preview_provider_id`** holds the key of the object a grid shows, and is exposed as
  `Image.previewProviderId` (tag 11 on `Image` and `ImagePopulated`). It is either a still webp of
  at most 512 px a side under `<original without extension>.preview.webp`, or the original's own
  key when the original is already light: at most 512 px a side and 256 KB, and not a GIF — or an
  SVG of at most 256 KB. `images.preview_failed_at`, not in the proto, marks an image a retry
  cannot help (undecodable bytes, a missing original).
- **`getFolderContent` signs an image by `previewProviderId` only.** Without one, the item has no
  `previewUrl` and a client shows a placeholder.
- **Made after upload, in `backend.storage`:**
  - `FileCompleteUploadUseCase` emits `storage.file.ready` (payload `NestStorage.File`) when its
    conditional write makes the file READY — once, and never from a repeated call.
  - `RedisImageController` (consumer `storage.image`, `concurrency: 1`) runs
    `ImageMakePreviewUseCase`. The event is about any file, so a preview for a raster plain file is
    one predicate away.
  - `CronImageScheduler` sweeps every 10 minutes, up to 20 READY images at a time, one after
    another, whose file turned READY over 10 minutes earlier and which have neither column set. It
    catches a lost emit and backfills images uploaded before previews existed.
- **Rendering is sharp's**, behind `ImagePreviewService`: first frame only (`pages` left at 1),
  EXIF orientation applied, never enlarged, webp quality 75, libvips cache off and one thread. The
  original is read into one buffer of the file's size, and sharp is handed that buffer. Streaming
  into sharp would not save memory: its stream input collects the chunks and concatenates them, two
  copies at the peak.
- **Retries are for what a retry can fix.** A provider or database failure is a `left`, which the
  handler throws for BullMQ to retry. An image that can never have a preview is marked failed and
  answered `right`.
- **Races are settled in SQL.** `setPreview` and `markPreviewFailed` write only
  `where preview_provider_id is null`. The key is derived, so two concurrent runs store the same
  object. A run that finds its image deleted purges the preview it just stored.
- **Deletes purge the preview too.** Every path that deletes file rows reads them with `image`, and
  `FilePurgeService` emits a purge for `previewProviderId` when it is an object of its own.

## Consequences

- **A grid downloads tens of KB a tile, whatever the originals weigh.**
- **A fresh image shows a placeholder for a few seconds**, until the event is handled. Older images
  show one until the sweep reaches them: about 120 an hour, so a large backlog takes hours unless
  `SWEEP_LIMIT` is raised for a while.
- **Peak memory grows by up to one original,** plus one decoded frame — about 100 MB for the largest
  GIF. Previews are made one at a time on purpose, and the service's memory limit must allow for it.
- **The production image keeps optional dependencies.** The storage Dockerfile no longer installs
  with `--no-optional`, because sharp's native binary (`@img/sharp-linuxmusl-x64`) is one.
- **Animation is lost in the grid.** A client that wants it plays the original on demand, through
  `/api/files/{id}/open`.
- **A failed image stays without a preview until someone clears `preview_failed_at`.** Nothing
  retries it on its own; a warning with the reason is logged when it is marked.
- **Changing the size or format means new previews for everything.** The key does not encode either,
  so the new renditions need a new suffix, and old rows must be cleared for the sweep to redo them.
