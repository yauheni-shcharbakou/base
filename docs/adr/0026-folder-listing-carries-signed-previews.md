# 0026 — A folder listing's items carry a signed preview URL

**Status:** Accepted (2026-09-29)
**Applies to:** `backend.storage`, `@packages/proto`, `frontend.admin`

## Context

A folder view — the admin's Finder-like content page — shows thumbnails of the images and videos it
lists. Until now a URL came one item at a time. The admin's `/api/files/{id}/open` route handler
called `FileAdminService.getUrlMap` and answered with a 307 to the CDN. For a grid, that is per
thumbnail:

- a Next route call, plus a gateway call that runs `auth.me` to check access;
- a gateway call counted against the per-user limit of 100 calls a minute across all handlers — one
  folder of 60 images nearly spends it, and the next navigation is refused;
- after the access cookie expires, a refresh of its own, against 10 a minute per address;
- a fresh signature, hence a new URL the browser never finds in its cache.

The listing already holds what signing needs. `getFolderContent` populates each leaf's `file`,
`image` and `video`: an image's key is its backing file's `providerId`, a video's guid its own
`providerId`. Signing is a hash, with no I/O. And [ADR-0025](0025-read-urls-bound-to-no-client-address.md)
made a URL independent of the client's address, so it can be signed where no address is known.

Rejected alternatives:

- **A URL call per thumbnail, as before** — the costs above.
- **A batch URL call after the listing** (`getUrlMap({ ids })`, plus a new video thumbnail map).
  Two more round trips read the same rows again. A caller that forgets both `id` and `ids` also
  turns `getMany` into every row.
- **A side map on the response,** `map<string, Preview> previews` keyed by item id, like the
  credentials [ADR-0014](0014-video-uploads-bypass-the-backend.md) and
  [ADR-0015](0015-file-uploads-presigned-s3-put.md) keep beside the entity. A row that carries its
  own URL renders without a lookup. It does so through a message of its own, because
  `StorageObjectPopulated` is also what `getById` and `getList` return, and should not grow a field
  only a listing fills.
- **URLs on single-item reads** (`getById` of an image, a video or a storage object). A show page
  costs one call either way, and a URL rendered into a page expires under an open tab. The admin's
  show pages keep the `open`/`player` route handlers, whose links sign when clicked. `getById` also
  feeds the Refine data provider's cache and edit forms, which should hold the record alone.

## Decision

- **`StorageObjectFolderContent.items` is `repeated StorageObjectFolderItem`**, same tag 3.
  `StorageObjectFolderItem` repeats `StorageObjectPopulated` field for field — tags 1–16, both
  oneofs — and adds `optional string previewUrl = 17`, so the change is wire-compatible. A
  compile-time alias in the use case fails the build if the two messages drift apart.
- **`StorageObjectGetFolderContentUseCase` signs in memory,** and only READY media:
  - an IMAGE through `StorageFileService.getFileSignedUrl(image.previewProviderId)` — a small
    webp made after upload, never the original; an image without one gets no URL
    ([ADR-0027](0027-image-preview-made-on-upload.md)).
  - a VIDEO through `StorageVideoService.getThumbnailUrl(video.providerId)` — `/{guid}/thumbnail.jpg`
    on the Stream pull zone, with no call to the provider.

  Anything else, and a failed signature, gets no `previewUrl`. `StorageObjectModule` imports
  `StorageModule` for it.
- **Expiry is aligned to the TTL window.** `getAlignedExpiry` (`storage/infrastructure/utils/bunny.cdn-token.ts`)
  computes `ceil((now + ttl) / ttl) * ttl`. A URL lives between one and two TTLs, and every URL
  signed for an object within one window is the same string, so a browser reuses a thumbnail across
  refetches and navigation. Every read signer that uses Bunny's path token goes through it.

## Consequences

- **A folder view costs one gateway call, whatever it shows.** Thumbnails load straight from the
  CDN, with no `auth.me` per image and no burst of refreshes.
- **Four SQL statements per call still hold.** The e2e guard counts them with images and videos on
  the page.
- **A URL lives up to twice its TTL** — 20 minutes for storage and 2 hours for Stream by default.
  URLs of one window expire together, so a view left open refetches the listing once a thumbnail
  fails. The expiry is readable in the URL.
- **Video thumbnails depend on the Stream pull zone's referrer rules.** An `<img>` sends the admin's
  origin as `Referer`, which the allowed referrers must list (`localhost` for the dev library).
  "Block direct url file access" refuses an empty one, so a `no-referrer` policy on the admin would
  break them.
- **The thumbnail name is Bunny's default, `thumbnail.jpg`.** A custom thumbnail set on the provider
  gets another name, which this service never does.
- **Only IMAGE and VIDEO leaves get a preview.** A plain FILE whose type is an image does not;
  extending that is one predicate.
- **An image preview is made, not asked for.** The storage pull zone runs no Bunny Optimizer, so a
  `width` on the URL resizes nothing, and the admin's `<Image>` runs unoptimized rather than pull
  every original through Next's `/_next/image`. The smaller rendition is made at upload time and
  stored beside the original ([ADR-0027](0027-image-preview-made-on-upload.md)).
- **The web audience gets previews too,** for the caller's own tree only.
