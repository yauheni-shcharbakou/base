# 0032 — A PDF's grid preview is its first page, drawn by pdf.js in a worker thread and kept on `files`

**Status:** Accepted (2026-10-01)
**Applies to:** `backend.storage`, `@packages/proto`, `frontend.admin`

## Context

[ADR-0027](0027-image-preview-made-on-upload.md) gave every image a small webp that a folder grid
shows instead of the original. A PDF is a plain file, so its tile showed an icon. The admin already
draws PDFs with pdf.js in its gallery and viewer ([ADR-0031](0031-gallery-pdf-rendered-by-pdfjs.md)),
but drawing a tile's first page in the browser means downloading the whole document per tile, and
that is what ADR-0027 was written to stop.

The preview therefore has to be made once, on the backend, when the upload turns READY, as it is for
images. Three questions followed from that.

**What draws the page.** The rejected options:

- **`sharp`**, which the image previews already use. Its prebuilt libvips has no PDF loader
  (poppler or pdfium). Building libvips with one means compiling it into the alpine image.
- **poppler's `pdftoppm` or MuPDF's `mutool` as a child process.** Each is a system package in the
  image and a separate process per document. MuPDF is AGPL. Neither draws the way the admin's viewer
  does.
- **pdf.js** in Node, with `@napi-rs/canvas` as its canvas. It is the same renderer and the same
  version as the admin's viewer, so a tile matches the page the viewer then opens. It is pure JS
  plus one prebuilt native package, which ships a `linux-x64-musl` build for the alpine image. It
  is ESM-only.

**Where it runs.** pdf.js in Node parses and draws on the thread that calls it. A heavy or hostile
document would hold the event loop that serves gRPC and the Bunny webhook, and there is no way to
interrupt a call stuck inside it. A PDF can also exhaust memory, and on the main thread that ends
the whole service. A child process isolates as well, but it costs a Node boot per document and a
copy of the bytes over IPC.

**Where the key lives.** An image's preview is on its `images` row. A PDF has no media row, and a
`documents` table would hold one row per PDF with nothing on it but the preview.

## Decision

- **The preview is `files.preview_provider_id`**, with `files.preview_failed_at` beside it. Both
  columns work as `images` has them: the key is recorded only over none, and a failure is permanent
  until the column is cleared by hand. The proto `File` carries `previewProviderId`. The listing
  signs it for a FILE leaf, and `FilePurgeService` purges
  `image?.previewProviderId ?? previewProviderId`. An image's own preview stays on the image row
  and is never written here.
- **A `document` module makes it.** `RedisDocumentController` is its own consumer of
  `storage.file.ready` (`storage.document`, so its own queue, ADR-0006), with concurrency 1: image
  previews never wait behind a PDF. `DocumentMakePreviewUseCase` mirrors `ImageMakePreviewUseCase`.
  It takes only `PREVIEWABLE_DOCUMENT_TYPES` (`application/pdf`) and marks a file over
  `DOCUMENT_PREVIEW_MAX_BYTES` (50 MB) failed without reading it. It stores a webp of at most 512 px
  a side under `createPreviewKey`. `CronDocumentScheduler` runs `DocumentSweepPreviewsUseCase` every
  10 minutes as the backstop and the backfill.
- **`PdfjsDocumentPreviewServiceImpl` renders in a new `worker_threads` Worker per document**
  (`pdf-first-page.worker.ts`):
  - the bytes are moved into the worker with `transferList`, not copied (a pooled or sliced buffer
    is copied first);
  - the worker's heap is capped with `resourceLimits`;
  - after `DOCUMENT_PREVIEW_TIMEOUT_MS` (20 s) the worker is killed with `terminate()`.

  A timeout, `ERR_WORKER_OUT_OF_MEMORY`, a password or a parse error each mean the document is at
  fault, and it is marked failed. The worker loads pdf.js through `import()`, which the CommonJS
  build keeps. It reads the CMaps, standard fonts, ICC profiles and wasm decoders from the
  installed `pdfjs-dist`.
- **`pdfjs-dist` is pinned once, in the workspace catalog**, for the admin and the service alike.

## Consequences

- **Memory is the operational risk.** `resourceLimits` caps only the worker's JS heap. The document
  buffer, the native memory of pdf.js's decoders and the canvas count against the container outside
  it. A render peaks at about the document's size plus 100–300 MB. An out-of-memory kill takes the
  whole service down, and on Railway `ON_FAILURE` restarts cannot save it from a file that fails the
  same way every time. Concurrency 1, the sequential sweep and the 50 MB cap keep one render at a
  time and bound its size. The service's memory limit must cover that peak. Raise
  `DOCUMENT_PREVIEW_MAX_BYTES` only together with it.
- A redeploy mid-render kills the worker with the process. The BullMQ job returns as stalled, and if
  it does not, the sweep picks the file up.
- pdf.js cannot load under Jest. The use case is specced with the renderer mocked, and the real
  renderer is specced on `node:test` (`test/document.preview.e2e-spec.ts`), as
  [ADR-0017](0017-database-specs-on-node-test.md) does for MikroORM.
- The worker is resolved by the running file's extension: `.js` in `dist`, `.ts` under ts-node. It
  inherits `process.execArgv` minus the test runner's `--test*` flags, which a worker refuses. A
  build that bundled the service into one file would lose the worker file.
- A bump of `pdfjs-dist` moves the admin's viewer and the service's renderer together, and
  `react-pdf` still dictates the exact version (ADR-0031).
- Another document type (Office, EPUB) needs another renderer. It joins by extending
  `PREVIEWABLE_DOCUMENT_TYPES` and the service port, not by a new column.
