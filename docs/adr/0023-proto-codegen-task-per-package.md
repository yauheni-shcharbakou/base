# 0023 — One proto codegen task per target package

**Status:** Accepted (2026-09-29)
**Applies to:** `@packages/proto`, `@backend/proto`, `@frontend/proto`

## Context

The proto compiler in `@packages/proto` ran all three adapters in one `compile` task: Browser into
its own `src/`, Nest into `backend/packages/proto/src`, Client into `frontend/packages/proto/src`.
Turbo cannot declare a task's outputs outside the package that owns it, so that task declared only
`src/**`. A cache hit restored the Browser output and left the other two trees as they were on
disk — a hand-edited `google/protobuf/timestamp.ts` in either survived `pnpm compile:proto` until a
`--force` run. CI carries `.turbo/cache` between runs and fails on a dirty tree, so this was a live
hazard, not a theoretical one.

A second hole: `GRPC_COMPILER_CONTEXT` (`backend | frontend | all`) chose which adapters ran, but
under `envMode: loose` it never entered the task hash, so a partial run was cached under the same
key as a full one.

Rejected alternatives:

- **Keep one task, list the sibling directories as outputs.** Turbo refuses outputs outside the
  package directory.
- **Keep one task, add `GRPC_COMPILER_CONTEXT` to its `env`.** Fixes the hash collision, not the
  restore: the two foreign trees are still nobody's output.
- **Split into one package per target, each with a full copy of the compiler.** Three copies of
  the tree walk, `ContextService` and shared transform tasks to keep in step.

The event-bus pipeline had the same defect and was fixed the same way in
[0002](0002-codegen-task-per-package.md).

## Decision

Each target package runs its own `compile` task (`tsx compiler/main.ts`) that writes only its own
`src/`, declared as that task's `outputs`:

- `@packages/proto` keeps the shared core and the Browser adapter, and publishes the core as the
  build-time entry `@packages/proto/compiler` (`dist/compiler.cjs`, cjs only, a second tsdown
  config next to the runtime one): `BaseAdapter`, `compileProto(adapterFactory)`, `ContextService`,
  `TransformTask` / `CommonTask` / `RemoveOptionalityTask`, `runProtoc()`, `getProtocPluginPath()`,
  `PROTO_SRC_ROOT`, `PROTO_INCLUDE_ROOT`, `PROTOC_PATH`.
- `@backend/proto` carries the Nest adapter, its tasks and templates; `@frontend/proto` the Client
  adapter. Each runs `protoc-gen-ts_proto` from its own `node_modules/.bin`, so each declares
  `ts-proto` (pinned once in the catalog).
- `runProtoc()` owns the flags every target needs for reproducible output (`--proto_path=.`,
  `--proto_path=<PROTO_INCLUDE_ROOT>`, `annotateFilesWithVersion=false`); each adapter passes only
  its own ts-proto options.
- The core finds `pkg/` and `compiler/include/` by resolving `@packages/proto/package.json` (a
  self-reference, exported for this), because the same module runs from source and bundled into
  `dist/`, at different depths.
- `GRPC_COMPILER_CONTEXT` is gone. Targets are chosen with `turbo --filter`;
  `pnpm compile:proto` is `--filter="@*/proto"`.
- Every compiler `main.ts` rethrows and exits non-zero, so a failed codegen fails its task.

## Consequences

- A cache hit restores every generated tree, and each target's hash covers exactly what produced it.
- `.proto` edits reach the targets only through the dependency hash: their `compile` does not list
  `pkg/**` as an input, and relies on the root `compile.dependsOn: ["^compile", "^build"]` putting
  `@packages/proto#compile` upstream. Dropping that `dependsOn` would silently stop invalidation.
- The target compilers run against `@packages/proto`'s built `dist/compiler.cjs`, so editing the
  core means a `build` of `@packages/proto` before a target compile picks it up — turbo's `^build`
  does this; a bare `pnpm compile` inside a target does not.
- `pkg/` is parsed once per target instead of once in total — three short processes instead of one.
- Adding a flavor means a new package with its own `compiler/` and `compile` task; `@packages/proto`
  is not edited.
