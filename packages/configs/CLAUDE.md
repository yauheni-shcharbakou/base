# CLAUDE.md — @packages/configs

Guidance for working inside `packages/configs`. For monorepo-wide conventions (workspace naming, turbo, prettier, codegen), see the root `CLAUDE.md`.

## What this is

Centralized **ESLint** (flat config, factory functions), **tsconfig** and **tsdown** presets for every workspace. There is no build: no `src`, no `dist`, no runtime output — just config files. Consumers wire them directly (`extends` for tsconfig, `import` a factory for eslint and tsdown), so editing a preset affects everyone at once.

Because the presets are read from outside the packages that use them, `packages/configs/**` is listed in the root `turbo.json` `globalDependencies` — otherwise an edit here would never reach a build hash.

## tsconfig presets (`tsconfig/`)

| File | Extended by | Notes |
|------|-------------|-------|
| `app/nest.tsconfig.json` | backend apps (auth, storage, api-gateway) | NodeNext, decorators, `strict` **off** (strictNullChecks/noImplicitAny off) |
| `app/refine.tsconfig.json` | frontend/apps/admin | `strict` **on**, jsx preserve, next plugin, noEmit |
| `package/base.tsconfig.json` | leaf packages `@packages/*`, `@frontend/proto` | `strict` **on**, bundler resolution |
| `package/nest.tsconfig.json` | all `@backend/packages/*` | extends `base`, but adds decorators/NodeNext and **drops** `strict` |

Gotcha: backend configs are intentionally non-strict (`strict` off), even though `package/nest` extends the strict `base` and overrides it. Package presets are strict, app-nest is not.

## ESLint presets (`eslint/`)

- `eslint/nest.config.mjs` → factory `nestConfig(import.meta.url)`. **The argument is required** — it feeds `tsconfigRootDir` + `projectService` (type-checked rules). Used by all backend apps and `@backend/packages/*`.
- `eslint/next.config.mjs` → factory `nextConfig(import.meta.url)`. **The argument is required** — it locates the app's `tsconfig.json` for the import resolver. Reads the root `.prettierrc` via a relative path. Used only by frontend/apps/admin. Wires `@next/next` (recommended + core-web-vitals) and **`eslint-plugin-react-hooks`** (`rules-of-hooks: error`, `exhaustive-deps: warn`) on top of the TS/prettier rules — so React hook violations DO fail lint here.

Both enable `prettier/prettier: 'error'`. The nest preset runs in type-checked mode but deliberately **disables** most unsafe rules (`no-explicit-any`, `no-floating-promises`, `no-unused-vars`, `unbound-method`, `no-unsafe-*`). So the linter does NOT catch those classes of errors.

The one rule it does enforce beyond formatting is **`import-x/no-extraneous-dependencies`** (`eslint-plugin-import-x`, wired rule-by-rule rather than via `flatConfigs.recommended`, which would also switch on `no-unresolved`): a package must declare what it imports, and `src/` may not reach into devDependencies (`compiler/`, `test/` and specs may). It is the lint-side counterpart of the tsdown factory — see the section above for what an undeclared import costs.

Two things it needs to work here:
- **`eslint-import-resolver-typescript` is required, not an optimisation.** `@modules/…`, `@common/…` and `@compiler/…` are tsconfig path aliases that match the scoped-package pattern; unresolved, every one of the ~400 such imports reads as an undeclared external package.
- **Type-only imports of a `@types/*` package must say `import type`.** A plain `import { Request } from 'express'` in `api-gateway` resolves to `@types/express` in devDependencies and is reported; `import type` is skipped (`includeTypes` is left at its default) and is the correct form anyway.

`nextConfig` carries the same rule, so it reaches the three backend apps, the seven `@backend/packages/*` and `frontend.admin`. Still **not** covered: `@packages/{common,proto,compiler-utils}`, `@backend/proto` and `@frontend/proto` have no `eslint.config.mjs` at all, so their dependencies are kept correct by hand.

The admin app's `lint` script had to move off `next lint` for this: it runs ESLint but does not surface this rule's errors, and it is deprecated (removed in Next 16 — its own output says so). It is now a plain `eslint "src/**/*.{ts,tsx}" --fix`, like every other workspace.

