# CLAUDE.md — @packages/configs

Guidance for working inside `packages/configs`. For monorepo-wide conventions (workspace naming, turbo, prettier, codegen), see the root `CLAUDE.md`.

## What this is

Centralized **ESLint** (flat config, factory functions) and **tsconfig** presets for every workspace. There is no build: no `src`, no `dist`, no runtime output — just config files. Consumers wire them directly (`extends` for tsconfig, `import` a factory for eslint), so editing a preset affects everyone at once.

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
- `eslint/next.config.mjs` → factory `nextConfig()` (no argument); reads the root `.prettierrc` via a relative path. Used only by frontend/apps/admin. Wires `@next/next` (recommended + core-web-vitals) and **`eslint-plugin-react-hooks`** (`rules-of-hooks: error`, `exhaustive-deps: warn`) on top of the TS/prettier rules — so React hook violations DO fail lint here.

Both enable `prettier/prettier: 'error'`. The nest preset runs in type-checked mode but deliberately **disables** most unsafe rules (`no-explicit-any`, `no-floating-promises`, `no-unused-vars`, `unbound-method`, `no-unsafe-*`). So the linter does NOT catch those classes of errors.

Wiring in a consumer:
```js
// backend/*/eslint.config.mjs
import nestConfig from '@packages/configs/eslint/nest.config.mjs';
export default nestConfig(import.meta.url);
```

## Layer-direction guard (`eslint/layer-guard.mjs`)

- `eslint/layer-guard.mjs` → factory `layerGuard(forbidden?)`. Enforces the inward clean-architecture dependency direction (`interface -> infrastructure -> application -> domain`) by matching path segments regardless of nesting depth, so it works across every layout in the repo (`src/modules/<feature>/<layer>/...` in apps, `src/{core,migration}/<layer>/...` in pg/mongo, `src/<layer>/...` in nats).
- Default forbidden-imports map (used when called with no argument):
  ```js
  {
    domain: ['application', 'infrastructure', 'interface'],
    application: ['infrastructure', 'interface'],
    infrastructure: ['interface'],
  }
  ```
- Composition roots (`*.module.ts`, `main.ts`) sit outside any `<layer>/` directory, so they're exempt and may freely wire concrete implementations together.
- Consumers: `backend/packages/nats`, `backend/packages/pg`, `backend/packages/mongo`, `backend/apps/auth`, `backend/apps/storage`. All wire it the same way, alongside `nestConfig`:
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
