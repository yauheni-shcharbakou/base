# 0034 — An image's original is spooled to a temp file for its preview, never held in a JS buffer

**Status:** Accepted (2026-10-01), supersedes 0027 in part (how the original is read)
**Applies to:** `backend.storage`

## Context

[ADR-0027](0027-image-preview-made-on-upload.md) read the original into one `Buffer` of the file's
size and handed sharp that buffer. After a large GIF the container's memory stayed up by the size of
the original, and came down only once other uploads arrived — which looked like a leak in sharp.

It is not one. Measured on node 22.22 with sharp 0.34.5 and a 100 MB original:

- **A download that ends within a second:** the buffer is freed about 8 s after the job, by the
  "reduce" collections V8 schedules after a major GC.
- **A download that takes ~30 s, as one from the provider does:** the major GC the allocation
  triggers, and its follow-up collections, all run while the buffer is still alive. After the job it
  is old-space garbage, and an idle process starts no major GC: `arrayBuffers` stayed at 102 MB
  through 90 s of idle and dropped only on a forced `gc()`. The next uploads free it because their
  own buffers raise the external-memory pressure that starts one.

Native memory does not grow: sharp decodes one frame and libvips' cache is off.

Rejected alternatives:

- **`--expose-gc` and a `global.gc()` after each render** — hides the symptom and keeps the peak of
  100 MB of anonymous memory; a runtime flag for one call site.
- **A worker thread per image**, as the PDF preview has
  ([ADR-0032](0032-pdf-preview-drawn-by-pdfjs-in-a-worker.md)) — the memory dies with the worker,
  but the original is still whole in RAM, and every image pays for a worker start.
- **A ranged read of a GIF's first megabytes** — the first frame may not fit in the range, and sharp
  would have to accept truncated input (`failOn: 'none'`) for every GIF.

## Decision

- **`ImagePreviewService.render` takes a `Readable`**, not a `Buffer`. How the bytes are held is the
  renderer's business; `ImageMakePreviewUseCase` passes the provider's stream on and no longer calls
  `readToBuffer`.
- **`SharpImagePreviewServiceImpl` pipes the stream to a file** under `os.tmpdir()`
  (`image-preview-<uuid>`; `TMPDIR` moves it), gives sharp the path, and unlinks the file in a
  `finally`. libvips reads the file itself — it maps a GIF rather than copying it — so the original
  is page cache, not process memory.
- **The two failures stay apart.** A stream or disk failure is a plain `Error`, a `left` BullMQ
  retries. A decode failure is an `ImagePreviewUndecodableError`, which marks the image failed.
- **`sharp.cache(false)` stays, and now matters twice**: with the cache on, libvips would keep the
  unlinked file open after the render.

## Consequences

- **Memory returns without a GC.** Measured in the service's alpine image, on an 84 MB GIF arriving
  over about a minute: with the buffer, RSS went from 67 to 158 MB and stayed there through the idle
  that followed; with the file, from 68 to 85 MB by the time the job returned.
- **The peak is no lower — it is of another kind.** While the render runs, the mapped file counts in
  RSS: 175 MB at the peak, against 164 MB with the buffer. But those are file-backed pages — on a
  50 MB GIF the peak was 37 MB anonymous and 115 MB file-backed, the node binary included — which
  the kernel can drop under pressure when the temp directory is on disk. On a tmpfs they are plain
  memory, so the limit still has to allow for a whole original there, as 0027 said.
- **The service needs a writable temp directory** with room for one original, up to 100 MB. A
  read-only root filesystem needs `TMPDIR` pointed at a writable mount.
- **A process killed mid-render leaves its file behind** until the container is replaced. Nothing
  sweeps the directory.
- **`readToBuffer` stays for the PDF preview.** Its bytes are transferred to a worker and die with
  it, so the same garbage does not form there.
