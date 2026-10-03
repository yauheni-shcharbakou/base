<h1 align="center">base</h1>

<p align="center">
  Personal-website monorepo — hexagonal <strong>NestJS gRPC microservices</strong> and a
  <strong>Next.js / Refine admin panel</strong>, wired together by custom
  <strong>Protobuf</strong> and <strong>event-bus</strong> codegen pipelines.
</p>

<p align="center">
  <a href="https://github.com/yauheni-shcharbakou/base/actions/workflows/main.yaml"><img alt="Main" src="https://github.com/yauheni-shcharbakou/base/actions/workflows/main.yaml/badge.svg?branch=main"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D22.22-339933?logo=node.js&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11.9.0-F69220?logo=pnpm&logoColor=white">
  <img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-2.10-EF4444?logo=turborepo&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
</p>

<p align="center">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white">
  <img alt="Refine" src="https://img.shields.io/badge/Refine-1A1A2E?logo=refine&logoColor=white">
  <img alt="MUI" src="https://img.shields.io/badge/MUI-007FFF?logo=mui&logoColor=white">
  <img alt="gRPC" src="https://img.shields.io/badge/gRPC-244C5A?logo=trpc&logoColor=white">
  <img alt="Protobuf" src="https://img.shields.io/badge/Protobuf-1A73E8?logo=protocolsbuffers&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis_%2B_BullMQ-FF4438?logo=redis&logoColor=white">
  <img alt="MikroORM" src="https://img.shields.io/badge/MikroORM-153E5C">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white">
  <img alt="Bunny" src="https://img.shields.io/badge/Bunny_Storage_%2B_Stream-FF7A00">
</p>

### Architecture at a glance

The `.proto` contracts and the `EventBusStrategy` interface are the two sources of truth.
Custom compilers fan them out into typed gRPC clients/controllers and a typed event bus,
so every cross-service call and every event is statically checked end-to-end.

**Codegen pipelines** — one contract, many generated targets:

```mermaid
flowchart LR
  subgraph Contracts["Single source of truth"]
    P["packages/proto/pkg/*.proto"]
    E["EventBusStrategy interface"]
  end

  P -->|pnpm compile:proto| PC{{proto compiler}}
  PC --> BP["@backend/proto<br/>(Nest*, Grpc*Transport)"]
  PC --> FP["@frontend/proto<br/>(Client*, Grpc*Repository)"]
  PC --> PKP["@packages/proto<br/>(browser-safe types)"]

  E -->|pnpm compile:event-bus| EC{{event-bus compiler}}
  EC --> EB["@backend/event-bus<br/>(abstract buses)"]
  EC --> RA["@backend/event-bus-redis<br/>(Redis*Transport — live)"]
  EC --> NA["@backend/event-bus-nats<br/>(Nats*Transport — dormant)"]
```

**Runtime topology** — gRPC for request/response, Redis/BullMQ for domain events, media bytes
straight to the provider:

```mermaid
flowchart LR
  Browser(["Browser"])
  Bunny(["Bunny<br/>Storage + Stream"])

  Browser -->|"HTTP / server actions"| Admin["frontend.admin<br/>Next.js + Refine"]
  Browser -->|"uploads: pre-signed S3 PUT / TUS"| Bunny
  Admin -->|gRPC| GW["backend.api-gateway<br/>gRPC edge"]

  GW -->|gRPC| Auth["backend.auth"]
  GW -->|gRPC| Storage["backend.storage"]
  Storage -.->|"gRPC: weekly sweep"| Auth
  Bunny -->|"HTTP webhook: video status"| Storage

  Auth -->|"emit auth.user.* · identity cache"| Redis[("Redis<br/>BullMQ + cache")]
  Storage -->|"emit storage.file.* / storage.video.*"| Redis
  Redis -->|"one queue per subscriber"| Storage
  GW -.->|"rate-limit counters"| Redis

  Auth --- PG[("PostgreSQL<br/>MikroORM")]
  Storage --- PG
```

- **api-gateway** is the edge: the admin panel's Next server is its one gRPC client, and it proxies every call to the internal services. It holds no database and no event bus — it verifies access tokens, rate-limits per user (counters in Redis), and serves Swagger UI over HTTP.
- **auth** is the reference hexagonal service (`domain` → `application` → `infrastructure` → `interface`); **storage** follows the same shape and consumes auth events over the event bus.
- **Media bytes never cross the backend.** A create call returns pre-signed credentials, and the browser uploads straight to Bunny — files and images over an S3 PUT confirmed by a `completeUpload` call, video over TUS confirmed by Bunny's status webhook. That webhook is the backend's only public HTTP route, and it lands on **storage**.
- An event queue is fanned out by a mediator into one queue per subscriber (`auth.user.create@storage.storage-object`), so several consumers can take the same event despite BullMQ being a work queue.
- Delivery is at-least-once (`attempts: 10`, exponential backoff) — event subscribers are idempotent.
- The bus is broker-agnostic: the same `EventBusStrategy` also generates a NATS JetStream adapter (`@backend/event-bus-nats`), currently dormant. It scopes subscriptions by consumer id the same way, but needs no mediator — JetStream fans an event out to one durable consumer per subscriber on its own.

