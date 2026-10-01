---
name: release
description: Prepare a branch for its merge into main — write the CHANGELOG.md entry for everything since main, bump the root version, and check README.md against the tree. Use before a push or a pull request into main, or when asked to "update the changelog", "bump the version", "cut a release", "prepare the merge", or "check the README is up to date".
---

# Preparing a release

A release is **one merge into `main`**. Three files move together before it: `CHANGELOG.md` gets an
entry, the root `package.json` gets the version that entry is headed with, and `README.md` is read
against what the branch changed. `pnpm check:docs` fails while the version and the top entry
disagree, so neither can land without the other.

The changelog is **curated, not generated**. A branch here runs to hundreds of commits whose
subjects describe steps, not outcomes; an entry says what a reader upgrading or returning to the
project needs, grouped by area. That is why there is no release tool in this repo.

## Steps

1. **Read the range.** The base is `main`:

   ```bash
   git log --no-merges --reverse --format='%h %ad %s' --date=short main..HEAD
   git diff --stat main...HEAD
   git describe --tags --abbrev=0        # the last released version
   ```

   If the top entry of `CHANGELOG.md` is already for a version above the last tag, the branch was
   prepared before — **extend that entry**, do not add a second one.

2. **Collect what changed, from the most reliable source down.** Commit subjects come last: they
   include work that was added and reverted, or fixed, inside the same range.

   | Source | Tells you |
   |---|---|
   | `git diff --name-status main...HEAD -- docs/adr` | every structural decision, with its reason — link each one |
   | `git diff main...HEAD -- packages/proto/pkg` | added, changed and **removed** RPCs, messages, fields |
   | `git diff main...HEAD -- backend/packages/event-bus/src/strategy` | added and removed events, payload shapes |
   | `git diff --name-status main...HEAD -- '**/src/migrations'` | schema changes |
   | `git diff main...HEAD -- docs/env.md '**/.env.example' docker-compose.yml` | new, renamed, removed and newly required variables |
   | `git diff --name-status --diff-filter=D main...HEAD` | what was removed |
   | the commit log | everything else — features, fixes, tooling |

3. **Pick the version.** Semantic Versioning, read for a deployed monorepo rather than a library:

   - **major** — an existing deployment or an existing client cannot move to this release
     unchanged: a removed or reshaped RPC, message or field; a removed event; a variable that is
     new and required, renamed, or removed; a broker, database or provider swap; a migration that
     needs a manual step.
   - **minor** — new RPCs, events, features, optional variables; nothing an upgrade has to act on.
   - **patch** — fixes, documentation, build and CI only.

   Only the root `package.json` carries a version. Every workspace stays at `0.0.0`: the monorepo
   is released whole.

4. **Write the entry** above the previous one, never inside it — a landed entry is history and is
   not edited.

   ```markdown
   ## [X.Y.Z] — YYYY-MM-DD — `branch-name`

   Two to five sentences: what this release is about.

   ### Upgrade notes      ← major only: what a deployment must do, one bullet per action
   ### Added
   ### Changed
   ### Removed
   ### Fixed
   ```

   - Group a long section by area with `####` (Event bus, Auth, Storage, Admin panel, Tooling…).
   - One bullet per outcome, not per commit. Lead with the thing in bold when the list is long.
   - Link the ADR that explains a change: `([ADR-0014](docs/adr/0014-….md))`. Do not restate its
     reasoning.
   - **Fixed** lists defects the previous release had. A bug introduced and fixed inside the range
     is not an entry; neither is a feature that was added and removed.
   - Every **Removed** and **Upgrade notes** bullet is confirmed by a diff from step 2, not by a
     commit subject.
   - The date is the day of the merge; correct it if the merge slips.

5. **Bump `version`** in the root `package.json` to the entry's.

6. **Read `README.md` against the tree.** It drifts quietly, since nothing generates it:

   - badges ↔ `engines.node`, `packageManager`, `turbo` and the catalog's `typescript`;
   - every `pnpm …` command it names ↔ the root `scripts`, and its one-line description ↔ what the
     script runs now; root scripts added in the range that a newcomer needs;
   - the two mermaid diagrams ↔ `EventBusStrategy`, the gRPC topology, what talks to Redis and to
     the provider;
   - the environment section ↔ `docs/env.md` — the README names which services need a variable and
     why, never a table of its own;
   - the tech stack and the project tree ↔ the top-level directories and the main dependencies;
   - the Documentation links resolve.

7. **Verify.**

   ```bash
   pnpm check:docs
   pnpm check:env-docs
   ```

## What this skill does not do

It does not commit or push — those wait for an explicit request. And it never tags: once the merge
lands on `main` and the run is green, the `tag` job of `.github/workflows/check.yaml` tags that
commit `vX.Y.Z` from the root version, unless the tag exists. A tag made by hand beforehand would
only make that job a no-op on the wrong commit.
