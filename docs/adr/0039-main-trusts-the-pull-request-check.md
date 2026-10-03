# 0039 — A push to main trusts the pull request's check; turbo shares one remote cache

**Status:** Accepted (2026-10-03)
**Applies to:** `.github/workflows/check.yaml`, `.github/workflows/main.yaml`, `.github/actions/`

## Context

One workflow, `check.yaml`, ran on every pull request into `main` and again on the push its merge
made. The ruleset already refuses a push to `main` without a pull request whose `check` passed, so the
second run repeated a verdict: the same build, lint, unit and e2e suites, three service containers,
3.5–4 minutes on a warm cache, 7–8 on a cold one, before Railway (which waits for the commit's check
suites) could deploy.

It was not quite the same tree, though. The ruleset did not require a branch to be up to date with
`main` before merging, so two pull requests green on their own could merge into a `main` neither was
tested as. The second run was the only check of that tree.

The push run had a second job that a pull request cannot do: warming the turbo cache. A GitHub
Actions cache is scoped to a ref. A pull request reads its own and its base's entries, never another
pull request's, so what a merged pull request built is out of reach of the next one until `main`
builds it under its own scope. Most of a cold run is that build (178 s) and `typecheck` (39 s).

Rejected alternatives:

- **Keep one workflow and skip steps on push.** It was already half that: `if: github.event_name`
  on steps and jobs, and `release`/`railway-apply` needs-chains built around jobs that are skipped
  on one event and required on the other. Two triggers with two concurrency policies (cancel on a
  pull request, queue on `main`) read more plainly as two files.
- **Only the GitHub Actions cache.** Scoped by ref, it leaves `main` rebuilding whatever a pull
  request built — up to ~3.5 minutes after a dependency bump — and every new pull request starting
  from `main`'s entries, never a sibling's.
- **A Vercel personal access token for the remote cache.** A long-lived secret in a public
  repository, tied to a user rather than to the pipeline. The OIDC exchange below needs none.
- **A self-hosted cache server** (`ducktors/turborepo-remote-cache` and the like). One more service
  to run and secure for a personal site, where Vercel's is free on the Hobby plan.
- **A merge queue.** It tests the merged tree before it lands, without forcing an update of every
  branch. GitHub offers it to organization-owned repositories only; this one belongs to a user.

## Decision

- The ruleset on `main` requires a branch to be **up to date** before it merges. The tree a merge
  lands is then the tree `check` passed, whichever merge method is used.
- `check.yaml` runs on `pull_request` only, unchanged in what it verifies. Typecheck, lint, unit and
  e2e run as one turbo invocation instead of four sequential steps.
- `main.yaml` runs on `push` to `main`: `changes` → `build` (`turbo run build typecheck`, no
  services, no lint, no tests — only what is cacheable, to warm `main`'s scope) → `railway-apply`
  → `release`. A push that changed no code skips `build` and still applies and releases.
- Both workflows read and write **Vercel Remote Cache**, in the free Hobby team every Vercel
  account has. `vercel/setup-turborepo-remote-cache-action` exchanges the job's GitHub OIDC token
  for a short-lived Turborepo token, against a "Turborepo CLI" OIDC policy in the team that names
  this repository (any workflow, any branch: a pull request runs on `refs/pull/<n>/merge`). The
  team slug is the repository variable `TURBO_TEAM`; with it unset, the step is skipped. The step is
  `continue-on-error` and skipped for a fork, which GitHub gives no OIDC token. The
  `actions/cache` of `.turbo/cache` stays beside it as the fallback, and `main.yaml` still builds
  to keep `main`'s scope of it warm.
- The steps both workflows share are local composite actions: `.github/actions/setup` (pnpm and
  node.js) and `.github/actions/protoc` (the release binary at a pinned version, in place of
  `apt-get update && apt-get install`, which alone cost ten seconds a run).

## Consequences

- A push to `main` replays what the pull request built and takes about a minute, a dependency bump
  included; without the remote cache (the exchange failed) it is back to up to ~3.5 minutes of build
  and typecheck, never the tests. Railway deploys that much sooner. Pull requests share entries
  with one another and with `main`.
- The Hobby plan allows 100 artifact requests a minute. Two runs at once can reach it; turbo reads a
  refused request as a miss, so the cost is time, not a failure. Artifacts expire after 7 days.
- Whoever can push a branch here can write artifacts `main` will replay — today, only the owner. A
  poisoned cache is cleared in the team's Build and Deployment settings. Artifact signing
  (`TURBO_REMOTE_CACHE_SIGNATURE_KEY`) is not enabled: it would need a stored secret, the thing OIDC
  avoids.
- **`main` is tested only as long as the up-to-date rule holds.** Turning it off brings back the
  merged-but-untested tree without anything in CI noticing. The rule lives in the repository's
  ruleset, not in this repository's files, so only the root `CLAUDE.md` and this ADR record it.
- A pull request has to be updated whenever `main` moves before it can merge — one extra click, or
  one extra Dependabot rebase.
- A direct push to `main` (by an admin who bypasses the ruleset) is not checked at all.
- The README badge follows `main.yaml`: `check.yaml` no longer runs on `main`.
- Dependabot watches `.github/actions/*` as well as `/`, or the pinned actions inside the composites
  would never move. protoc moves by hand, like `RAILWAY_CLI_VERSION`.
- Related: [0038](0038-railway-iac-applied-by-ci.md) — the plan and apply jobs it introduced are
  now one per workflow.
