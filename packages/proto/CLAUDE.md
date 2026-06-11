# CLAUDE.md — @packages/proto

Guidance for working inside `packages/proto`. The end-to-end contract flow (what `.proto` is, the three output flavors, how Transports are consumed) is in the root `CLAUDE.md` *Protobuf codegen pipeline* section — this file documents the **compiler internals**.

## Three roles of this package

1. `pkg/**/*.proto` — the hand-written source of truth for all gRPC contracts.
2. `compiler/**` — the custom code generator (run via `pnpm compile`).
3. `src/**` — the **generated** Browser output (one of the three targets) that `tsdown` then builds to `dist`. Do NOT hand-edit `src/`; it is wiped and regenerated on every compile.

## Compiler pipeline (`compiler/main.ts`)

Runs three adapters `[Browser, Client, Nest]`, each filtered by `canRun()`:

1. `onInit` — wipe + recreate the adapter's `targetRoot`, parse its Pug templates.
2. Walk `pkg/` → for each file the adapter generates raw TS (Nest/Client invoke `protoc` + `ts-proto`; see `nest.adapter.ts`), for each folder it writes a barrel `index.ts`. `ContextService` parses each `.proto` with `protobufjs` to build a `ProtoContext` (services, `packageId`).
3. `beforeCompilation` loads generated `.ts` into a ts-morph `Project`; `onSourceFile` runs the adapter's transform tasks, then formats / fixes imports / saves.
4. `onFinish` writes the root `index.ts` entrypoint from collected exports.

## Adapters (`compiler/adapters/`)

Built via `BaseAdapter.createFactory({ name, targetRoot, templatePath?, transformTasks, restrictedContexts })`.

| Adapter | targetRoot | ts-proto | Skipped when context = |
|---------|-----------|----------|------------------------|
| `nest` | `backend/packages/proto/src` | yes (`nestJs=true`, `useDate`, `stringEnums`) | `frontend` |
| `client` | `frontend/packages/proto/src` | yes | `backend` |
| `browser` | `packages/proto/src` (this pkg) | no | never |

`restrictedContexts` + `canRun()` are driven by env `GRPC_COMPILER_CONTEXT` (`backend` | `frontend` | `all`, default `all`).

## Transform tasks (`compiler/tasks/`, `adapters/*/tasks/`)

Each extends `TransformTask` — post-processes one generated file via ts-morph (`sourceFile`, `protoContext`, `ImportService`, `TemplateService`, `entryExportsMap` for root exports), guarded by `canTransform()`. Shared: `CommonTask`, `RemoveOptionalityTask`. Per-adapter: `Fix*ExportsTask`, `AddNestServiceSchemasTask`, `AddClientRepositoriesTask`, `FixBrowserEmptyFilesTask`. Add new generated-code rewrites here, not by editing output.

## Commands

```bash
pnpm compile          # tsx compiler/main.ts → regenerates src/ (+ backend/frontend proto), then prettier
pnpm build            # tsdown: src/ → dist (esm + cjs + d.ts)
pnpm dev              # tsdown --watch (build only — does NOT recompile proto)
pnpm format           # prettier src
```

Turbo splits the stages: `compile` (inputs `pkg/**`,`compiler/**` → outputs `src/**`) vs `build` (inputs `src/**` → `dist/**`). From the root use `pnpm compile:proto`.

## Gotchas / prerequisites

- Requires a `protoc` binary (`PROTOC_PATH`, default `protoc`); the `ts-proto` plugin resolves from local `node_modules/.bin`.
- A `*.service.proto` is recognized as a service by having `methods` → drives Nest Transports / Client repositories. Place new protos under `pkg/<domain>/` and recompile.
- `ts-proto`/`protobufjs`/`pug`/`ts-morph` are devDeps here (the compiler runs in-package, unlike `@packages/compiler-utils` which peer-depends on them).
- All three `src/` outputs are generated — fix bugs in tasks/templates, never in the emitted `.ts`.
