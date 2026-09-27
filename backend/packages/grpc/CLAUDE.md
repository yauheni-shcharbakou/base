# CLAUDE.md — @backend/grpc

Guidance for working inside `backend/packages/grpc`. How services use gRPC (bootstrap, `@GrpcController`, `GrpcRxPipe`, `@InjectGrpcService`) is in the root `CLAUDE.md` — this file covers the package internals.

## What this is

The hand-written infrastructure that wraps all NestJS gRPC transport: server options, outbound client DI, controller decorators, exception mapping, and rxjs pipes. Layered `infrastructure/` + `interface/`, barrel-exported from `src/index.ts`.

## Module (`grpc.module.ts`)

- `GrpcModule.forRoot({ host?, appClientStrategy? })` — when `host` is set, provides `GRPC_MICROSERVICE_OPTIONS` (the server config for *this* service, consumed in `main.ts`). `appClientStrategy` registers outbound clients. Global module.
- `GrpcModule.forFeature({ strategy })` — registers outbound gRPC clients for a feature module.
- A `GrpcStrategy` is `{ <host>: ServiceName[] }`. A module-level `GrpcClientRegistry` (global singleton) accumulates strategies, then wires `ClientsModule` providers + per-service DI tokens.

## Topology config (`infrastructure/configs/grpc.config.ts`)

`grpcConfig()` is the **single source of truth for the gRPC topology**: the three hosts (`apiGateway`, `auth`, `storage`), each host's URL (from env `API_GATEWAY_GRPC_URL` / `AUTH_GRPC_URL` / `STORAGE_GRPC_URL`, tabulated in [docs/env.md](../../../docs/env.md)), and which services it serves (keyed by `Grpc<X>Transport.service` → `.definition` from `@backend/proto`). Adding a service or host = edit here + add the env var. `GrpcConfigHost` / `GrpcConfigService` types derive from it.

## Runtime .proto

The gRPC loader reads the original `.proto` files at runtime from `PROTO_PATH = <cwd>/node_modules/@packages/proto/pkg` (loader opts `keepCase`, `enums: String`). So `@packages/proto/pkg` is a runtime dependency, not just a codegen source.

## Building blocks (`interface/`)

- Decorators: `@GrpcController()` (= `Controller` + `GrpcExceptionFilter`), `@ValidateGrpcPayload(Dto)`, `@InjectGrpcService(name)`, `@InjectGrpcClient(name)`.
- `GrpcRxPipe`: `rpcException`, `proxy(mapper?)`, `unwrapEither`, `toArrayItems`, `toMapEntries`.
- Exception path: `GrpcExceptionFilter` → `GrpcExceptionMapper` (Error → RpcException) + `GrpcStatusCodeMapper`.
  - A grpc-js `ServiceError` from a downstream call passes through with its own `code` and `details`. Only an error with no status becomes `UNKNOWN`.
  - `GrpcStatusCodeMapper` holds **two tables**. gRPC → HTTP is the canonical mapping, `HTTP_STATUS_BY_GRPC_STATUS` from `@packages/common` — the same table the admin's `GrpcErrorMapper` reads. HTTP → gRPC is its own table: the general code where the canonical one pairs a status with several (400 → `INVALID_ARGUMENT`, 500 → `INTERNAL`), 409 → `ALREADY_EXISTS` (a `ConflictException` here is a unique violation), and the statuses Nest has an exception for, paired by meaning (410, 412, 422, 502, 504, …). A status missing from it goes out as `INTERNAL`.
  - Never derive one table from the other: several codes share an HTTP status (`UNKNOWN`, `INTERNAL` and `DATA_LOSS` are all 500), so an inversion lets the later one win. `grpc.status-code.mapper.spec.ts` pins both tables and round-trips every code, listing the five that may not come back (`UNKNOWN`, `FAILED_PRECONDITION`, `ABORTED`, `OUT_OF_RANGE`, `DATA_LOSS`).

  > **Why the callee's status is kept:** [docs/adr/0020-server-action-failures-as-values.md](../../../docs/adr/0020-server-action-failures-as-values.md)

## Commands

```bash
pnpm build            # tsdown → dist (cjs + d.ts)
pnpm dev              # tsdown --watch
pnpm test             # jest: the exception and status-code mappers
pnpm lint             # eslint --fix
pnpm format / reset
```

## Gotchas

- `grpcConfig` is the one place that maps host → URL → services; keep it and the `*_GRPC_URL` env vars in sync.
- `lodash` is used (`grpc.module`, `client-registry`) and is declared in this package's deps, with `@types/lodash` in devDeps.
