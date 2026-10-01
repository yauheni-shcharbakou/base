# Environment variables

Every table below is generated from the `validateEnv` argument named in its marker — the zod schema
is the owner of a variable's type, default and whether it is required, and this page is a
projection of it. Run `pnpm compile:env-docs` after changing a schema; `pnpm check:env-docs` fails
when the two have drifted apart.

Kept out of the `CLAUDE.md` files on purpose. Those are loaded into every session touching their
directory, and a deployment checklist is not something you reason about while editing code — it is
looked up, which is what this page is for. The rule is the same one `docs/adr/` follows.

**Reading the tables**

- **required** — the process throws `Env validation failed` at import time when the variable is
  unset. There is no partial start-up.
- `—` — optional with no default; the config reads `undefined`.
- A default is applied only when the variable is **absent**. An empty string is a value, and for a
  coerced number it is a validation error.
- Every value arrives as a string, so a numeric or boolean schema must go through `zod.coerce`.
  `pnpm check:env-docs` rejects one that does not.

**What a service needs** is its own section plus the sections of the packages it wires. That map is
read off the workspace manifests, not maintained here:

<!-- env-services:start -->

| Service               | Packages                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `backend.api-gateway` | `@backend/cache`, `@backend/common`, `@backend/grpc`                                            |
| `backend.auth`        | `@backend/cache`, `@backend/common`, `@backend/event-bus-redis`, `@backend/grpc`, `@backend/pg` |
| `backend.storage`     | `@backend/common`, `@backend/event-bus-redis`, `@backend/grpc`, `@backend/pg`                   |
| `frontend.admin`      | —                                                                                               |

`@backend/event-bus-nats` and `@backend/mongo` declare environment no service wires.

<!-- env-services:end -->

---

## Shared shapes — `@packages/common`

Spread into other packages' `validateEnv` calls rather than redeclared, so a variable that several
packages validate is still written down once.

### `NodeValidationSchema`

<!-- env-table:start src=packages/common/src/validation/common.validation.ts#NodeValidationSchema -->

| Variable   | Type                                    | Default |
| ---------- | --------------------------------------- | ------- |
| `PORT`     | number                                  | —       |
| `NODE_ENV` | `development` \| `production` \| `test` | —       |

<!-- env-table:end -->

`NODE_ENV` accepts `test` only so a jest spec that transitively imports a config module does not die
at import time; consumers compare it against `development` / `production` alone. `PORT` falls back
to `10000` in `commonConfig()` rather than in the schema.

### `DatabaseValidationSchema`

<!-- env-table:start src=packages/common/src/validation/common.validation.ts#DatabaseValidationSchema -->

| Variable       | Type   | Default      |
| -------------- | ------ | ------------ |
| `DATABASE_URL` | string | **required** |

<!-- env-table:end -->

`DATABASE_URL` names a Postgres URL for `@backend/pg` and a Mongo URL for `@backend/mongo` — one
more reason the two adapters are never wired at once.

---

## Packages

### `@backend/common`

<!-- env-table:start src=backend/packages/common/src/common/infrastructure/configs/common.config.ts -->

Nothing of its own — the shared shape `NodeValidationSchema` from `@packages/common`, tabulated under *Shared shapes*.

<!-- env-table:end -->

### `@backend/pg`

<!-- env-table:start src=backend/packages/pg/src/core/infrastructure/configs/pg.config.ts -->

Nothing of its own — the shared shapes `NodeValidationSchema` and `DatabaseValidationSchema` from `@packages/common`, tabulated under *Shared shapes*.

<!-- env-table:end -->

`NODE_ENV` decides one thing here: outside `production` the MikroORM config also gets `pathTs`, so
the CLI can run a migration from source.

### `@backend/mongo`

<!-- env-table:start src=backend/packages/mongo/src/core/infrastructure/configs/mongo.config.ts -->

Nothing of its own — the shared shape `DatabaseValidationSchema` from `@packages/common`, tabulated under *Shared shapes*.

<!-- env-table:end -->

Read with a `mongodb://localhost:27017` fallback at the call site, so the package tolerates an unset
`DATABASE_URL` where `@backend/pg` does not.

### `@backend/grpc`

<!-- env-table:start src=backend/packages/grpc/src/infrastructure/configs/grpc.config.ts -->