### Documentation

- [`docs/adr/`](docs/adr/README.md) — architecture decision records: why each structural choice was made.
- [`docs/env.md`](docs/env.md) — every environment variable, generated from the zod schemas that validate it.
- [`CHANGELOG.md`](CHANGELOG.md) — what changed in each release, with upgrade notes.
- [`backend/apps/storage/README.md`](backend/apps/storage/README.md) — Bunny Storage / Stream dashboard setup and the storage-zone move runbook.
- [`.railway/README.md`](.railway/README.md) — the Railway project as code, and how a merge into `main` applies it.
- `CLAUDE.md` files (root, `backend/`, every app and package) — the conventions and internals of each part.

### Requirements

- Node.js 22.22.0+
- pnpm 11.9.0
- Installed `protobuf` compiler (for development and gRPC compiler only)
- Installed `docker` and `docker compose` (optional)

### Current tech stack

> Project
>
> - Turborepo + pnpm workspaces (shared versions in a pnpm catalog)
> - TypeScript
> - Protobuf / gRPC (custom codegen)
> - Jest, plus `node:test` for the database specs

> Admin panel
>
> - Next.js
> - Refine
> - Material UI
> - pdf.js, tus-js-client

> Backend
>
> - Nest.js
> - gRPC microservices (hexagonal / use-case architecture)
> - MikroORM + PostgreSQL
> - Redis + BullMQ (typed event bus, custom codegen; NATS JetStream adapter kept as an alternative)
> - Redis cache (identity reads, rate-limit counters)
> - Bunny Storage (S3 API) + Bunny Stream; sharp and pdf.js for previews

### Project structure

```shell
backend/ # directory for backend stuff
  apps/
    ...backend services (backend.*)
  packages/
    ...backend packages (@backend/*)
frontend/ # directory for frontend stuff
  apps/
    ...frontend services (frontend.*)
  packages/
    ...frontend packages (@frontend/*)
packages/ # directory for common shared packages
  ...common packages (@packages/*)
docs/
  adr/ # architecture decision records
  env.md # generated environment variable tables
scripts/ # repo-level checks run by CI
turbo/
  generators/ # directory with custom code generators
.github/
  workflows/ # CI
```

### Environment variables

Environment variables should be placed in service-specific `.env` files:

```shell
.env # env file for docker-compose.yml
backend/
  apps/<backend service name>/.env
frontend/
  apps/<frontend service name>/.env
```

You can check examples of env variables in service-specific `.env.example` files. The type,
default and requiredness of every variable, per service and per package, are in
[`docs/env.md`](docs/env.md) — generated from the schemas, so it cannot drift from the code.

#### JWT keys

Access tokens are signed with **RS256**: `backend.auth` holds the private key and issues them, `backend.api-gateway` holds only the public key and verifies them locally (this is what lets the gRPC stream guard stay synchronous). Refresh tokens stay HS256 and are verified by `backend.auth` alone; each one is valid only while its session row exists, and is replaced on every refresh.

Generate the pair and copy the two lines into your `.env` files:

```shell
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-access.key && openssl rsa -in jwt-access.key -pubout -out jwt-access.key.pub && echo "JWT_ACCESS_PRIVATE_KEY_BASE64=$(base64 -i jwt-access.key | tr -d '\n')" && echo "JWT_ACCESS_PUBLIC_KEY_BASE64=$(base64 -i jwt-access.key.pub | tr -d '\n')"
```

The keys are base64-encoded on purpose: a multi-line PEM does not survive `.env` files, docker-compose inline variables, or Railway.

- `backend/apps/auth/.env` — both variables
- `backend/apps/api-gateway/.env` — `JWT_ACCESS_PUBLIC_KEY_BASE64` only
- root `.env` — both (docker-compose forwards them)

