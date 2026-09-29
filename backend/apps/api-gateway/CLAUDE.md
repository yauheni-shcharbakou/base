# CLAUDE.md — backend.api-gateway

Guidance for working inside `backend/apps/api-gateway`. The general hexagonal/use-case architecture, the `Either` pattern, and gRPC controllers are in the root `CLAUDE.md`; this file is the service-specific map. Unlike `auth`/`storage`, this service holds **no domain and no persistence** — it is a thin proxy, so its feature modules have only two layers (`interface` → `application`).

## What this service is

The edge service — the only HTTP-facing backend. `main.ts` serves **REST + Swagger UI at `/`** (global `ValidationPipe`, `RpcExceptionFilter` + `HttpExceptionFilter`) and **also runs as a gRPC server** (`GrpcModule.forRoot({ host: 'apiGateway' })` — the admin frontend calls it over gRPC). gRPC unary calls are rate-limited (see *Rate limiting* below); HTTP has no controllers, only Swagger UI, and is not limited. It owns **no database and no event bus** (no `@backend/event-bus-redis` / `@backend/event-bus` dependency) — its one Redis use is the rate-limit counters, through `@backend/cache`; it only proxies inbound REST/gRPC calls to the internal `auth` / `storage` gRPC services. Bootstrap connects a single microservice — `GRPC_MICROSERVICE_OPTIONS` from `@backend/grpc`.

## Layers (two, by design)

Each `src/modules/<feature>/` has only:

