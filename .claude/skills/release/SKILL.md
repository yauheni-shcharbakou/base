---
name: release
description: Prepare a branch for its merge into main — write the CHANGELOG.md entry for everything since main, bump the root version, check README.md against the tree, and commit the result once the checks pass. Use before a push or a pull request into main, or when asked to "update the changelog", "bump the version", "cut a release", "prepare the merge", or "check the README is up to date".
---

# Preparing a release

A release is **one merge into `main`**. Three files move together before it: `CHANGELOG.md` gets an
entry, the root `package.json` gets the version that entry is headed with, and `README.md` is read
against what the branch changed. `pnpm check:docs` fails while the version and the top entry
disagree, so neither can land without the other — and while the entry would publish badly: it is
empty, a code fence in it never closes, or a relative link in it names a file that does not exist.
Once the checks pass, the skill commits what it prepared — `/release` ends with a release commit,
not with a tree left to commit by hand.

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
   bash scripts/release-notes.sh X.Y.Z   # the entry as the GitHub Release will show it
   ```

   `check:docs` has already run that script with `--check`, so a dead link or an unclosed fence is
   reported there. What no check can see is left to the last command — read it through: it joins
   wrapped lines, so a line that was meant to start a list item or a heading but lacks its marker
   shows up glued to the line above.

8. **Commit**, once step 7 passes — invoking the skill is the request for it. While a check fails
   there is no commit: fix what it names and run step 7 again, never around it (`--no-verify`).

   ```bash
   git add CHANGELOG.md package.json     # and README.md, when step 6 changed it
   git commit -m 'chore: release X.Y.Z'
   ```

   - **Stage by name, never `git add -A`.** Whatever else is uncommitted in the tree is not the
     release: leave it where it is and say so in the report.
   - **A prepared branch gets a second commit, never an amend.** When step 1 found the entry
     already there and extended it, the earlier release commit may be pushed; the new one carries
     the same subject.
   - Report the commit's hash, and whether the branch is ahead of its remote.

## What this skill does not do

It does not push or open a pull request — those wait for an explicit request. And it never tags or
publishes: once the merge lands on `main` and the run is green, the `release` job of
`.github/workflows/main.yaml` tags that commit `vX.Y.Z` from the root version and publishes a
GitHub Release, each unless it exists. A tag made by hand beforehand would only leave it on the
wrong commit.

The Release's body is the entry, through `scripts/release-notes.sh` — so the entry is the release
notes, and a correction after the merge is a correction of the published Release too (edit it on
GitHub; the job does not overwrite one that exists).