On **Railway**, set them per service before redeploying (`validateEnv` fails fast on startup otherwise): the private key on the `backend-auth` service, the public key on both `backend-auth` and `backend-api-gateway` (Railway services are named with hyphens, not the packages' dots). Declaring the public key as a project-level shared variable and referencing it via `${{shared.JWT_ACCESS_PUBLIC_KEY_BASE64}}` keeps the two services from drifting apart. Rotating the pair invalidates every issued access token — clients recover through the refresh flow.

#### Redis on Railway

The managed **Redis** database is declared in `.railway/railway.ts`, and all three backend services
point at it with a reference variable — `REDIS_URL: Redis.env.REDIS_URL` on `backend.auth` and
`backend.storage` (event bus; auth also caches in it) and on `backend.api-gateway` (rate-limit
counters). It is the *private* URL: the public one goes through a TCP proxy, which costs egress on
every blocking command a BullMQ worker issues.

Railway's private network (`*.railway.internal`) is IPv6-only in environments created before
2025-10-16, while ioredis looks up an A record by default and fails with `ENOTFOUND`. The adapter
therefore defaults to dual-stack lookups (`REDIS_IP_FAMILY=0`); set it to `6` if reconnects turn out
flaky. Also keep the instance on `maxmemory-policy noeviction` — with eviction enabled Redis may drop
a queue key and lose jobs. A cache that should evict under memory pressure gets an instance of its
own through `CACHE_REDIS_URL`.

#### Bunny

`backend.storage` needs a Bunny Storage zone created with S3 compatibility, a Bunny Stream library,
and a public URL for the Stream status webhook. The dashboard settings and which value goes into
which variable are in [`backend/apps/storage/README.md`](backend/apps/storage/README.md). For local
development `pnpm docker:local` opens an ngrok tunnel to the webhook listener once `NGROK_AUTHTOKEN`
and `NGROK_DOMAIN` are set in the root `.env`.

### Usage

```shell
git clone git@github.com:yauheni-shcharbakou/base.git
cd base
pnpm install
```

##### Commands for run in development mode

```shell
pnpm dev
pnpm dev:backend # only backend stuff
pnpm dev:frontend # only frontend stuff
```

##### Commands for packages compilation

```shell
pnpm compile
pnpm compile:proto # run proto compiler
pnpm compile:event-bus # run event-bus compiler
pnpm compile:env-docs # regenerate the tables in docs/env.md
```

##### Commands for build

```shell
pnpm build
pnpm build:backend # only backend stuff
pnpm build:frontend # only frontend stuff
pnpm build:proto # only proto compiler packages
```

##### Commands for run in production mode

```shell
pnpm prod
pnpm prod:backend # only backend stuff
```

##### Commands for migrations

```shell
pnpm migrate # apply pending migrations in every service with a database
pnpm migrate:backend.auth # only one service (also :backend.storage)
pnpm migrate:check # fail while entities and the migration snapshot disagree (no database needed)
```

Creating a migration runs inside a service directory: `pnpm migrate:create`.

##### Commands for tests

```shell
pnpm test # unit suites
pnpm test:e2e # e2e suites; each skips itself when its server is unreachable
pnpm e2e # start the e2e servers, run every e2e suite with no skip allowed, stop them
```

##### Commands for checks

```shell
pnpm typecheck # tsc --noEmit in every workspace
pnpm lint # eslint --fix
pnpm check:docs # docs layout: links, ADR index, workspace names, the changelog entry of the root version
pnpm check:scripts # specs of the repo-level scripts
pnpm check:env-docs # docs/env.md still matches the zod schemas
pnpm check:railway # tsc over .railway/railway.ts, which is no workspace
```

CI (`.github/workflows/check.yaml`) runs all of the above, the build and the tests on every pull
request into `main`; a branch merges only once it is up to date with `main` and green. The push the
merge makes runs `.github/workflows/main.yaml`, which checks nothing again: it builds to warm the
cache, applies `.railway/railway.ts` to the Railway project (see
[`.railway/README.md`](.railway/README.md)) and, when the merge raised the root `version`, tags the
merged commit `v<version>` and publishes a GitHub Release from that version's `CHANGELOG.md` entry.
A pull request gets a read-only Railway plan in its run summary.

##### Commands for run in docker

```shell
pnpm docker # start all services (production mode)
pnpm docker:local # start Postgres, Redis and the ngrok tunnel (local development mode)
pnpm docker:local:d # the same, detached
pnpm docker:db # start only Postgres and Redis, detached
pnpm docker:db:stop # stop them
pnpm docker:e2e # start every server the e2e suites need (Postgres, Redis, NATS), detached
pnpm docker:e2e:stop # stop them
```

##### Commands for reset build caches:

```shell
pnpm reset
pnpm reset:backend # only backend services
pnpm reset:frontend # only frontend services
```

##### Commands for reset node_modules:

```shell
pnpm reset:modules
```

##### For format project with prettier run:

```shell
pnpm format
```

### Code generation

For generate new package run:

```shell
pnpm gen:package
```

### Security audit

For check deps vulnerabilities run:

```shell
pnpm audit
```
