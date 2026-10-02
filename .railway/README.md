# Railway infrastructure

`.railway/railway.ts` is the whole Railway project as code (Railway "Infrastructure as Code"): the
services and their build/deploy settings, Postgres, Redis, volumes, groups and the names of every
environment variable. It replaces the per-app `railway.toml` files (Config as Code, deprecated by
Railway). Why it is applied by our own CI job and not by Railway's action:
[ADR-0038](../docs/adr/0038-railway-iac-applied-by-ci.md).

## How a change reaches Railway

1. **Pull request** — the `railway-plan` job of `.github/workflows/check.yaml` runs
   `railway config plan` against production and prints it in the run's summary. Variable values are
   redacted. Fork and Dependabot pull requests get no secrets and skip it.
2. **Merge into `main`** — once `check` is green, the `railway-apply` job plans again and applies
   that plan. The services deploy from the same push (`checkSuites: true` makes Railway wait for the
   checks), so the new configuration is in place before the new build starts. A push that changes
   nothing in Railway plans no changes and applies nothing.
3. **Deletions need consent.** A plan that deletes anything — a service, or a variable that exists
   in the dashboard but not in `railway.ts` — fails the job unless the merged pull request carries
   the `railway:destructive` label (add it, then re-run the job).

Nobody runs `railway config apply` by hand in the normal flow.

## Rules for editing `railway.ts`

- **No secret values in this file — the repository is public.** A secret is `preserve()`: the value
  stays in Railway and is set in the dashboard. What is not secret is written down: literals
  (`NODE_ENV`, `PORT`, …) and references to what Railway provides (`Postgres.env.DATABASE_URL`,
  `Redis.env.REDIS_URL`). Never pull with `--include-variables`, and never pass `--show-values` or
  `--decrypt-variables` in CI. When unsure whether a value is a secret, it is.
- The file is typechecked by `pnpm check:railway` (a step of the `check` job): `.railway/` is no
  workspace, and the CLI strips types without checking them.
- **The file is the truth.** What the dashboard holds and the file does not (a service, a variable)
  is deleted by the next apply. Add it here first.
- **Public domains and TCP proxies (`serviceDomains`, `customDomains`, `tcpProxies`) are public
  on purpose or not at all:** each one exposes a service to the internet. Leaving one out of this
  file does **not** close it — only what is declared is compared, so an endpoint made in the
  dashboard stays. To close a TCP proxy, set it to `null` (`tcpProxies: { '5432': null }`). Which
  resources may be public is listed in `public-endpoints.json`, and the last step of the
  `railway-apply` job (`scripts/check-railway-exposure.sh`, reading `railway config pull --json`)
  fails when the environment exposes anything else. Widening that list is the reviewed change.
- Keep one authoring file; no `partial` export.
- A new service: add `service(...)` with `build` (`builder: "DOCKERFILE"`, `dockerfilePath`,
  `watchPatterns`) and `deploy`, put it in a `group`, and list its variables as `preserve()`.
- Local commands (`railway config plan`) need `railway login`, `railway link` and
  `pnpm install` at the root (the `railway` SDK is a root devDependency). Dependabot bumps the SDK
  monthly; the CLI (`RAILWAY_CLI_VERSION`, in both Railway jobs of the workflow) moves with it, by
  hand — a pull request that bumps the SDK is the reminder.

## One-time setup

- A Railway **project token** for the `production` environment, stored as the repository secret
  `RAILWAY_TOKEN`.
- The repository label `railway:destructive`.
- In each service's settings, no path under "Config-as-code": while one is set, Railway refuses to
  plan a service that two files describe.
