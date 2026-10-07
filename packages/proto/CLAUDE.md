# CLAUDE.md — @packages/proto

Guidance for working inside `packages/proto`. The end-to-end contract flow (what `.proto` is, the three output flavors, how Transports are consumed) is in the root `CLAUDE.md` _Protobuf codegen pipeline_ section — this file documents the **compiler internals**.

## Roles of this package

1. `pkg/**/*.proto` — the hand-written source of truth for all gRPC contracts.
2. `compiler/**` — the shared compiler core plus the Browser adapter. The core is published as the build-time entry **`@packages/proto/compiler`** (`dist/compiler.cjs`); `@backend/proto` and `@frontend/proto` each run their own adapter on it, in their own `compile` task.
3. `src/**` — the **generated** Browser output that `tsdown` then builds to `dist`. Do NOT hand-edit `src/`; it is wiped and regenerated on every compile.

> **Why each target compiles itself:** [docs/adr/0023-proto-codegen-task-per-package.md](../../docs/adr/0023-proto-codegen-task-per-package.md)

## Compiler pipeline (`compileProto(adapterFactory)`, `compiler/compile-proto.ts`)

One adapter per run — each package's `compiler/main.ts` calls it with its own:

1. `onInit` — wipe + recreate the adapter's `targetRoot`, parse its Pug templates.
2. Walk `pkg/` → for each file the adapter generates raw TS (`runProtoc` = `protoc` + `ts-proto`), for each folder it writes a barrel `index.ts`. `ContextService` parses each `.proto` with `protobufjs` to build a `ProtoContext` (services, `packageId`).
3. `beforeCompilation` loads generated `.ts` into a ts-morph `Project`; `onSourceFile` runs the adapter's transform tasks, then formats / fixes imports / saves.
4. `onFinish` writes the root `index.ts` entrypoint from collected exports.

Every `main.ts` rethrows and exits 1, so a failed codegen fails its turbo task.

## Adapters

Built via `BaseAdapter.createFactory({ name, targetRoot, templatePath?, transformTasks })`; the subclass overrides `onFile` to call `runProtoc(relativePath, { pluginPath, outDir, options })` with its own ts-proto `options`.

| Adapter   | Lives in                                   | Output                   | Notable ts-proto options            |
| --------- | ------------------------------------------ | ------------------------ | ----------------------------------- |
| `browser` | `packages/proto/compiler/adapters/browser` | this package's `src/`    | `onlyTypes`, `outputServices=false` |
| `nest`    | `backend/packages/proto/compiler`          | `@backend/proto` `src/`  | `nestJs`, `useMapType=false`        |
| `client`  | `frontend/packages/proto/compiler`         | `@frontend/proto` `src/` | `outputServices=grpc-js`            |

## `@packages/proto/compiler` (`compiler/index.ts`)

`BaseAdapter`, `compileProto`, `ContextService`, `TransformTask` / `CommonTask` / `RemoveOptionalityTask`, `runProtoc`, `getProtocPluginPath`, `PROTO_SRC_ROOT`, `PROTO_INCLUDE_ROOT`, `PROTOC_PATH`, and the payload/context types. The Browser adapter is not exported.

- Built by the second config in `tsdown.config.mts`, **cjs only**; the runtime entry stays esm + cjs. `turbo.json` lists `compiler/**` in `build.inputs` for this reason.
- `ts-morph` / `pug` / `protobufjs` / `change-case-all` stay external only because they are devDependencies here — drop one and tsdown inlines it.
- `PACKAGE_ROOT` resolves `@packages/proto/package.json` (a self-reference, hence `./package.json` in `exports`), never `__dirname`: the same module runs from source (this package's `compile`) and bundled into `dist/` (the targets'), at different depths.
- A target picks up a core change only after this package's `build` — turbo's `^build` handles it; a bare `pnpm compile` inside a target runs against the stale `dist/`.

## Transform tasks (`compiler/tasks/`, each adapter's `tasks/`)

Each extends `TransformTask` — post-processes one generated file via ts-morph (`sourceFile`, `protoContext`, `ImportService`, `TemplateService`, `entryExportsMap` for root exports), guarded by `canTransform()`. Shared (here): `CommonTask`, `RemoveOptionalityTask`. Per-adapter, next to their adapter: `FixBrowserEmptyFilesTask` here, `FixNestExportsTask` / `AddNestServiceSchemasTask` in `@backend/proto`, `FixClientExportsTask` / `AddClientRepositoriesTask` in `@frontend/proto`. Add new generated-code rewrites there, not by editing output.

## Commands

```bash
pnpm compile          # tsx compiler/main.ts → regenerates this package's src/ only
pnpm build            # tsdown: src/ → dist/index.*, compiler/ → dist/compiler.cjs
pnpm dev              # tsdown --watch (build only — does NOT recompile proto)
pnpm typecheck        # tsc --noEmit over src + compiler — the only thing that checks compiler/
pnpm format           # prettier src
```

Turbo splits the stages: `compile` (inputs `pkg/**`,`compiler/**` → outputs `src/**`) vs `build` (inputs `src/**`,`compiler/**` → `dist/**`). From the root use `pnpm compile:proto`, which runs all three targets.

## Gotchas / prerequisites

- Requires a `protoc` binary (`PROTOC_PATH`, default `protoc`). The `ts-proto` plugin resolves from the **running target's** `node_modules/.bin`, so every target declares `ts-proto` (version pinned in the catalog).
- The output does not depend on the `protoc` release (CI installs an unpinned one). `runProtoc` passes these flags for every adapter, so none can drop them:
  - `annotateFilesWithVersion=false`, so the generated headers carry no `protoc` / `ts-proto` versions.
  - `--proto_path=.` (`pkg/`) and `--proto_path=compiler/include`. The well-known types `pkg/` imports (`timestamp`, `empty`) are copied there and searched before protoc's own bundled copy, whose doc comments change between releases and would land in the generated `google/protobuf/*.ts`.
  - **Importing another `google/protobuf/*.proto` means copying it into `compiler/include/` too**, or CI regenerates it from whatever protoc it has and fails the clean-tree check.
- A `*.service.proto` is recognized as a service by having `methods` → drives Nest Transports / Client repositories. Place new protos under `pkg/<domain>/` and recompile.
- All three `src/` outputs are generated — fix bugs in tasks/templates, never in the emitted `.ts`.
- Every write in `base.adapter.ts` (`onFolder`, `onSourceFile`, `onFinish`) goes through `FormatService` from `@packages/compiler-utils`. Keep it that way: a raw `writeFile`/`sourceFile.save()` would land unformatted code both on disk and in the turbo `compile` cache (`outputs: src/**`), which then restores it on every cache hit.
