# CLAUDE.md — @backend/grpc

Guidance for working inside `backend/packages/grpc`. How services use gRPC (bootstrap, `@GrpcController`, `GrpcRxPipe`, `@InjectGrpcService`) is in the root `CLAUDE.md` — this file covers the package internals.

## What this is

The hand-written infrastructure that wraps all NestJS gRPC transport: server options, outbound client DI, controller decorators, exception mapping, and rxjs pipes. Layered `infrastructure/` + `interface/`, barrel-exported from `src/index.ts`.

## Module (`grpc.module.ts`)

- `GrpcModule.forRoot({ host?, appClientStrategy? })` — when `host` is set, provides `GRPC_MICROSERVICE_OPTIONS` (the server config for *this* service, consumed in `main.ts`). `appClientStrategy` registers outbound clients. Global module.
- `GrpcModule.forFeature({ strategy })` — registers outbound gRPC clients for a feature module.
- A `GrpcStrategy` is `{ <host>: ServiceName[] }`. A module-level `GrpcClientRegistry` (global singleton) accumulates strategies, then wires `ClientsModule` providers + per-service DI tokens.

## Topology config (`infrastructure/configs/grpc.config.ts`)

`grpcConfig()` is the **single source of truth for the gRPC topology**: the three hosts (`apiGateway`, `auth`, `storage`), each host's URL (from env `API_GATEWAY_GRPC_URL` / `AUTH_GRPC_URL` / `STORAGE_GRPC_URL`), and which services it serves (keyed by `Grpc<X>Transport.service` → `.definition` from `@backend/proto`). Adding a service or host = edit here + add the env var. `GrpcConfigHost` / `GrpcConfigService` types derive from it.

## Runtime .proto

The gRPC loader reads the original `.proto` files at runtime from `PROTO_PATH = <cwd>/node_modules/@packages/proto/pkg` (loader opts `keepCase`, `enums: String`). So `@packages/proto/pkg` is a runtime dependency, not just a codegen source.

## Building blocks (`interface/`)

- Decorators: `@GrpcController()` (= `Controller` + `GrpcExceptionFilter`), `@ValidateGrpcPayload(Dto)`, `@InjectGrpcService(name)`, `@InjectGrpcClient(name)`.
- `GrpcRxPipe`: `rpcException`, `proxy(mapper?)`, `unwrapEither`, `toArrayItems`, `toMapEntries`.
- Exception path: `GrpcExceptionFilter` → `GrpcExceptionMapper` (Error → RpcException) + `GrpcStatusCodeMapper` / `GrpcMetadataMapper`.

## Commands

```bash
pnpm build            # tsdown → dist (cjs + d.ts)
pnpm dev              # tsdown --watch
pnpm lint             # eslint --fix
pnpm format / reset
```

## Gotchas

- `grpcConfig` is the one place that maps host → URL → services; keep it and the `*_GRPC_URL` env vars in sync.
- `lodash` is used (`grpc.module`, `client-registry`) but not declared in deps — resolves via workspace hoist (fragile).
- Output is cjs-only; consumers resolve `dist/`, so rebuild after changes (turbo `^build` handles downstream).