| Variable               | Type   | Default        |
| ---------------------- | ------ | -------------- |
| `API_GATEWAY_GRPC_URL` | string | `0.0.0.0:8000` |
| `AUTH_GRPC_URL`        | string | `0.0.0.0:8001` |
| `STORAGE_GRPC_URL`     | string | `0.0.0.0:8002` |

<!-- env-table:end -->

All three are validated in every process that imports the package, whichever host it is — the
topology map is built whole. A service only ever dials the URLs it has a client for. Adding a host
means editing `grpcConfig` **and** adding the variable.

### `@backend/event-bus-redis`

<!-- env-table:start src=backend/packages/event-bus-redis/src/infrastructure/configs/redis.config.ts -->

| Variable                    | Type                        | Default                  |
| --------------------------- | --------------------------- | ------------------------ |
| `REDIS_URL`                 | string                      | `redis://localhost:6379` |
| `REDIS_QUEUE_PREFIX`        | string                      | `bull`                   |
| `REDIS_WORKER_CONCURRENCY`  | integer > 0                 | `1`                      |
| `REDIS_JOB_ATTEMPTS`        | integer > 0                 | `10`                     |
| `REDIS_JOB_BACKOFF_DELAY`   | integer > 0                 | `1000`                   |
| `REDIS_EVENT_BUS_NAMESPACE` | string                      | `event-bus`              |
| `REDIS_READY_TIMEOUT`       | integer > 0                 | `10000`                  |
| `REDIS_COMMAND_TIMEOUT`     | integer > 0                 | `5000`                   |
| `REDIS_PARKING_MAX_LENGTH`  | integer ≥ 0                 | `1000`                   |
| `REDIS_PARKING_TTL`         | integer > 0                 | `86400`                  |
| `REDIS_IP_FAMILY`           | integer (must be 0, 4 or 6) | `0`                      |

<!-- env-table:end -->

The parking bounds mirror the job retention (`count` of `removeOnComplete`, `age` of
`removeOnFail`); `REDIS_PARKING_MAX_LENGTH=0` disables parking altogether.

`REDIS_READY_TIMEOUT` and `REDIS_COMMAND_TIMEOUT` are the two deadlines that keep an unreachable
broker from turning into a hang rather than a failure — this connection runs with
`maxRetriesPerRequest: null`, so nothing on it rejects on its own. The first bounds the boot
(a service that cannot reach Redis logs and exits 1); the second bounds an emit, so a gRPC call
awaiting an event fails instead of waiting forever. Raise the ready timeout where the broker starts
alongside the service and takes longer than ten seconds to accept connections
([ADR-0013](adr/0013-event-bus-fails-loud.md)).

