# CLAUDE.md — turbo/generators

Guidance for working inside `turbo/generators`. The root `CLAUDE.md` mentions `pnpm gen:package`; this file is how the generator works.

## What this is

A Turborepo + **plop** generator that scaffolds new workspace **packages** (not apps/services). `config.ts` registers a single `package` generator (`package/index.ts`). It is not itself a workspace package — there are no local pnpm scripts; drive it from the repo root with `pnpm gen:package`.

## The `package` generator

Two prompts: **name** (no slashes/spaces) and **type** (`default` | `backend` | `frontend`). The type selects both the destination root and the template set:

| type | destination | scope |
|------|-------------|-------|
| `default` | `packages/<name>` | `@packages/<name>` |
| `backend` | `backend/packages/<name>` | `@backend/<name>` |
| `frontend` | `frontend/packages/<name>` | `@frontend/<name>` |

`name` is `dashCase`d for the folder and `@scope/name`. The action is `addMany`, copying `templates/<type>/` (including dotfiles like `eslint.config.mjs`) into the destination.

## Templates (`package/templates/<type>/`)

All three extend the `@packages/configs` tsconfig/eslint presets and build with `tsdown`. Differences:
- **default** — minimal `@packages/*`: esm + cjs, no `lint` script, no eslint config, no runtime deps. `format` path is `../../`.
- **backend** — `@backend/*`: nest tsconfig preset + `eslint.config.mjs` + `lint`; deps `@backend/proto`, `@nestjs/common`, `@nestjs/config`, `@packages/common`, `reflect-metadata`, `rxjs`; cjs-only (no `module`).
- **frontend** — `@frontend/*`: esm + cjs, eslint + `lint`, dep `@packages/common`.

`package.json.hbs` is a Handlebars template (`{{ dashCase name }}`); the other template files are copied verbatim.

## Editing

- To change the defaults every new package of a type gets, edit `templates/<type>/` — these templates are the canonical starting point the package CLAUDE.md files refer to.
- To add a package type: add an entry to `packageRootByType` in `package/index.ts` and a matching `templates/<type>/` folder.

## Gotchas

- Scaffolds **packages only** — new apps/services (`backend/apps/*`, `frontend/apps/*`) are still created by hand.
- The root `gen:package` script is `turbo gen package && yarn` — the trailing `yarn` looks stale for a pnpm repo (it should re-run `pnpm install` to link the new workspace). Run `pnpm install` after generating if linking is off.
