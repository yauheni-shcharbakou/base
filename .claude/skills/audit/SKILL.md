---
name: audit
description: Audit the production dependencies for known vulnerabilities, propose a fix for each advisory — a catalog or manifest bump, a lockfile-only update, or an override in pnpm-workspace.yaml — apply the approved ones, run the CI checks and commit. Also flags overrides that are no longer needed. With `--dev`, covers the devDependencies too. Use when `pnpm check:audit` fails, or when asked to "audit dependencies", "audit dev dependencies", "fix vulnerabilities", "check for CVEs" or "clean up overrides".
---

# Fixing a dependency advisory

`pnpm check:audit` (`pnpm audit --prod --audit-level=high`) runs in the `check` job of
`.github/workflows/check.yaml` and fails a pull request on any high or critical advisory in a
production dependency. Dependabot does not help here: its npm side is limited to the Railway SDK on
purpose — versions are bumped by hand, in the pnpm catalog (see `.github/dependabot.yml`).

What a tool cannot decide, and this skill exists for, is **which lever** fixes an advisory: a bump of
what we declare, a lockfile refresh inside the ranges we already have, or an `override` that rewrites
the whole tree. Overrides are the last resort — each one pins a transitive version nobody upgrades
again — so the skill also checks whether the existing ones still earn their place.

**Two modes.** Plain `/audit` covers what CI fails on and what ships: the production dependencies.
`/audit --dev` covers the whole tree, devDependencies included — the build, lint and test tooling CI
never audits. Every step below is the same in both; where a step differs, it says so.

## Steps

0. **Start from a clean tree.** The skill ends with a commit of its own; it must not sweep unrelated
   work into it.

   ```bash
   git status --porcelain
   git branch --show-current
   ```

   If the tree is dirty, show `git status --short` and `git diff --stat`, propose a Conventional
   Commits message for it, and ask (AskUserQuestion) whether to commit it first. Commit only on a
   yes — staging by name, never `git add -A` — and stop on a no. On `main`, stop and ask for a
   branch: nothing is committed there.

1. **Run the audit**, in full — every severity, not just what CI fails on:

   ```bash
   pnpm audit --prod --json >/tmp/audit-prod.json
   pnpm audit --json >/tmp/audit.json   # --dev only: the whole tree; the --prod file gives Scope
   ```

   It exits non-zero whenever it finds something; only output that is not JSON is a failure.

   No advisories → say so, run step 3's override check anyway (an audit-clean tree is exactly when
   a stale override shows), and stop if that finds nothing either.

2. **Show one table, change nothing yet.** One row per advisory, sorted critical → low:

   | Severity | Package | Vulnerable → patched | Advisory | Path | Proposed fix |
   | -------- | ------- | -------------------- | -------- | ---- | ------------ |

   With `--dev`, a **Scope** column after Package: `prod` when the `--prod` audit reports the same
   GHSA, `dev` otherwise.

   - **Advisory** — the GHSA id, linked (`https://github.com/advisories/GHSA-…`).
   - **Path** — direct or transitive, through which parent, in which workspaces. Read it from the
     audit's own `findings[].paths` (`<workspace>><direct dep>>…><parent>><pkg>`, the workspace
     with `/` spelled `__`), all advisories in one pass — not one `pnpm why` per row:

     ```bash
     jq -r '.advisories[] | [.findings[].paths[] | split(">")] as $p
       | [.github_advisory_id, .module_name, ([.findings[].version] | unique | join(",")),
          ($p | map(.[0] | gsub("__"; "/")) | unique | join(" ")),
          (if any($p[]; length == 2) then "direct" else "via " + ($p | map(.[1]) | unique | join(",")) end),
          "parents " + ($p | map(.[-2]) | unique | join(","))] | @tsv' /tmp/audit-prod.json
     ```

     With `--dev`, read `/tmp/audit.json` instead. The `parents` column is what step 3 decides on;
     `pnpm why -r <pkg>` is left for a row that needs the full chain.

   - **Proposed fix** — from step 3. Mark a **major** bump explicitly: it can break the build or
     the runtime, and the checks in step 5 only cover what the specs cover.
   - Rows from step 3's override check go below, as `remove override <pkg>`.

