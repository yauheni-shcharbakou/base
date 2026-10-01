# 0014 — Video bytes go browser → Bunny directly, and the callback lands on storage

**Status:** Accepted (2026-09-09)
**Applies to:** `backend.storage`, `backend.api-gateway`, `frontend.admin`, `@packages/proto`

## Context

A video upload used to cross our infrastructure three times: browser → multipart POST into a Next
route handler (busboy, 1 MB chunks, a hand-rolled ack protocol) → gRPC duplex `uploadOne` →
api-gateway proxy → a storage use-case holding a `PassThrough` → one `https.request` PUT into Bunny
Stream. Two processes stayed pinned open for the length of the transfer, backpressure was ours to
get right, and a break anywhere restarted the upload from zero.

Bunny Stream supports pre-signed TUS: the server signs a permission to write into one specific
`videoId`, the browser uploads to `https://video.bunnycdn.com/tusupload` with resume, and the
result comes back as a status webhook. The transfer stops being our problem entirely.

That leaves one design question with a real fork in it: **where does the webhook land?**

`backend.api-gateway` is the tempting answer — it is already public, already listens on HTTP,
already has the global pipes and filters. But it is deliberately a two-layer proxy with no
persistence and no domain layer ([its `CLAUDE.md`](../../backend/apps/api-gateway/CLAUDE.md) states
that as a property). Handling the callback there would put Bunny's `Status` enum and the library's
read-only API key into the one service that knows nothing about providers, and would add an rpc to
`video.service.proto` purely to forward the result onward. Its three audiences — Admin, Web,
Public — are all *our* clients; a provider callback belongs to none of them.

`backend.storage` already owns every `BUNNY_*` credential, the `providerId` that identifies the
video, and the event bus the result has to reach. The cost is that it had no HTTP listener at all
(`main.ts` called `app.init()`, never `app.listen()`).

## Decision

**The bytes never touch us.** `createOne` / `createMany` return `VideoCreated { video, upload }`,
where `upload` is a `VideoTusUpload` — endpoint, `LibraryId`, `VideoId`, the
`hex(SHA256(libraryId + apiKey + expires + videoId))` signature, and the `expires` value. The admin
uploads with `tus-js-client` straight to Bunny. `rpc uploadOne` is gone from all three video
services, along with its gateway proxy method and storage use-case; `file` keeps its streaming path
untouched.

**The credentials sit beside the entity, not inside it.** A separate response message rather than a
field on `Video`, because `Video` is also the read model of `getOne`/`getList` and the payload of
`video.uploadFinish` / `uploadFail` on the event bus. The admin flattens the pair once, in
`VideoActionProvider`, so the hooks keep seeing a flat record.

**The webhook lands on `backend.storage`**, at `POST /webhooks/bunny/stream`, behind a guard that
verifies Bunny's `v1` signature — `lowercase_hex(HMAC-SHA256(raw_body, read-only API key))` — over
the raw request bytes (hence `NestFactory.create(AppModule, { rawBody: true })`). `Status 3` emits
`uploadFinish`; `5` and `8` emit `uploadFail` and delete the broken object at the provider. The
existing `RedisFileController` already consumes both and flips `file.uploadStatus`, so no event-bus
contract changed.

**Publicity is a port-level decision, not a path-level one.** storage stays off `public_network`; in
deployment a public domain targets its HTTP `PORT`, while `STORAGE_GRPC_URL`'s port stays on the
private network. Railway, the deployment target, routes by service and port and has no path-based
ingress, so the unit of exposure is the whole listener: `/webhooks/bunny/stream` is public because it
is the only thing that listener serves, and the signature guard — not the router — is what restricts
who may call it. `PORT` becomes a real listener on a port distinct from `STORAGE_GRPC_URL`'s.

## Consequences

- **`READY` now means "encoded", not "bytes received",** and a fourth status fills the gap. The CDN
  URL does not work before encoding finishes, so this is the more honest reading — but Bunny's
  encode takes up to ~33 minutes, and leaving that in `PENDING` made "still encoding" and "upload
  died" the same state while one TTL knob carried both deadlines. `FileUploadStatus.UPLOADED`
  (appended as `3`, videos only) splits them: callback status 7 writes it, status 3 replaces it with
  `READY`. The write is conditional on `PENDING`, because the three video events are three
  independent queues with independent retries and no mutual ordering — a redelivered `uploaded`
  would otherwise demote an encoded video and hide its player. The cleanup cron does not sweep
  `UPLOADED`; the hourly sync promotes a row whose terminal callback never arrived, so nothing
  becomes unreclaimable.
- **Bunny spells `status` two different ways.** The webhook's codes and a video object's
  `VideoModelStatus` share names and disagree on numbers — "Finished" is `3` in the callback and `4`
  on the object. Two maps, each next to its consumer; one mapping serving both would have made the
  sync backstop silently promote nothing.
- **The cleanup cron had to grow a TTL, and a provider purge.** A pending row now legitimately
  lives for hours, so `STORAGE_PENDING_FILE_TTL_HOURS` (default 24) replaces the hardcoded hour;
  set it below the TUS authorization window plus the encoding queue and the cron deletes uploads
  still in flight. An abandoned TUS upload also leaves an empty video in the library, so the cron
  now deletes the provider object as well as the row — rows first, provider after, because a
  failed purge then leaves only an orphan object rather than a row pointing at nothing.
- **Size is no longer verified.** The old use-case compared bytes received against `file.size`;
  nothing sees the bytes now and Bunny does not report the size, so `file.size` is whatever the
  client claimed.
- **The signature binds `(libraryId, videoId, expires)` and nothing else.** Bunny documents no way
  to pin an upload to an origin, IP, or client. Whoever holds a live signature can write into that
  one empty video until it expires. The mitigations are the ones available: a short window, one
  freshly created `videoId` per authorized request, and the webhook as the record of what landed.
- **No resume across page loads.** tus stores upload URLs under a fingerprint of the *file* —
  `(name, type, size, lastModified, endpoint)` — while the authorization is keyed by `videoId`, and
  every create call mints a fresh one. The two can never line up, so a stored URL only ever belongs
  to a *different* video: re-uploading the same file resumed the previous video's completed upload,
  Bunny answered "already finished", and the new row stayed empty and `PENDING` while the UI
  reported success. `uploadViaTus` therefore sets `storeFingerprintForResuming: false` and does not
  call `findPreviousUploads`. Resume inside one `Upload` — a network blip mid-transfer — is
  unaffected, and it is the only resume this design can offer.
- **The webhook is replayable.** The `v1` signature covers the body alone — no timestamp, no nonce
  — so a captured request stays valid. Tolerable only because the handler is idempotent: it re-emits
  an event whose consumer writes the status it already wrote.
- **The webhook answers 200 even when our own handling failed.** A retry would re-run the same
  failing write; a row that never leaves `PENDING` is what the cleanup cron exists for. The failure
  is logged, not signalled to Bunny.
- **storage now has a public-facing surface.** One route, signature-required, on its own port. Any
  second HTTP route added there widens a perimeter that was previously zero — add one deliberately.
