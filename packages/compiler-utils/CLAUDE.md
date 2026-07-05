# CLAUDE.md — @packages/compiler-utils

Guidance for working inside `packages/compiler-utils`. For monorepo-wide conventions (naming, turbo, prettier), see the root `CLAUDE.md`. For context on the compilers themselves, see its *Protobuf codegen pipeline* and *Event-bus codegen pipeline* sections.

## What this is

The low-level toolkit that **both** custom codegen compilers are built on — `packages/proto/compiler` and `backend/packages/event-bus/compiler`. It holds no compiler-specific logic, only reusable primitives. Single barrel — everything via `src/index.ts`, import strictly as `@packages/compiler-utils`.

## Exports

- **`TemplateService(templatePath?)`** — a Pug wrapper. `parse()` recursively reads every `*.pug` under the directory and compiles them (key = filename without `.pug`); `render(name, data)` renders by name. This is how adapters generate code from templates (e.g. `render('nats.controller', { data })`).
- **`ImportService(sourceFile)`** — a ts-morph `SourceFile` wrapper. `addOrUpdate(moduleName, namedImports)` adds/merges named imports with dedup (clears `isTypeOnly` on merge). Adapters use it to assemble the import block of generated files.
- **Repo-root paths** — `REPOSITORY_ROOT`, `COMMON_PACKAGES_DIR_ROOT`, `BACKEND_PACKAGES_DIR_ROOT`, `FRONTEND_PACKAGES_DIR_ROOT`. Compilers use them as `targetRoot` (e.g. `join(BACKEND_PACKAGES_DIR_ROOT, 'proto', 'src')`).
- **Extension regexes** — `PROTO_EXT_REG_EXP`, `TS_EXT_REG_EXP`, `PUG_EXT_REG_EXP`.

## Dependencies (contract)

`pug`, `ts-morph`, `@types/pug` are declared in both `devDependencies` and **`peerDependencies`**. The package does NOT bundle them — every consuming compiler must carry these deps itself (as `packages/proto` and `@backend/event-bus` do). If you add a new primitive backed by a third-party lib, add it to peerDeps and to the consumers.

## Commands

```bash
pnpm build            # tsdown → dist (esm + cjs + d.ts)
pnpm format           # prettier src
pnpm reset            # rm -rf .turbo dist node_modules
```

There is NO `dev`, `lint`, `test`, or `compile` here. Consumers resolve the built `dist/` (turbo's `^build` rebuilds it before their `compile`), so run `pnpm build` after changes — there is no watch mode, rebuild manually while iterating.

## Gotchas

- Repo-root paths are derived from the **built** file's `__dirname` (`dist/` → `../../..` = repo root). This only holds at the fixed depth `packages/compiler-utils/dist` — moving the package breaks every `targetRoot`.
- `PROTO_/TS_/PUG_EXT_REG_EXP` are duplicated in `@packages/common/utils/regexp`. The copies are identical — keep both in sync when editing (or see the suggestion below).
- There are only two consumers (the proto and event-bus compilers) — changing `TemplateService`/`ImportService` signatures is safe, but verify both `compiler/adapters/`.
