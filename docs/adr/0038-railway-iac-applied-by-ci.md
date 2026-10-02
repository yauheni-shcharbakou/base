# 0038 — Railway is described by `.railway/railway.ts` and applied by our own CI job

**Status:** Accepted (2026-10-02)
**Applies to:** `.railway/`, `.github/workflows/check.yaml`

## Context

Each deployable app carried a `railway.toml` (Config as Code: builder, Dockerfile path, watch
patterns, restart policy). Railway deprecates it, with a hard cutoff on 2026-12-01, in favour of
Infrastructure as Code: one `.railway/railway.ts` that also owns the services, Postgres, Redis,
volumes and the variable names. The Railway UI has no field for such a file, and nobody runs
`railway config apply` by hand, so the file must be applied from CI. The repository is public.

Rejected alternatives:

- **`railwayapp/config@v1`.** It runs `npm install` at the repository root, which cannot resolve
  `workspace:*` and `catalog:` in a pnpm workspace; it installs the CLI at `latest`; its nested
  actions are tags, not commits; and it hands the pinned plan from the pull request to the merge
  through a workflow artifact, which anyone can download from a public repository. It applies only
  a plan a pull request made, so a direct push to `main` fails.
- **`railway config apply` by hand.** Drift between `main` and the environment is then the normal
  state.
- **Apply on the pull request, before the merge.** A red or abandoned pull request would have
  changed production.
- **`configFile: ""` in the code to get past the "already managed by railway.toml" check.** Tried:
  the check reads the service's stored config-file path, not the file.

## Decision

- `.railway/railway.ts` is the single authoring file; the four `railway.toml` files are gone and
  their settings live in each `service(...)`. Every variable is `preserve()`: no value is in the
  repository.
- `check.yaml` has two jobs. `railway-plan` runs on a pull request from this repository and prints
  `railway config plan` (values redacted) in the run's summary: no comment, no artifact.
  `railway-apply` runs on a push to `main` after `check`/`docs` have passed, plans, and applies that
  same plan file inside the job, so nothing is stored. The services deploy from the same push
  (`checkSuites`), so the configuration lands before the build.
- A plan with deletions is applied only when the pull request behind the commit has the label
  `railway:destructive`; otherwise the job fails. A variable added by hand in the dashboard is
  such a deletion until it is written into the file.
- The plan compares only what `railway.ts` declares, so an endpoint made in the dashboard (a public
  domain, a TCP proxy) is invisible to it, and leaving one out of the file does not close it. The
  last step of `railway-apply` reads `railway config pull --json` and fails on any endpoint kind not
  allowed per resource in `.railway/public-endpoints.json`
  (`scripts/check-railway-exposure.sh`). A TCP proxy is closed with an explicit `null`.
- The CLI (`RAILWAY_CLI_VERSION` in the workflow) and the `railway` SDK (root devDependency) are
  pinned and move together; Dependabot bumps the SDK, the CLI follows by hand. The token is a
  project token for `production`, the secret `RAILWAY_TOKEN`; the apply job runs in the GitHub
  environment `production`.

## Consequences

- The dashboard is no longer a place to change a service: an edit there is reverted or deleted by
  the next apply.
- A merge that touches only documentation still plans and applies (a no-op), because the job's gate
  is the push, not a path.
- Applying after the merge, not before, means a bad `railway.ts` is found on `main`, not on the
  pull request, unless the plan job caught it — it evaluates the same file against production.
- Two pushes in a row can race on the environment; the CLI refuses a plan whose `configEtag` has
  moved, and the re-run is the fix.