3. **Pick the fix, the first that applies:**

   1. **Direct dependency** → bump it. A version more than one workspace declares lives in the
      `catalog:` block of `pnpm-workspace.yaml` — bump it there, never in a manifest that says
      `catalog:`. A dependency of one workspace only keeps its literal version in that manifest.
   2. **Transitive, and the patched version is inside the parent's range** → refresh the lockfile
      only: `pnpm update -r <pkg>`. No manifest changes.
   3. **Transitive, and no parent release accepts the patched version** (or the parent cannot move:
      a major we are not ready for) → an entry in `overrides:` of `pnpm-workspace.yaml`, next to the
      existing ones, pinned to the exact patched version (`qs: '6.16.0'`, not a range). Before
      settling on it, check whether a newer parent would do: `pnpm view <parent> dependencies`.

   For a `dev` row the order matters more: an override rewrites the **whole** tree, production
   included, so a dev-only advisory fixed that way can change what ships. Exhaust the devDependency
   bump and the lockfile refresh first, and say in the row when an override would reach prod
   packages too (`pnpm why -r <pkg> --prod` is not empty).

   A package in both `catalog:` and `overrides:` (`@grpc/grpc-js`, `axios`, `lodash`,
   `protobufjs`) is deliberate — the catalog for what we ask for, the override for what the
   transitive tree gets. Bump both together.

   **Stale overrides.** `bash scripts/stale-overrides.sh` (`--dev` in that mode) judges every entry
   of `overrides:`: it drops one line, re-resolves the lockfile, and asks whether `pnpm audit
--prod` (the whole tree with `--dev`) then reports an advisory for the package that the tree with
   every override did not, and whether the lockfile resolves any copy below the pin. It restores
   both files after each entry, and takes package names to judge only those. Its output, one line
   per entry:

   - `stale <pkg>` → propose removing it.
   - `kept <pkg>: <why>` → a comment right above the entry holds it, whatever a resolve would
     show; the `<why>` is that comment's first line. Nothing to show, nothing to propose.
   - `needed <pkg>: <why>` → it stays; nothing to show.
   - `skipped <pkg>: <why>` → a range or a selector; judge it by hand, or leave it.

   When the user keeps an override the script called stale, write their reason as a comment right
   above the entry, first line self-contained — the next run then prints `kept`, not `stale`.

   "Stale" means the parents' ranges accept the pinned version, so the current lockfile keeps it
   without the override. It does not promise a later resolve stays above it — a parent release
   that narrows its range can bring an old copy back, and `check:audit` is what catches that.

4. **Ask what to apply** (AskUserQuestion): the proposed high and critical fixes (the default), all
   of them, or a chosen subset. Moderate, low and override removals are applied only when chosen.

5. **Apply, then run what CI runs**, in this order — specs and typecheck read sibling packages
   through their built `dist`, so `build` comes first:

   ```bash
   pnpm install
   pnpm check:audit
   pnpm build
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm test:e2e                     # only with `pnpm docker:e2e` up; otherwise say it was skipped
   pnpm exec prettier --check .
   git status --short                # only the files the fix touched
   ```

   With `--dev`, also `pnpm audit --audit-level=high` before and after, and report both counts:
   `check:audit` still guards prod, this shows what the fix did for the rest.

   `lint` runs with `--fix`: anything it or the build leaves changed outside the fix would also fail
   CI's dirty-tree check. On any failure there is no commit — show the output, name the fix that
   caused it, and offer to revert just that one (its lines in `pnpm-workspace.yaml` or the
   manifest, then `pnpm install`). Never around a check (`--no-verify`).

6. **Commit**, once step 5 passes:

   ```bash
   git add pnpm-workspace.yaml pnpm-lock.yaml   # and each manifest the fix bumped
   git commit -m 'fix(deps): <pkg>[, <pkg>…] (<GHSA-…>[, …])'
   ```

   The body is the table of what was applied (and the overrides removed). A removal-only change is
   `chore(deps): drop stale overrides <pkg>…`. A fix that touches devDependencies only ships
   nothing, so it is `build(deps): <pkg>[, <pkg>…] (<GHSA-…>[, …])`, not `fix`. Report the hash.

## What this skill does not do

It does not push, and it does not prepare the release: an advisory fix is a **patch** release —
run `/release` before the merge so the version and a `### Fixed` line in `CHANGELOG.md` go with it.
A devDependencies-only fix (`build(deps)`) is a patch too, under `### Tooling`, not `### Fixed`.
Without `--dev` it leaves devDependencies alone: `--prod` is what CI fails on, and what ships;
`--dev` is a review on request, never a gate.
