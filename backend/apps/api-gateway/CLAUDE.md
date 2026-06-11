# CLAUDE.md — backend.api-gateway

Guidance for working inside `backend/apps/api-gateway`. General architecture is in the root `CLAUDE.md` (which also flags this service as mid-migration). The likely target style is `backend.auth` + the `grpc-access` module here — direction, not finalized; the broken parts below will be fixed later.

## ⚠️ Status: active, incomplete refactor — currently does NOT build

This service is mid-migration to the use-case layout and is in a broken intermediate state. Expect compile errors; **finishing the migration is the work**, not a reason to revert. Known breakage:
- `main.ts` imports `GRPC_MICROSERVICE_OPTIONS` from `@backend/transport` — that package no longer exists (it's `@backend/grpc`).
- `app.module.ts` lists `StorageModule` in `imports` with no import statement; `UserModule`/`TempCodeModule` are stubs and not wired in.
- The old `modules/auth/web/`, `modules/auth/rpc/`, `modules/storage/rpc/` import deleted symbols (`@backend/transport`, `GrpcProxyModule`, `GrpcAuthService.name`, `common/decorators/method.decorator`).

Do not copy this service as a pattern until it builds again.

## What it is (target)

The edge service: the only HTTP-facing backend. `main.ts` serves REST + Swagger UI at `/`, applies a global `ValidationPipe`, and **also** runs as a gRPC server (`GrpcModule.forRoot({ host: 'apiGateway' })` — the admin frontend calls it over gRPC). `ThrottlerModule` rate-limits (100 / 60s). It owns no database; it proxies inbound calls to the internal `auth` / `storage` gRPC services.

## Three coexisting generations

- **Old (broken)** — `modules/*/web/`, `modules/*/rpc/controllers/`: `@backend/transport`, `GrpcXService.name`. Being deleted.
- **Target** — `modules/<feature>/interface/grpc/*.controller.ts` (audience-split: admin/web/public) delegating to `application/services/*.proxy.service.ts` (inject a client via `@InjectGrpcService(GrpcXTransport.service)`, call `firstValueFrom(client.m(req).pipe(GrpcRxPipe.rpcException))`). Mirrors `backend.auth` (the likely target — not yet finalized).
- **Stubs** — empty `user.module.ts`, partial `common/` (mix of old `common/dto`, `common/interface/{grpc,http}` and new `common/{application,domain}`).

## grpc-access (clean, target-style)

Global `APP_GUARD` (`GrpcAccessGuard`) + controller/stream `APP_INTERCEPTOR`s + `GrpcAccessService`. Authorizes inbound requests by calling `auth` over gRPC (`{ auth: [Auth, TempCode] }`) — this is where stream requests are authorized via temp-codes.

## Migration checklist (when touching this service)

`@backend/transport` → `@backend/grpc`; `GrpcXService.name` → `GrpcXTransport.service`; move `web/`+`rpc/` controllers into `interface/grpc` + `application/services` proxies; fill the stub modules; wire them into `app.module` and add the missing `StorageModule` import.

## Config / commands

`config.ts` is just `commonConfig()`. Env: `PORT`, `API_GATEWAY_GRPC_URL`, `AUTH_GRPC_URL`, `STORAGE_GRPC_URL`, `NATS_URL`. No database / no migrator.

```bash
pnpm start:dev        # nest start --watch service
pnpm build / lint
```
