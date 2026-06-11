# CLAUDE.md — @frontend/proto

Guidance for working inside `frontend/packages/proto`. The cross-service contract flow and the three generated proto flavors are documented in the root `CLAUDE.md` *Protobuf codegen pipeline* section — read that first.

## What this is

The **fully generated** frontend gRPC client package. It is the Client-adapter output of the compiler that lives in `packages/proto` (`targetRoot = frontend/packages/proto/src`). There is **no `pkg/`, no `compiler/`, and no `compile` script here** — this package only builds the already-generated `src/` into `dist`.

Every file under `src/` is emitted by `protoc-gen-ts_proto` and carries `// @ts-nocheck`, `DO NOT EDIT`, `/* eslint-disable */`. Never hand-edit it; the whole tree is wiped and regenerated on each compile.

## How to (re)generate

Edit the `.proto` source in `packages/proto/pkg/**`, then from the repo root run `pnpm compile:proto` (or `GRPC_COMPILER_CONTEXT=frontend pnpm compile:proto` to run only the frontend-relevant adapters). The compiler rewrites this `src/`; commit the result.

## What it exports (`src/index.ts`)

- Message namespaces, `Client`-prefixed: `ClientAuth`, `ClientCommon`, `ClientStorage`, `ClientGoogle` (vs. the `Nest*` namespaces in `@backend/proto`).
- Per-service **client repositories**: `Grpc<X>Repository` plus `Grpc<X>Admin/Web/PublicRepository` (e.g. `GrpcUserRepository`, `GrpcUserAdminRepository`). These are the frontend equivalent of backend Transports — the admin app talks to api-gateway through them.

Messages use `@bufbuild/protobuf/wire` (`BinaryReader/Writer`, `encode`/`decode`/`fromJSON`/`fromPartial`); service stubs use `@grpc/grpc-js`. Depends on `@packages/proto` (workspace) for shared browser-safe types.

## Commands

```bash
pnpm build            # prettier src (silent) → tsdown → dist (esm + cjs + d.ts)
pnpm dev              # tsdown --watch (build only — does NOT regenerate from .proto)
pnpm format           # prettier src
pnpm reset            # rm -rf .turbo dist node_modules
```

Note `build` formats before bundling (unlike sibling packages where `format` is separate). Consumers resolve `dist/`, so rebuild after a regenerate; turbo's `^build` handles this for downstream apps.

## Consumers & gotchas

- Sole consumer: `frontend/apps/admin`.
- To change contracts or fix generated-code bugs, edit `packages/proto` (`.proto` files or the Client adapter's transform tasks), never the output here.
- This is a leaf package: don't add runtime logic — anything non-generated belongs in the admin app or a real shared package.
