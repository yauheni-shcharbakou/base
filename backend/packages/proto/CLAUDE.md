# CLAUDE.md — @backend/proto

Guidance for working inside `backend/packages/proto`. The contract flow, the three generated flavors, and how Transports/controllers are wired are in the root `CLAUDE.md` *Protobuf codegen pipeline* and *Backend service architecture* sections — read those first. This file covers what is specific to this package.

## What this is

The **fully generated** backend (NestJS) proto package — the Nest-adapter output of the compiler in `packages/proto` (`targetRoot = backend/packages/proto/src`). There is **no `pkg/`, no `compiler/`, no `compile` script here**; this package only builds the generated `src/` into `dist`.

`src/**` is emitted by `protoc-gen-ts_proto` (`DO NOT EDIT`, `/* eslint-disable */`) and wiped/regenerated on every compile. Unlike `@frontend/proto`, the Nest output is fully typed (no `@ts-nocheck`).

## How to (re)generate

Edit `.proto` in `packages/proto/pkg/**`, then from the repo root run `pnpm compile:proto` (or `GRPC_COMPILER_CONTEXT=backend pnpm compile:proto` to skip the frontend adapter). Commit the rewritten `src/`.

## What it exports (`src/index.ts`)

- Message namespaces, `Nest`-prefixed: `NestAuth`, `NestCommon`, `NestStorage`, `NestGoogle`.
- Per-service, per-audience artifacts — for `Grpc<X>` and its `Grpc<X>Admin` / `Grpc<X>Web` / `Grpc<X>Public` variants:
  - `Grpc<X>Transport` — `{ service: '<Name>Service', definition: { package, protoPath }, ControllerMethods() }`. `ControllerMethods()` is the class decorator that tags methods with `@GrpcMethod` (and `@GrpcStreamMethod`). `service` doubles as the DI token for `@InjectGrpcService` in `@backend/grpc`.
  - `Grpc<X>ServiceController` (server side, implemented by controllers) and `Grpc<X>ServiceClient` (Observable-based, used by gateway proxies).

> **Layering note:** the `Nest*` message namespaces are pure data contracts — import them anywhere, including a service's `domain/` layer (the `Nest` prefix is just the generated-adapter name, not a Nest runtime dependency). Only the `Grpc*` artifacts (Transport / ServiceController / ServiceClient) are framework-bound and must stay out of `domain/`.

## Dependencies

This is a **runtime** package, not types-only: it depends on `@nestjs/common`, `@nestjs/microservices`, `rxjs`, `reflect-metadata`, `@grpc/grpc-js`, `protobufjs`, and `@packages/proto`. The decorators and `Observable` signatures are live code.

## Commands

```bash
pnpm build            # prettier src (silent) → tsdown → dist (cjs only + d.ts)
pnpm dev              # tsdown --watch (build only — does NOT regenerate from .proto)
pnpm format           # prettier src
pnpm reset            # rm -rf .turbo dist node_modules
```

`build` is **cjs-only** (no esm) — backend services are CommonJS — and formats before bundling. Consumers resolve `dist/`; turbo's `^build` rebuilds before downstream `compile`/`build`.

## Consumers & gotchas

- Consumed by every backend app (auth, storage, api-gateway) and by `@backend/grpc` / `@backend/event-bus`.
- Change contracts or fix generated-code bugs in `packages/proto` (`.proto` or the Nest adapter's transform tasks), never in the output here.
- Leaf package — no hand-written logic belongs in `src/`.
