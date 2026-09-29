## Bunny Storage configuration

The storage zone must be created **with S3 compatibility on** (dashboard toggle, or
`bunny` CLI `--s3`) — Bunny cannot enable it on an existing zone. Moving off an older zone is the
runbook [below](#moving-to-a-new-storage-zone).

#### Storage > General

`Name` => env `BUNNY_STORAGE_ZONE` (also the S3 bucket and access key id)

`Main region` => env `BUNNY_STORAGE_S3_REGION` (`de`, `ny`, `uk`, `se`, `sg`, `la`, `jh`, `syd`)

#### Storage > Access > API / HTTP

`Access Key (Password)` => env `BUNNY_STORAGE_API_KEY` (also the S3 secret)

#### CDN > General > Origin

Origin type `Storage zone`, pointing at the zone above. The pull zone's own name =>
env `BUNNY_STORAGE_CDN_ZONE` (served as `https://<name>.b-cdn.net`).

#### CDN > Security > General

- [x] `Block root path access`
- [x] `Block POST requests`

#### CDN > Security > Token authentication

- [x] `Token authentication`
- [ ] `Token IP validation` — keep it off in every environment: the signed URLs carry no address,
  so a zone that validates one rejects them all
  ([ADR-0025](../../../docs/adr/0025-read-urls-bound-to-no-client-address.md))

`Url token authentication Key` => env `BUNNY_STORAGE_CDN_PRIVATE_KEY`

#### CDN > Headers

- [x] `Add CORS headers`

`Extension List`: `eot, ttf, woff, woff2, css, js, jpg, jpeg, png, webp, gif, mp3, mp4, mpeg, svg, webm, pdf`

## Bunny Stream configuration

#### Stream > Encoding

- [x] `Keep original files`
- [x] `MP4 fallback`
- [ ] `Content tagging`

#### Stream > Security > General

- [ ] `Enable direct play`
- [x] `Block direct url file access`
- [x] `Embed view token authentication`
- [x] `CDN token authentication`

`Allowed domains`: set list with `player.mediadelivery.net` and your hosts — the admin's host
included (`localhost` for the dev library): a folder view loads video thumbnails with an `<img>`
from the admin's origin, and a request without an allowed referrer is refused
([ADR-0026](../../../docs/adr/0026-folder-listing-carries-signed-previews.md))

`Token authentication key` => env `BUNNY_STREAM_CDN_PRIVATE_KEY`

#### Stream > API

`Video library ID` => env `BUNNY_STREAM_LIBRARY_ID`

`Pull zone` => env `BUNNY_STREAM_CDN_ZONE`

`API key` => env `BUNNY_STREAM_API_KEY`

`Read-only API key` => env `BUNNY_STREAM_READ_ONLY_API_KEY`

`Webhook URL` => `https://<storage-domain>/webhooks/bunny/stream`

For local development use a separate library whose webhook points at the ngrok static domain:
`https://<NGROK_DOMAIN>/webhooks/bunny/stream`. The tunnel starts with `pnpm docker:local` once
`NGROK_AUTHTOKEN` and `NGROK_DOMAIN` are set in the root `.env`. A library has exactly one webhook
URL, so sharing it with production would divert production's callbacks to your machine.

#### CDN > Security > General (stream-related CDN)

- [x] `Block root path access`
- [x] `Block POST requests`
- [x] `Block direct url file access`

`Allowed referrers`: set list (same as `Allowed domains` in stream)

#### CDN > Security > Token authentication (stream-related CDN)

- [x] `Token authentication`
- [ ] `Token IP validation`

`Url token authentication Key` => env `BUNNY_STREAM_CDN_PRIVATE_KEY`

#### CDN > Headers

- [x] `Add CORS headers`

`Extension List`: `*`

## Moving to a new storage zone

Object keys (`{dev|prod}/{userId}/{uuid}.{ext}`, stored as `files.provider_id`) are copied
verbatim, so the database is not touched — only credentials and the pull zone's origin change.
`scripts/copy-storage-zone.ts` does the copy: it lists the old zone over the HTTP API and writes
into the new one over S3, skipping any key already there with the same size, so it is safe to
re-run. Credentials go in `scripts/.env.migration` (template: `scripts/.env.migration.example`).

**Each environment moves on its own.** `dev` and `prod` each have their own storage zone and pull
zone, so each gets its own new S3 zone and its own pass through the steps below — never one shared
S3 zone, which would let the dev pull zone reach prod objects. Moving `dev` first doubles as the
rehearsal: switching the dev pull zone cannot affect prod.

`scripts/.env.migration` for one environment's pass:

| Variable         | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| `SOURCE_ZONE`    | the old storage zone — the environment's current `BUNNY_STORAGE_CDN_ZONE`¹ |
| `SOURCE_API_KEY` | the old zone's password — the current `BUNNY_STORAGE_API_KEY`              |
| `TARGET_ZONE`    | the new S3 zone's name                                                     |
| `TARGET_API_KEY` | the new zone's password (_FTP & API Access_, not the read-only one)        |
| `TARGET_REGION`  | the new zone's main region; defaults to `de`                               |

¹ Before the move, one variable named both the storage zone and the pull zone. After it,
`BUNNY_STORAGE_CDN_ZONE` keeps its value — it now names only the pull zone.

1. Create the new zone with S3 enabled, in the region you want (optionally with replication).
2. Bulk copy while the old zone is still live, limited to the environment's subtree:
   `pnpm storage:copy-zone --prefix=<env>/ --dry-run` — every key should come back `pending`
   (a credentials problem shows up as `failed`) — then the same without `--dry-run`.
3. In the environment's **existing** pull zone, switch _Origin_ to the new storage zone. Hostname,
   token key, CORS and security settings stay as they are, so signed URLs keep working.
4. Point the service at the new zone — `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY` (the new
   zone's password) and `BUNNY_STORAGE_S3_REGION` — in the local `.env` for `dev`, in a deploy for
   `prod`.
5. Run the same `pnpm storage:copy-zone --prefix=…` again right away — it picks up whatever was
   uploaded to the old zone between step 2 and step 4.
6. The same command with `--verify-only`; it exits non-zero and writes
   `copy-storage-zone.verify.json` if any key is missing or differs in size.
7. Keep the old zone as a backup for a while, then delete it by hand.

Beyond `--prefix`, `--concurrency=<n>` (default 8) bounds parallel transfers — Bunny's S3 API
allows 500 requests per second per zone. A file deleted between steps 2 and 4 stays in the new zone
as an orphan.
