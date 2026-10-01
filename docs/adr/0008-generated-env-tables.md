# 0008 — Env tables are generated from the zod schemas

**Status:** Accepted (2026-09-07)
**Applies to:** `@packages/env-docs`, `docs/env.md`

## Context

A variable's name, type, default and whether it is required were written down twice: once in a
`validateEnv` argument, once in prose in a `CLAUDE.md`. Nothing tied the two together.

The documentation pass that introduced the one-owner rule (ADR-0001 onwards) closed the structural
half of this with `.claude/hooks/check-docs-invariants.sh` — dangling ADR links, missing index rows,
references to workspaces that do not exist. It cannot check **values**, and values are what drift:
a default is changed in a config file by someone who has no reason to open the package's
documentation.

Reading the schemas at runtime is not available: `validateEnv` never hands the schema back and
throws on a missing required variable, so a generator that imported the config modules would die
exactly where a service without env dies.

Auditing the eleven call sites while designing this turned up what the drift already cost:
`SALT_ROUNDS` appeared in no `CLAUDE.md` at all; the nine `BUNNY_*` variables — six of them
required — were summarised as "API keys, CDN zones, private keys, expiries"; and
`SALT_ROUNDS: zod.number().default(10)` could not accept a value from the environment, because
`process.env` is strings.

## Decision

`@packages/env-docs` parses the `validateEnv` arguments with ts-morph — syntax only, no type
checker, no imports resolved — and rewrites marked regions of a markdown file:

```markdown
<!-- env-table:start src=backend/packages/event-bus-redis/src/infrastructure/configs/redis.config.ts -->
<!-- env-table:end -->
```

Three columns: variable, type, default (or `**required**`). Prose around the markers is untouched —
the generator owns values, hand-written text owns reasons.

**The tables live in `docs/env.md`, not in the `CLAUDE.md` files.** The first cut put a table in
each package's and service's own documentation, which cost about 6.8 KB spread across ten
auto-loaded files. That is the mistake the one-owner pass was supposed to stop making: a
`CLAUDE.md` is loaded into every session touching its directory and should carry instruction, while
a deployment checklist is looked up. So env tables follow the same rule as `docs/adr/` — one
lazily-read page, linked from the rule it belongs to. It also makes the checklist complete, which a
per-package table could never be, since a service's env is the union of its own configs and those
of the packages it wires.

A spread of a shared shape renders as a pointer rather than expanded rows, so `DATABASE_URL` is
written down once instead of in four package tables. A service's table covers only the configs it
declares itself; what it inherits from the packages it wires is a **second marked region**,
`env-services`, projected from the workspace manifests rather than from a schema — the transitive
`workspace:*` closure of each app, filtered to the workspaces that own a marker of their own. That
is the one answer the page owes a deployment which no single schema can give.

Anything the parser does not recognise is a hard error naming the file and variable. Two further
checks fail the run outright, in write mode as well as `--check`, because neither can be fixed by
rewriting a region: a `zod.number()` / `zod.boolean()` without `zod.coerce`, and a `validateEnv`
call no marker names. The second is found by scanning each workspace's `src/` and confirming the
call through the AST, so a mention in a comment and the helper's own declaration do not count.

`pnpm check:env-docs` is the read-only counterpart, wired into the documentation hook so an edit to
a config file blocks until the tables are regenerated.

## Consequences

- The turbo `compile` task of `@packages/env-docs` is `"cache": false` — the only task in the repo
  that writes outside its own package, so it has no declarable `outputs` (ADR-0002) and a cache hit
  would leave stale tables on disk while reporting success. The run takes about a second.
- Documenting a new variable is nothing but adding it to the schema. Documenting one wrongly, or
  leaving a config file undocumented, both stop the build — which also means `pnpm compile` fails
  until a newly added `validateEnv` gets a marker, and an edit to a `package.json` can change a
  generated table. That is the price of the checklist being complete rather than approximately so.
- Env moves one hop further from the code being edited. Acceptable, because the authoritative
  answer was never the table: it is the config file, which is in the package a reader is already
  in.
- The strictness has a cost: an exotic zod construct stops the generator until the parser learns it.
  That is the intended trade — a table silently missing a row reads as complete.
- Config files gain a second audience. A comment above a key is read by whoever changes the value,
  not by the table, which carries only mechanical facts.
- The `coerce` rule is now enforced repo-wide rather than remembered. `SALT_ROUNDS` was fixed in the
  same pass.