Wiring in a consumer:
```js
// backend/*/eslint.config.mjs
import nestConfig from '@packages/configs/eslint/nest.config.mjs';
export default nestConfig(import.meta.url);
```

## tsdown preset (`tsdown/package.config.mjs`)

`nodePackageConfig(import.meta.url, overrides?)` — the single build config for every package that ships a `dist/`. Same shape as `nestConfig`: the argument is **required**, because the factory turns it into the caller's directory and reads the `package.json` sitting next to it.

That manifest is the whole point. Externals (`deps.neverBundle`) come from the **package's own** dependencies + devDependencies + peerDependencies. Each config used to read the *root* manifest instead, which silently let a package import something it never declared — `@backend/pg` reached for `ulid` and `change-case-all` that way. Such an import breaks under a non-hoisting node-linker and, now that the factory reads the local manifest, gets **bundled into `dist/`** instead: dropping `zod` from `@backend/grpc` grows its bundle from 20 KB to 468 KB. `import-x/no-extraneous-dependencies` (below) is the lint-side half of the same rule.

```ts
// backend/*/tsdown.config.mts — the common case
import nodePackageConfig from '@packages/configs/tsdown/package.config.mjs';

export default nodePackageConfig(import.meta.url);
```

Defaults are `entry: 'src/index.ts'`, `format: ['cjs']`, `dts: true`. `overrides` is merged over them (`deps` merges by key), which covers the two packages that need more:

- `@packages/*` and `@frontend/proto` pass `{ format: ['esm', 'cjs'] }`.
- `@backend/event-bus` passes named entries for its second, build-time `compiler` entrypoint.

A package that needs an external the factory cannot see is a package with an undeclared dependency — declare it in its `package.json` rather than hand-adding to `neverBundle`. The factory reads dependency **names**, not versions, so a `"catalog:"` specifier works exactly like a literal one.

## Layer-direction guard (`eslint/layer-guard.mjs`)

- `eslint/layer-guard.mjs` → factory `layerGuard(forbidden?)`. Enforces the inward clean-architecture dependency direction (`interface -> infrastructure -> application -> domain`) by matching path segments regardless of nesting depth, so it works across every layout in the repo (`src/modules/<feature>/<layer>/...` in apps, `src/core/<layer>/...` in pg/mongo, `src/<layer>/...` in nats).
- Default forbidden-imports map (used when called with no argument):
  ```js
  {
    domain: ['application', 'infrastructure', 'interface'],
    application: ['infrastructure', 'interface'],
    infrastructure: ['interface'],
  }
  ```
- Composition roots (`*.module.ts`, `main.ts`) sit outside any `<layer>/` directory, so they're exempt and may freely wire concrete implementations together.
- Consumers: `backend/packages/{cache,event-bus-nats,event-bus-redis,pg,mongo}`, `backend/apps/{auth,storage,api-gateway}`, and the backend template of `pnpm gen:package`. All wire it the same way, alongside `nestConfig`:
  ```js
  // backend/*/eslint.config.mjs
  import nestConfig from '@packages/configs/eslint/nest.config.mjs';
  import layerGuard from '@packages/configs/eslint/layer-guard.mjs';

  export default [...nestConfig(import.meta.url), ...layerGuard()];
  ```

## Commands

```bash
pnpm reset            # rm -rf node_modules
pnpm reset:modules    # same
```

There is NO `build`/`lint`/`dev`/`test` here — the package builds nothing. Lint and typecheck run in the consumers (`pnpm lint --filter=<pkg>`). ESLint preset edits take effect immediately; tsconfig edits require rebuilding consumers.

## When editing

- Changing a preset affects the whole class of consumers in the tables above — the effect is global.
- `turbo gen package` templates already reference these presets, so new packages inherit them automatically; edit the templates in `turbo/generators/package/templates/`, not one-offs.
- `next.config.mjs` depends on the path depth to the root `.prettierrc` (`../../../`) — don't move the file without fixing the path.
- Don't add runtime dependencies here: the package only exists in consumers' devDependencies.
