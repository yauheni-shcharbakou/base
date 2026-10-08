# CLAUDE.md — turbo/generators

Guidance for working inside `turbo/generators`. The root `CLAUDE.md` mentions `pnpm gen:package`; this file is how the generator works.

## What this is

A Turborepo + **plop** generator that scaffolds new workspace **packages** (not apps/services). `config.ts` registers a single `package` generator (`package/index.ts`). It is not itself a workspace package — there are no local pnpm scripts; drive it from the repo root with `pnpm gen:package`.

## The `package` generator

Two prompts: **name** (no slashes/spaces) and **type** (`default` | `backend` | `frontend`). The type selects both the destination root and the template set:

| type       | destination                | scope              |
| ---------- | -------------------------- | ------------------ |
| `default`  | `packages/<name>`          | `@packages/<name>` |
| `backend`  | `backend/packages/<name>`  | `@backend/<name>`  |
| `frontend` | `frontend/packages/<name>` | `@frontend/<name>` |

`name` is `dashCase`d for the folder and `@scope/name`. The action is `addMany`, copying `templates/<type>/**/*` (dotfiles included) into the destination, then the root script runs `pnpm install` to link the new workspace.

**Template paths are relative, never built from `__dirname`.** Plop resolves a relative `base`/`templateFiles` against the plopfile, `turbo/generators`. `__dirname` looks equivalent and is not: turbo bundles `config.ts` and everything it imports into one file, so inside `package/index.ts` it is `turbo/generators` as well, and `join(__dirname, 'templates', type)` points at a folder that does not exist. `addMany` then matches nothing and still prints "Success!" with `0 files added` — the generator scaffolded nothing that way until this was fixed. An empty match is not a failure to plop, so check the `N files added` line after a change here.

## Templates (`package/templates/<type>/`)

All three extend the `@packages/configs` tsconfig/eslint presets, build with `tsdown`, and declare `typecheck` (`tsc --noEmit` — tsdown does not check types). Differences:

- **default** — minimal `@packages/*`: esm + cjs, no `lint` script, no eslint config, no runtime deps. `format` path is `../../`.
- **backend** — `@backend/*`: nest tsconfig preset + `eslint.config.mjs` (`nestConfig` + `layerGuard()`, a no-op until the package has layer folders) + `lint`; deps `@backend/proto`, `@nestjs/common`, `@nestjs/config`, `@packages/common`, `reflect-metadata`, `rxjs`; cjs-only (no `module`); `turbo.json` keeps specs out of the build inputs.
- **frontend** — `@frontend/*`: esm + cjs, eslint (`nextConfig(import.meta.url)` — the argument is required) + `lint`, dep `@packages/common`.

`package.json.hbs` is a Handlebars template (`{{ dashCase name }}`); the other template files are copied verbatim. Its external dependencies are declared as `"catalog:"`, so a generated package picks up the workspace-wide version instead of a literal that goes stale in the template — which it had: `@nestjs/common` sat at `11.1.21` while the repo ran `11.1.27`.

## Editing

- To change the defaults every new package of a type gets, edit `templates/<type>/` — these templates are the canonical starting point the package CLAUDE.md files refer to.
- To add a package type: add an entry to `packageRootByType` in `package/index.ts` and a matching `templates/<type>/` folder.

## Gotchas

- Scaffolds **packages only** — new apps/services (`backend/apps/*`, `frontend/apps/*`) are still created by hand.
- `src/index.ts` is `export {}`, not a bare comment: tsdown's declaration emit warns on a file that is not a module.
- Verify a template change by generating each type and running `build`, `typecheck` and `lint` on the result — in a throwaway `git worktree`, so the lockfile and tree of the real checkout stay clean.
