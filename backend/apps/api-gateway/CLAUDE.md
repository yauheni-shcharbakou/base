# CLAUDE.md — backend.api-gateway

Guidance for working inside `backend/apps/api-gateway`. The general hexagonal/use-case architecture, the `Either` pattern, and gRPC controllers are in the root `CLAUDE.md`; this file is the service-specific map. Unlike `auth`/`storage`, this service holds **no domain and no persistence** — it is a thin proxy, so its feature modules have only two layers (`interface` → `application`).

## What this service is

The edge service — the only HTTP-facing backend. `main.ts` serves **REST + Swagger UI at `/`** (global `ValidationPipe`, `RpcExceptionFilter` + `HttpExceptionFilter`) and **also runs as a gRPC server** (`GrpcModule.forRoot({ host: 'apiGateway' })` — the admin frontend calls it over gRPC). `ThrottlerModule` rate-limits (100 / 60s). It owns **no database and no NATS** (no `@backend/nats` / `@backend/event-bus` dependency); it only proxies inbound REST/gRPC calls to the internal `auth` / `storage` gRPC services. Bootstrap connects a single microservice — `GRPC_MICROSERVICE_OPTIONS` from `@backend/grpc`.

## Layers (two, by design)

Each `src/modules/<feature>/` has only:

- **interface/grpc/** — audience-split controllers (`*.web.controller.ts`, `*.admin.controller.ts`, `*.public.controller.ts`). Thin: implement the generated `Grpc<X><Audience>ServiceController`, decorate with an access decorator (below) + `Grpc<X><Audience>Transport.ControllerMethods()`, and delegate each method to a proxy service.
- **application/** — `services/*.proxy.service.ts` (the proxy logic) + `dto/*` (validated request DTOs) + optional `mappers/*`.

No `domain/`/`infrastructure/` per module — there are no entities, repositories, or persistence to abstract. Cross-cutting auth lives in the shared `src/common/` (which *does* use the full `application`/`domain`/`interface` split). `eslint.config.mjs` wires `@packages/configs` `layerGuard()` alongside `nestConfig`, same as `auth`/`storage` — keep imports pointed inward.

## Modules (`src/modules/`)

Seven feature modules, each proxying to one downstream host:

- **→ auth**: `auth` (public login / refresh), `user`, `temp-code`.
- **→ storage**: `file`, `image`, `video`, `storage-object`.

Each proxy service injects the downstream client via `@InjectGrpcService(Grpc<X>Transport.service)` and calls `firstValueFrom(client.method(req).pipe(GrpcRxPipe.rpcException))` (from `@backend/grpc`). Request payloads are validated with `@ValidateGrpcPayload(Dto)`; the resolved caller id is read with the `@GrpcUserId()` param decorator.

## Auth / access (`src/common/`)

There is **no `grpc-access` module** — authorization is the global `CommonModule` (`@Global()`) exposing `AccessService`, plus per-controller decorators:

- `AccessService` holds two `MemoryCache`s (`@backend/common`): **unary** (keyed by `access-token`, populated by calling `auth.me`) and **stream** (keyed by a single-use `stream-code` / temp-code).
- Controller decorators (`common/interface/grpc/decorators/grpc.controller.decorator.ts`): `@PublicGrpcController()` (skips auth), `@DefaultGrpcController()` (authenticated — `GrpcAccessUnaryGuard` reads the `access-token` gRPC metadata and caches the user), `@AdminGrpcController()` (additionally requires `UserRole.ADMIN`).
- **Stream methods** use `@GrpcStreamMethod()` → `GrpcAccessStreamGuard`, which validates a one-time `stream-code`. That code is cached by `AccessService.saveStreamCode` when an admin creates a temp-code (`TempCodeProxyService.createOne`), and is deactivated on first use.

## Config / commands

`config.ts` is just `commonConfig()`. Env: `PORT`, `API_GATEWAY_GRPC_URL`, `AUTH_GRPC_URL`, `STORAGE_GRPC_URL` (the three `*_GRPC_URL` drive the `@backend/grpc` topology). No DB, no migrator; the `NATS_URL` still present in `.env.example` is vestigial (this service uses no event bus).

```bash
pnpm start:dev        # dotenv → nest start --watch service
pnpm build            # nest build
pnpm lint
```

## Gotchas

- Proxy-only: the absence of `domain/`/`infrastructure/` layers per module is intentional — don't add them. A new endpoint = a method on a controller (`interface/grpc`) + a method on the proxy service (`application/services`).
- `video`'s create DTOs reuse `file`'s `FileCreateDto` (a video always creates a companion file) — an accepted cross-module coupling within the application layer.