- **interface/grpc/** — audience-split controllers (`*.web.controller.ts`, `*.admin.controller.ts`, `*.public.controller.ts`). Thin: implement the generated `Grpc<X><Audience>ServiceController`, decorate with an access decorator (below) + `Grpc<X><Audience>Transport.ControllerMethods()`, and delegate each method to a proxy service.
- **application/** — `services/*.proxy.service.ts` (the proxy logic) + `dto/*` (validated request DTOs) + optional `mappers/*`.

No `domain/`/`infrastructure/` per module — there are no entities, repositories, or persistence to abstract. Cross-cutting auth lives in the shared `src/common/` (which *does* use the full `application`/`domain`/`interface` split). `eslint.config.mjs` wires `@packages/configs` `layerGuard()` alongside `nestConfig`, same as `auth`/`storage` — keep imports pointed inward.

## Modules (`src/modules/`)

Seven feature modules, each proxying to one downstream host:

- **→ auth**: `auth` (public login / refresh), `user`, `temp-code`.
- **→ storage**: `file`, `image`, `video`, `storage-object`.

Each proxy service injects the downstream client via `@InjectGrpcService(Grpc<X>Transport.service)` and calls `firstValueFrom(client.method(req).pipe(GrpcRxPipe.rpcException))` (from `@backend/grpc`). Request payloads are validated with `@ValidateGrpcPayload(Dto)`; the resolved caller id is read with the `@GrpcUserId()` param decorator. **A handler that takes `@GrpcUserId()` binds its request with `@Payload()`** (`@nestjs/microservices`), an unused `Empty` included: Nest maps a handler's request, metadata and call only while none of its parameters is decorated, so next to a param decorator an unbound request arrives `undefined` and its `@ValidateGrpcPayload` never runs — silently. `common/interface/grpc/grpc.payload-binding.spec.ts` fails on any handler that decorates a parameter without it.

## Auth / access (`src/common/`)

There is **no `grpc-access` module** — authorization is the global `CommonModule` (`@Global()`) exposing `AccessService`, plus per-controller decorators:

- `AccessService` exposes two checks over the same `access-token` metadata, deliberately implemented differently:
  - `checkUnaryAccess` — **async**, calls `auth.me` over gRPC on every request, so a deleted user or a role change takes effect immediately. This service caches **nothing**: the response is cached inside `backend.auth`, which owns the writes and can evict precisely. Don't add a token-keyed cache here — the gateway has no way to invalidate it.

    > **Why the cache sits in auth and not in this guard:** [docs/adr/0011-identity-cached-in-auth.md](../../../docs/adr/0011-identity-cached-in-auth.md)
  - `checkStreamAccess` — **sync**, verifies the RS256 access token locally via `TokenService` → `JwtTokenServiceImpl` (`common/infrastructure/services`), reading `role` straight from the payload and rejecting anything whose `aud` is not `AuthTokenAudience.ACCESS` (enforced by the jwt `audience` option, so a refresh token cannot be replayed here). It must stay synchronous: an async guard on a client-stream gRPC method defers the handler and the incoming message stream stalls (`bufferUntilDrained` in `@nestjs/microservices` is best-effort). This is why the gateway holds the JWT **public** key (`JWT_ACCESS_PUBLIC_KEY_BASE64`) — it verifies but cannot issue tokens.
- Controller decorators (`common/interface/grpc/decorators/grpc.controller.decorator.ts`): `@PublicGrpcController()` (skips auth), `@DefaultGrpcController()` (authenticated — `GrpcAccessUnaryGuard` reads the `access-token` gRPC metadata), `@AdminGrpcController()` (additionally requires `UserRole.ADMIN`).
- **Stream methods** use `@GrpcStreamMethod()` → `GrpcAccessStreamGuard`, which reads the same `access-token` metadata and calls `checkStreamAccess`. Both guards put the resolved id into the `user-id` metadata for `@GrpcUserId()`.
- The `temp-code` module is now a plain CRUD proxy — it no longer participates in stream authorization.

## Rate limiting (`src/common/`)

`ThrottlerModule` is registered in `CommonModule`, but nothing throttles globally: the stock
`ThrottlerGuard` reads an HTTP request. **`GrpcThrottlerGuard`** (`common/interface/grpc/guards`)
is its gRPC subclass, and the controller decorators apply it as `UseGuards(GrpcAccessUnaryGuard,
GrpcThrottlerGuard)` — a controller built without them is not limited. Limits live in
`common/interface/grpc/constants/grpc.throttle.constants.ts`:

- **Authenticated** (`@DefaultGrpcController()` / `@AdminGrpcController()`): 100 / 60s **per user**,
  keyed by the `user-id` the access guard resolves. That is why the throttler runs *after* it — and
  why a call over the limit has still cost an `auth.me` round trip.
- **Public** (`@PublicGrpcController()`, i.e. login / refresh): 10 / 60s **per client address**, set
  with `@Throttle` in the decorator. A `user-id` a public caller sends is ignored. The address is the
  `x-client-ip` metadata the admin's Next server sets from `x-forwarded-for` / `x-real-ip`
  (`AuthService.getClientMetadata`); without it, the peer host (port dropped). The Next server is
  the only gRPC client, so the peer alone is one bucket for every visitor. `x-client-ip` is trusted
  because the gRPC port is published on the private network only — expose it and that stops holding.
- The count is per caller across **all** handlers, not per handler (`generateKey` override). Stream
  calls are not counted. An exceeded limit is `RESOURCE_EXHAUSTED`.
- **Counters live in Redis**: `CacheModule.forRoot({ namespace: 'api-gateway' })` in `app.module.ts`,
  and `CacheThrottlerStorage` (`common/infrastructure/storages`) as the throttler's `storage`, wired
  by `GRPC_THROTTLER_MODULE_OPTIONS` — keys `cache:api-gateway:throttle:<encoded key>`, a fixed
  window per key. Replicas share one limit and a restart resets nothing. When Redis is unreachable
  the gateway keeps serving and counts in-process instead, so the limit then holds per replica.
  `blockDuration` other than `ttl` is not supported. Redis carries **only** these counters — the
  "caches nothing" rule above still stands.

  > **Why Redis, through `@backend/cache`, with an in-process fallback:** [docs/adr/0024-gateway-rate-limit-counters-in-redis.md](../../../docs/adr/0024-gateway-rate-limit-counters-in-redis.md)

## Config / commands

`config.ts` is just `commonConfig()`; JWT verification has its own `common/infrastructure/configs/jwt.config.ts`, whose `JWT_ACCESS_PUBLIC_KEY_BASE64` is the only env this service owns — it verifies access tokens but cannot issue them. The three `*_GRPC_URL` come from `@backend/grpc`, `REDIS_URL` and the optional `CACHE_*` from `@backend/cache`. No DB, no migrations, no event-bus vars — this service publishes and consumes no domain events. Full list: [docs/env.md](../../../docs/env.md).

```bash
pnpm start:dev        # dotenv → nest start --watch service
pnpm build            # nest build
pnpm lint
```

## Gotchas

- Proxy-only: the absence of `domain/`/`infrastructure/` layers per module is intentional — don't add them. A new endpoint = a method on a controller (`interface/grpc`) + a method on the proxy service (`application/services`).
- `video`'s create DTOs reuse `file`'s `FileCreateDto` (a video always creates a companion file) — an accepted cross-module coupling within the application layer.