`REDIS_IP_FAMILY` is the ioredis `family` option — `0` dual stack, `4` IPv4, `6` IPv6. It defaults to
dual stack because managed private networks are often IPv6-only (Railway's `*.railway.internal`),
where ioredis' default A-record lookup fails with `ENOTFOUND`. Force `6` if reconnects turn out
flaky on such a network.

The e2e suite pins `REDIS_QUEUE_PREFIX=bull-e2e`, `REDIS_EVENT_BUS_NAMESPACE=event-bus-e2e` and a
short retry ladder from a jest `globalSetup` — the config validates env at module load, so an
override set any later would be read by nobody.

### `@backend/event-bus-nats`

<!-- env-table:start src=backend/packages/event-bus-nats/src/infrastructure/configs/nats.config.ts -->

| Variable                    | Type           | Default                 |
| --------------------------- | -------------- | ----------------------- |
| `NATS_URL`                  | string         | `nats://localhost:4222` |
| `NATS_ACK_WAIT_MS`          | integer > 0    | `30000`                 |
| `NATS_MAX_DELIVER`          | integer > 0    | `10`                    |
| `NATS_CONSUMER_CONCURRENCY` | integer > 0    | `1`                     |
| `NATS_DELIVER_POLICY`       | `all` \| `new` | `all`                   |

<!-- env-table:end -->

`NATS_DELIVER_POLICY=all` replays a stream from the beginning the first time a durable is created,
so a subscriber added later still sees what it missed; `new` opts out.

### `@backend/cache`

<!-- env-table:start src=backend/packages/cache/src/infrastructure/configs/cache.config.ts -->

| Variable                | Type                        | Default                  |
| ----------------------- | --------------------------- | ------------------------ |
| `REDIS_URL`             | string                      | `redis://localhost:6379` |
| `REDIS_IP_FAMILY`       | integer (must be 0, 4 or 6) | `0`                      |
| `CACHE_REDIS_URL`       | string                      | —                        |
| `CACHE_DRIVER`          | `redis` \| `memory`         | `redis`                  |
| `CACHE_KEY_PREFIX`      | string                      | `cache`                  |
| `CACHE_TTL`             | integer ≥ 0                 | `300`                    |
| `CACHE_COMMAND_TIMEOUT` | integer > 0                 | `1000`                   |

<!-- env-table:end -->

`REDIS_URL` is the same variable `@backend/event-bus-redis` reads, and by design: one Redis is what
docker-compose and the deployments run, and the two subsystems stay apart through disjoint key
prefixes rather than through a second URL nobody remembers to set. `REDIS_IP_FAMILY` is shared for a
stronger reason — the address family belongs to the network, not to a subsystem, so a cache reachable
over a different one than the broker is not a case that exists. `CACHE_REDIS_URL` overrides the URL
for the case that first argument does not survive — a cache instance configured to evict under memory
pressure has no business holding the event bus' durable queues.

`CACHE_DRIVER=memory` swaps in the process-local store: no connection is opened at all, nothing is
shared between replicas, and everything is lost on restart. It is a dev/test convenience, not a
deployment option. `CACHE_TTL=0` stores entries without an expiry unless a call passes its own TTL.

`CACHE_COMMAND_TIMEOUT` is the budget a single lookup gets before it is abandoned as a miss. It is
what keeps fail-soft ([ADR-0010](adr/0010-cache-fails-soft.md)) fast as well as safe: a cache sits
in front of a request, so a slow Redis must cost milliseconds, not the request. Raise it only if
legitimate commands start showing up as errors in `CacheMetrics`.

---

## Services

### `backend.auth`

<!-- env-table:start src=backend/apps/auth/src/config.ts,backend/apps/auth/src/modules/auth/infrastructure/configs/jwt.config.ts,backend/apps/auth/src/modules/crypto/infrastructure/configs/bcrypt.config.ts -->

| Variable                        | Type        | Default      | Source             |
| ------------------------------- | ----------- | ------------ | ------------------ |
| `ADMIN_EMAIL`                   | email       | **required** | `config.ts`        |
| `ADMIN_PASSWORD`                | string      | **required** | `config.ts`        |
| `TEMP_TOKEN_EXPIRES_IN_MINUTES` | number      | `1`          | `config.ts`        |
| `JWT_ACCESS_PRIVATE_KEY_BASE64` | string      | **required** | `jwt.config.ts`    |
| `JWT_ACCESS_PUBLIC_KEY_BASE64`  | string      | **required** | `jwt.config.ts`    |
| `REFRESH_JWT_SECRET`            | string      | **required** | `jwt.config.ts`    |
| `SALT_ROUNDS`                   | integer > 0 | `10`         | `bcrypt.config.ts` |

<!-- env-table:end -->

`JWT_ACCESS_PRIVATE_KEY_BASE64` / `JWT_ACCESS_PUBLIC_KEY_BASE64` hold a base64-encoded RSA PEM pair,
decoded via `decodeBase64Pem` — a multi-line PEM does not survive `.env`, docker-compose or Railway.
The public half must match the one `backend.api-gateway` verifies with. `ADMIN_EMAIL` /
`ADMIN_PASSWORD` seed the first login: on every start, auth creates an admin from them while no user
holds the role, and never touches one that exists.

### `backend.storage`

<!-- env-table:start src=backend/apps/storage/src/config.ts,backend/apps/storage/src/modules/storage/infrastructure/configs/bunny.storage.config.ts -->

| Variable                                        | Type                                                          | Default      | Source                    |
| ----------------------------------------------- | ------------------------------------------------------------- | ------------ | ------------------------- |
| `STORAGE_PENDING_FILE_TTL_HOURS`                | number                                                        | `24`         | `config.ts`               |
| `STORAGE_IMAGE_PREVIEW_SWEEP_LIMIT`             | integer > 0                                                   | `20`         | `config.ts`               |
| `STORAGE_IMAGE_PREVIEW_SWEEP_GRACE_MINUTES`     | integer ≥ 0                                                   | `10`         | `config.ts`               |
| `STORAGE_IMAGE_PREVIEW_SWEEP_BUDGET_MINUTES`    | integer ≥ 0                                                   | `8`          | `config.ts`               |
| `STORAGE_IMAGE_PREVIEW_SWEEP_MAX_ATTEMPTS`      | integer ≥ 0                                                   | `12`         | `config.ts`               |
| `STORAGE_DOCUMENT_PREVIEW_SWEEP_LIMIT`          | integer > 0                                                   | `20`         | `config.ts`               |
| `STORAGE_DOCUMENT_PREVIEW_SWEEP_GRACE_MINUTES`  | integer ≥ 0                                                   | `10`         | `config.ts`               |
| `STORAGE_DOCUMENT_PREVIEW_SWEEP_BUDGET_MINUTES` | integer ≥ 0                                                   | `8`          | `config.ts`               |
| `STORAGE_DOCUMENT_PREVIEW_SWEEP_MAX_ATTEMPTS`   | integer ≥ 0                                                   | `12`         | `config.ts`               |
| `BUNNY_STORAGE_ZONE`                            | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STORAGE_API_KEY`                         | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STORAGE_S3_REGION`                       | `de` \| `ny` \| `uk` \| `se` \| `sg` \| `la` \| `jh` \| `syd` | `de`         | `bunny.storage.config.ts` |
| `BUNNY_STORAGE_UPLOAD_EXPIRES_IN_MINUTES`       | number ≥ 1, ≤ 10_080                                          | `60`         | `bunny.storage.config.ts` |
| `BUNNY_STORAGE_CDN_ZONE`                        | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STORAGE_CDN_PRIVATE_KEY`                 | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES`          | number ≥ 1                                                    | `10`         | `bunny.storage.config.ts` |
| `BUNNY_STREAM_API_KEY`                          | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STREAM_READ_ONLY_API_KEY`                | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STREAM_LIBRARY_ID`                       | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STREAM_CDN_ZONE`                         | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STREAM_CDN_PRIVATE_KEY`                  | string                                                        | **required** | `bunny.storage.config.ts` |
| `BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES`           | number ≥ 1                                                    | `60`         | `bunny.storage.config.ts` |
| `BUNNY_STREAM_TUS_EXPIRES_IN_MINUTES`           | number ≥ 60                                                   | `120`        | `bunny.storage.config.ts` |

<!-- env-table:end -->

Two Bunny products, credentialed separately: **Storage** (files) and **Stream** (video). The CDN
private keys sign time-limited URLs, bound to no client address. A pull zone URL's expiry is rounded
up to a multiple of the matching `*_CDN_EXPIRES_IN_MINUTES`: it lives between one and two of them,
and every URL signed for an object within one window is the same string, so a browser reuses what
it fetched. The Stream embed-player link expires exactly `BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES` after
it is signed.
Storage is written over its S3-compatible API, which Bunny enables only on a zone created with it:
`BUNNY_STORAGE_ZONE` is that zone's name (bucket and access key id), `BUNNY_STORAGE_API_KEY` its
password, and `BUNNY_STORAGE_CDN_ZONE` the pull zone in front of it — a separate name, since the
pull zone outlives a move to a new storage zone.
`AUTH_GRPC_URL` points at auth for one caller: the weekly sweep that drops the data of users auth no
longer holds.

The Stream library issues **two** keys and they are not interchangeable: `BUNNY_STREAM_API_KEY`
writes (creating a video, signing its TUS upload), while `BUNNY_STREAM_READ_ONLY_API_KEY` is what
Bunny signs the status webhook with — the service rejects an unsigned or mis-signed callback.
`BUNNY_STREAM_TUS_EXPIRES_IN_MINUTES` bounds how long a browser may keep uploading against one
signature; Bunny refuses anything under an hour, and a resumed upload is re-signed rather than
extended. `STORAGE_PENDING_FILE_TTL_HOURS` must outlast that window plus Bunny's encoding queue —
a video only leaves `PENDING` once the webhook arrives, so a short TTL deletes uploads in flight.

The eight `STORAGE_*_PREVIEW_SWEEP_*` variables tune the two preview sweeps, images and PDFs apart:
an image is a download of up to 100 MB spooled to the temp directory, a PDF up to 50 MB held in
memory and a render. A sweep starts every 10 minutes and takes its items one after another, a batch
of `*_SWEEP_LIMIT` at a time, for as long as there is a backlog and `*_SWEEP_BUDGET_MINUTES` lasts
([ADR-0037](adr/0037-preview-sweep-drains-within-a-time-budget.md)). The budget is the setting that
matters: it is how much of every 10 minutes the service may spend on a backlog, and 0 is one batch
a sweep. The limit is a batch size, not a pace — the first batch runs whatever the budget and none
is cut short, so it is also how far a sweep runs past its budget. A sweep that outlasts the 10
minutes makes the next tick skip rather than start beside it, but only within one process: every
replica sweeps on its own.
`*_SWEEP_GRACE_MINUTES` is how long an item must have been READY before the sweep takes it, which
leaves the `storage.file.ready` handler its retries: at the default `REDIS_JOB_ATTEMPTS` and
`REDIS_JOB_BACKOFF_DELAY` the ladder ends after about 8.5 minutes. A shorter grace loses nothing —
the preview is recorded only over none — it renders twice what a retry was about to render.
`*_SWEEP_MAX_ATTEMPTS` is how many sweeps may come back from one item without a preview before it
is marked failed and left alone; 0 never gives up. A sweep tries an item once, so the default of 12
is two hours at the least. It cannot tell a broken item from a provider that is down: **an outage
longer than the cap gives up on everything in the backlog**, so raise it or set it to 0 before a
long backfill. What it gave up on is put back with
`update images set preview_failed_at = null, preview_attempts = 0 where preview_attempts >= 12`
(and `files` for PDFs) — an item no retry can help was marked with fewer attempts.

Unlike the other services, `PORT` here is a real HTTP listener: it serves the single route
`POST /webhooks/bunny/stream` and nothing else. Keep it clear of `STORAGE_GRPC_URL`'s port: in
deployment the service's public domain targets `PORT` alone, which is what keeps gRPC private.
Railway offers no finer granularity — a domain exposes one port of one service and cannot route by
path — so Bunny is configured with the full `https://<storage-domain>/webhooks/bunny/stream`, and
anything else added to this listener becomes public with it.

### `backend.api-gateway`

<!-- env-table:start src=backend/apps/api-gateway/src/common/infrastructure/configs/jwt.config.ts -->

| Variable                       | Type   | Default      |
| ------------------------------ | ------ | ------------ |
| `JWT_ACCESS_PUBLIC_KEY_BASE64` | string | **required** |

<!-- env-table:end -->

The **public** half of the auth service's RSA pair: the gateway verifies access tokens locally but
cannot issue them. No database, no migrations, no event-bus variables — it publishes and consumes no
domain events.

### `frontend.admin`

<!-- env-table:start src=frontend/apps/admin/src/common/services/config.service.ts -->

| Variable           | Type   | Default           |
| ------------------ | ------ | ----------------- |
| `BACKEND_GRPC_URL` | string | `0.0.0.0:8000`    |
| `CLIENT_IP_HEADER` | string | `x-real-ip`       |
| `DEFAULT_EMAIL`    | email  | `admin@gmail.com` |
| `DEFAULT_PASSWORD` | string | `string123`       |

Plus the shared shape `NodeValidationSchema` from `@packages/common`, tabulated under *Shared shapes*.

<!-- env-table:end -->

Read by `ConfigService` on the **Next server**, never in the browser — none of them is a
`NEXT_PUBLIC_*`, and `BACKEND_GRPC_URL` must not become one: `@grpc/grpc-js` is a Node client and
the gRPC call runs in a server action. `DEFAULT_EMAIL` / `DEFAULT_PASSWORD` prefill the login form
and are read only while `NODE_ENV` is `development`.

`CLIENT_IP_HEADER` names the header the proxy in front of the admin **overwrites** with the
connecting address — `x-real-ip` on Railway, `cf-connecting-ip` behind Cloudflare. The gateway
limits sign-in attempts per that address, so a header the proxy passes through as the client sent
it lets a caller pick a new address, and a new limit, for every attempt
([ADR-0035](adr/0035-client-address-from-one-trusted-header.md)).
