# 0031 — The gallery renders a PDF with pdf.js, loaded whole through the `open` route

**Status:** Accepted (2026-09-30)
**Applies to:** `frontend.admin`

## Context

The folder browser's gallery and its full-screen viewer showed images and videos, but a PDF only
as a big icon and an Open button that went to a new tab. Showing the pages in place, as Drive does,
leaves two questions: what draws them, and how the bytes arrive.

Rejected alternatives:

- **The browser's own viewer in an iframe** (`src` = the signed CDN URL). There's nothing to
  install. But once a click lands in it, the iframe keeps the keyboard. The Bunny player has the
  same problem and needs `keepPageFocus` to hand the focus back, and that trick would break the
  viewer's own text selection and scrolling. It also looks different in every browser, and mobile
  browsers do not show a document inline at all.
- **Range requests (pdf.js's default).** pdf.js sends every range request to the URL it was given.
  That URL is the `open` route, which signs the file on each call and redirects. So every range
  would be another gateway call, counted against the per-user limit of 100 a minute.
- **A server action that returns the signed URL,** like the video player's `getVideoPlayerUrls`.
  It works, but the `open` route already does this for an image's original. The storage pull zone
  sends CORS headers for `pdf`, so pdf.js can follow the redirect.
- **Thumbnails of the first page drawn in the browser, in the grid.** Every tile would download a
  whole PDF. [ADR-0027](0027-image-preview-made-on-upload.md) rules that out for images for the
  same reason.

## Decision

- **`react-pdf` 11 over `pdfjs-dist` 6.3.289** draws the pages. `pdfjs-dist` is a direct dependency
  pinned to the exact version `react-pdf` depends on. The worker is loaded from
  `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`.
- **`PdfDocumentView`** (`features/storage/components/folder-browser/pdf-document-view.tsx`) shows
  the pages in one scrolling column, sized to fit the stage (`getPdfPageWidth`, at most
  `PDF_FIT_MAX_WIDTH`). A page is drawn only while it is near the stage, and until then it keeps
  its height. Over the bottom sits a page counter and a zoom control. `GalleryStage` loads the
  component through `next/dynamic` with `ssr: false`, so neither the library nor its worker is
  fetched until a PDF is shown.
- **The file is loaded whole, in one request:** `Document` gets `getFolderItemOpenUrl(item)` with
  `disableRange: true`. This is one `open` call per PDF shown, made after the same 400 ms rest as
  an image's original.
- **The inline gallery loads a PDF by itself only up to `PDF_AUTOLOAD_MAX_BYTES` (20 MB).** A
  heavier one shows "Show preview". The viewer always loads it.
- **The keys stay with the gallery.** ↑ / ↓ and PgUp / PgDn scroll the PDF through `PdfControls`,
  a ref shaped like `BunnyPlayerControls`. ← / → still step between items.
- **A PDF that cannot be shown falls back to the placeholder** with the reason. A password is never
  asked for through `window.prompt`: a protected PDF is opened in a new tab instead, where the
  browser asks.

## Consequences

- **The worker is about 1 MB.** It is fetched the first time a PDF is shown, and never on a page
  without one.
- **Bump `react-pdf` and `pdfjs-dist` together.** A worker of another version refuses the API
  ("The API version does not match the Worker version").
- **pdf.js's runtime files are served by the admin.** CMaps, standard fonts, ICC profiles and the
  JPEG 2000 / JBIG2 wasm decoders are copied out of `pdfjs-dist` into `public/pdfjs/` by
  `scripts/copy-pdfjs-assets.mjs` on every `dev` and `build` — gitignored, and a turbo output of
  `build`, so a cache hit still ships them. Taken from the installed package, they cannot drift
  from the worker's version.
- **A PDF is downloaded whole before its first page shows.** For a large one, that is a visible
  wait.
- **The grid and the list still show an icon for a PDF.** A first-page thumbnail belongs to the
  backend, made on upload the way ADR-0027 makes an image's preview.
