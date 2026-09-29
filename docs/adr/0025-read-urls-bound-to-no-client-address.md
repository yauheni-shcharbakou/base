# 0025 — Signed read URLs are bound to no client address

**Status:** Accepted (2026-09-29)
**Applies to:** `backend.storage`, `backend.api-gateway`, `frontend.admin`, `@packages/proto`

## Context

Storage signs every read URL the browser uses. Files and images come from the storage pull zone,
with Bunny's basic token `md5(key + path + expires)`, signed by `getFileSignedUrl`. Video comes from
Stream, through the embed-player token (`getPlayerUrl`) and the MP4 path token (`getDownloadUrl`).

The Stream signers never bound an address. The storage one did: outside `development` it appended
the client's IP to the hash, and the production storage pull zone had "Token IP validation" on. The
admin supplied that IP in two different ways:

- **Open and player** (`app/api/{files,videos}/[id]/{open,player}`) signed the left-most
  `x-forwarded-for` — the address the Next server saw — and answered with a 307 to `*.b-cdn.net`.
- **The two download routes** signed the Next server's own public address, looked up from
  `api.ipify.org` on every request. They fetch the bytes themselves, so the address that signs is
  the address that reads. They were switched to it after the forwarded address broke downloads.

The browser reaches the CDN over a route the signing server never sees. The address Bunny checks
differs whenever any of these holds:

- a VPN splits the tunnel or exits per destination;
- the browser reaches the dual-stack CDN over IPv6 but the admin over IPv4 — Bunny requires the
  signed address and the request to share a family;
- a relay such as iCloud Private Relay sits in between.

Behind a VPN every image the admin opened was a 403, while downloads (fetched by the server) and
video (never bound) kept working. No better source exists: the one address that matches is the one
the browser uses toward Bunny, and no hop we run observes it. A URL returned inside a response — a
folder listing's previews — would have no candidate address at all.

Rejected alternatives:

- **Proxy `open` through the Next server, as the downloads do.** It keeps the binding, but every
  image byte crosses Next and loses the CDN edge. A preview grid would also cost one gRPC call per
  thumbnail against the gateway's 100 calls a minute per user.
- **Bunny's advanced token bound to a /24 (IPv4) or /64 (IPv6).** It absorbs address rotation
  inside a network, but not a split tunnel or a switch of family.
- **A second pull zone without validation, for the admin alone.** Two hostnames and two keys for
  one set of objects, and any other client would inherit the same failure.

## Decision

- **No read signer takes an address.** `StorageFileService.getFileSignedUrl(providerId)` signs
  `md5(BUNNY_STORAGE_CDN_PRIVATE_KEY + path + expires)` in every environment; the
  `isDevelopment` branch is gone. `getPlayerUrl` and `getDownloadUrl` lose the `ip` parameter they
  never read.
- **The contract drops it.**
  - Field 3 (`ip`) of `GetUrlMap` / `GetUrlMapShort` is reserved.
  - The gateway's `GetUrlMapDto` no longer carries an `@IsIP()` field.
  - The admin's `getRequestIp` and `getServerPublicIp` are deleted, and with them the ipify call.
- **"Token IP validation" stays off** on every storage and Stream pull zone
  (`backend/apps/storage/README.md`).
- **The lifetime is the only bound:** `BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES` and
  `BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES`.

## Consequences

- **A read URL is a bearer credential.** Whoever holds it can fetch the object, from anywhere, until
  it expires. Obtaining one still takes an authenticated call — the admin audience, or the owner's
  own `userId` on the web audience — so the exposure is a URL leaked within its lifetime. The TTL
  variables are the knob.
- **Images and files now behave like video,** which never had the binding.
- **The switch has an outage by construction.** A zone that validates rejects tokens without an
  address, and a zone that does not rejects tokens with one. So the code ships first and the toggle
  goes off right after; storage reads answer 403 in between.
- **The download routes still proxy the bytes,** for `Content-Disposition: attachment` with the file
  name and for range requests. They no longer look up their own address, which removes an external
  call per download and the 404 that followed whenever ipify failed.
- **URLs can be signed where no client address is known,** such as inside a listing response.
- **The gateway still reads the client address, for another purpose:** login and refresh are
  throttled by it (`x-client-ip`, set from `getHeadersIp`). That is unrelated to signing.
