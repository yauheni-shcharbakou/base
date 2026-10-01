# CLAUDE.md — @packages/env-docs

Guidance for working inside `packages/env-docs`. The monorepo-wide documentation rules (one owner
per fact, rationale in `docs/adr/`) are in the root `CLAUDE.md`.

## What this is

The third codegen in the repo, and the only one whose output is documentation: it rewrites the env
tables in [`docs/env.md`](../../docs/env.md) from the zod schemas those variables are actually
declared in. A variable's name, type, default and whether it is required have exactly one owner —
the `validateEnv` argument — and every table is a projection of it.

`docs/env.md` is the only document carrying tables, deliberately. A deployment checklist is looked
up, not reasoned about while editing code, so it stays out of the `CLAUDE.md` files that are loaded
into every session touching their directory. Same rule as `docs/adr/`. Nothing in the generator
enforces this, though — a marker works in any `.md`.

No `src/`, no `dist/`, nothing to import. This is a CLI, like `@packages/configs` is a pile of
presets.

```bash
pnpm compile:env-docs     # rewrite every marked region (from the repo root)
pnpm check:env-docs       # fail if a region is stale; what the docs hook runs
pnpm typecheck --filter=@packages/env-docs
```

`typecheck` is not ceremony: `compile` runs through `tsx`, which strips types without checking
them, and there is no `build` to check them either — so nothing here reports a type error unless
`tsc` is run on purpose. It found one the day it was added.

## How a document opts in

```markdown
<!-- env-table:start src=backend/packages/event-bus-redis/src/infrastructure/configs/redis.config.ts -->
<!-- env-table:end -->

<!-- env-services:start -->
<!-- env-services:end -->
```

`env-table` projects config files; `env-services` projects the workspace manifests into the map of
which packages' env a service inherits — it takes no `src=`, and a `src=` on it (or a missing one on
a table) is a parse error rather than an empty block.

- Paths are **repository-relative**, not relative to the document.
- Several sources are comma-separated (`src=a.ts,b.ts`); the table then gains a `Source` column.
- `path.ts#ExportName` targets a named exported shape instead of the file's `validateEnv` calls —
  how the shared `NodeValidationSchema` / `DatabaseValidationSchema` are tabulated.
- Everything outside the markers is left alone. Prose explaining *why* a value is what it is
  belongs there, not in the table: defaults drift, reasons do not.
- A marker inside a fenced code block is documentation of the syntax, not a use of it, and is
  skipped — which is what makes this section possible.

**A spread is not expanded.** `validateEnv({ ...NodeValidationSchema })` renders as a line pointing
at the shared shape, so `DATABASE_URL` is written down once instead of in four package tables. For
the same reason a service's table covers only the configs it declares itself; what it inherits from
the packages it wires is the `env-services` table.

## The two invariants

Beyond keeping the tables current, the run fails — in **both** modes, like the `coerce` rule below —
when either of these breaks:

- **Every `validateEnv` call is documented.** Each workspace's `src/` is scanned for the call (text
  match to narrow, then ts-morph to confirm it is a call and not a comment or the helper's own
  declaration); anything no marker names is an error. A `--check` cannot fix it by writing, since
  nothing tells the generator which section a new config belongs under.
- **The service map matches the manifests.** A package appears in a service's row when it is in the
  transitive closure of that service's `workspace:*` dependencies *and* owns a marker source of its
  own. `@packages/common` therefore does not appear — its markers address named shapes, and its
  variables are already counted through whichever package spreads them. An app is a workspace whose
  name carries no `/` (`backend.auth` against `@backend/pg`), which is the repository's own naming
  rule rather than a heuristic layered over it.

Consequences worth knowing: `pnpm compile` fails until a new config file gets a marker, and an edit
to any `package.json` or to `pnpm-workspace.yaml` can change a generated table.

## Layout

```
compiler/
  main.ts        # walks the docs, write mode and --check, exit codes
  markers.ts     # finds .md files, locates and splices the marked regions
  parser.ts      # ts-morph: validateEnv argument → EnvSchemaModel
  renderer.ts    # EnvSchemaModel[] / EnvServiceModel[] → the markdown that replaces a region
  workspaces.ts  # the manifests: names, directories, dependency closure
  coverage.ts    # every validateEnv call site, for the invariant above
  models.ts      # the types they exchange
  constants.ts
```

`main.ts` runs in two passes: every marker of every document is parsed before anything is rendered,
because the `env-services` table is a projection of all the other markers at once.

## When editing

- **The parser throws on anything it does not recognise** — an unknown zod base, modifier or
  property shape names the file and variable and stops the run. That is deliberate: a table missing
  a row is worse than no table, because it reads as complete. Widening it means adding to
  `BASE_TYPES` / `BOUNDS` / `ARGUMENT_BOUNDS` in `parser.ts`, not adding a fallback branch.
- **`zod.number()` / `zod.boolean()` without `zod.coerce` is a hard error**, not a rendering
  concern: `process.env` values are strings, so such a variable parses only while it is unset and
  its default applies. Setting it crashes the service at import time. The parser collects these
  while it is already walking the chain.
- No type checker is loaded — the files are parsed syntactically, so a config that does not compile
  still generates. Nothing here needs to resolve an import.
- **The workspace roots are read from `pnpm-workspace.yaml`**, not copied into `constants.ts`. A
  second list of roots is exactly the kind of copy this package exists to delete; only the
  `./dir/*` glob form is understood, and anything else is a parse error.
- The turbo `compile` task is `"cache": false`, the only one in the repo that writes outside its
  own package. See [ADR-0008](../../docs/adr/0008-generated-env-tables.md).
