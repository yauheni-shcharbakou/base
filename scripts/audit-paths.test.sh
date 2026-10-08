#!/usr/bin/env bash
# Specs of scripts/audit-paths.sh: where each advisory of a `pnpm audit --json` report sits.
#
# The reports are written inline, in the shape `pnpm audit --json` prints: `advisories` keyed by id, each with
# `patched_versions` (null when there is no fix), `findings[].version` and `findings[].paths`. A
# change of that shape upstream is what these specs exist to catch — update the reports from a real
# `pnpm audit --json`, not from the script.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash and jq.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2
script="$(pwd)/scripts/audit-paths.sh"

. scripts/lib/spec.sh
tab=$'\t'
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

# prints <name> <expected exit> <expected output> <report> [<arg>...] — the report goes on stdin.
prints() {
  local name=$1 expected_status=$2 expected=$3 report=$4 actual status
  shift 4
  actual=$(printf '%s' "$report" | bash "$script" "$@" 2>&1)
  status=$?
  matches "$expected_status" "$expected" "$status" "$actual"
}

# advisory <key> <GHSA> <severity> <package> <version> <patched> <path>... — one entry of
# `advisories`; a patched of `-` is null, the way pnpm reports an advisory with no fix.
advisory() {
  local key=$1 id=$2 severity=$3 pkg=$4 version=$5 patched=$6
  shift 6
  jq -cn --arg k "$key" --arg id "$id" --arg s "$severity" --arg m "$pkg" --arg v "$version" --arg p "$patched" \
    '{($k): {github_advisory_id: $id, severity: $s, module_name: $m,
      patched_versions: (if $p == "-" then null else $p end),
      findings: [{version: $v, paths: $ARGS.positional}]}}' \
    --args "$@"
}

# report <advisory>... — the advisories merged into one report.
report() { printf '%s\n' "$@" | jq -cs '{advisories: (add // {}), metadata: {}}'; }

transitive=$(advisory 1 GHSA-b 'high' minimatch-dep 1.1.15 '>=1.1.16' \
  'backend__apps__auth>@nestjs/cli>glob>minimatch>minimatch-dep' \
  'frontend__apps__admin>jest>glob>minimatch>minimatch-dep' \
  'frontend__apps__admin>eslint>minimatch>minimatch-dep')
prints 'a transitive advisory: workspaces, direct deps and parents, each once and sorted' 0 \
  "high${tab}GHSA-b${tab}minimatch-dep${tab}1.1.15${tab}1.1.16${tab}backend/apps/auth frontend/apps/admin${tab}via @nestjs/cli,eslint,jest${tab}minimatch" \
  "$(report "$transitive")"

direct=$(advisory 2 GHSA-d 'moderate' qs 6.1.0 '>=6.1.1' '.>qs' 'backend__apps__storage>qs' 'backend__apps__storage>express>qs')
prints 'a direct dependency says so, and its parents leave the workspaces out' 0 \
  "moderate${tab}GHSA-d${tab}qs${tab}6.1.0${tab}6.1.1${tab}. backend/apps/storage${tab}direct, via express${tab}express" \
  "$(report "$direct")"

only_direct=$(advisory 3 GHSA-o 'low' figlet 1.0.0 '>=1.0.1' 'packages__configs>figlet')
prints 'a dependency nobody else pulls in has no parents' 0 \
  "low${tab}GHSA-o${tab}figlet${tab}1.0.0${tab}1.0.1${tab}packages/configs${tab}direct${tab}-" \
  "$(report "$only_direct")"

prints 'rows run critical → low, then by package, then by advisory' 0 \
  "critical${tab}GHSA-c${tab}zlib${tab}1.0.0${tab}1.0.1${tab}.${tab}direct${tab}-
high${tab}GHSA-a${tab}aaa${tab}1.0.0${tab}1.0.1${tab}.${tab}direct${tab}-
high${tab}GHSA-b${tab}minimatch-dep${tab}1.1.15${tab}1.1.16${tab}backend/apps/auth frontend/apps/admin${tab}via @nestjs/cli,eslint,jest${tab}minimatch
low${tab}GHSA-o${tab}figlet${tab}1.0.0${tab}1.0.1${tab}packages/configs${tab}direct${tab}-" \
  "$(report "$only_direct" "$transitive" \
    "$(advisory 4 GHSA-c critical zlib 1.0.0 '>=1.0.1' '.>zlib')" \
    "$(advisory 5 GHSA-a high aaa 1.0.0 '>=1.0.1' '.>aaa')")"

# One GHSA, reported once per vulnerable range — the way pnpm splits it.
v1=$(advisory 1 GHSA-v high pkg 1.0.0 '>=1.0.5' '.>pkg')
v2=$(advisory 2 GHSA-v high pkg 2.0.0 '>=2.0.3' '.>x>pkg')
prints 'one advisory per vulnerable version, both kept' 0 \
  "high${tab}GHSA-v${tab}pkg${tab}1.0.0${tab}1.0.5${tab}.${tab}direct${tab}-
high${tab}GHSA-v${tab}pkg${tab}2.0.0${tab}2.0.3${tab}.${tab}via x${tab}x" \
  "$(report "$v2" "$v1")"

prints 'an advisory with no patched release says no fix' 0 \
  "high${tab}GHSA-n${tab}braces${tab}3.0.3${tab}no fix${tab}.${tab}via micromatch${tab}micromatch" \
  "$(report "$(advisory 1 GHSA-n high braces 3.0.3 - '.>micromatch>braces')")"

prints 'a patched range that is not a plain >= is shown as it is' 0 \
  "low${tab}GHSA-r${tab}pkg${tab}1.0.0${tab}^1.2.0 || >=2.0.1${tab}.${tab}direct${tab}-" \
  "$(report "$(advisory 1 GHSA-r low pkg 1.0.0 '^1.2.0 || >=2.0.1' '.>pkg')")"

# Three advisories of one package at 1.0.0 (fixed in 1.0.5, 1.9.2 and 1.10.0 — compared as versions,
# not strings), one at 2.0.0.
grouped=$(report "$v1" "$v2" \
  "$(advisory 13 GHSA-w moderate pkg 1.0.0 '>=1.10.0' 'packages__a>pkg')" \
  "$(advisory 14 GHSA-z low pkg 1.0.0 '>=1.9.2' '.>pkg')" \
  "$only_direct")
prints '--by-package merges a package into one row: highest severity, every GHSA and version' 0 \
  "high${tab}GHSA-v,GHSA-w,GHSA-z${tab}pkg${tab}1.0.0,2.0.0${tab}1.10.0,2.0.3${tab}. packages/a${tab}direct, via x${tab}x
low${tab}GHSA-o${tab}figlet${tab}1.0.0${tab}1.0.1${tab}packages/configs${tab}direct${tab}-" \
  "$grouped" --by-package

prints '--by-package: one advisory with no fix makes that version no fix' 0 \
  "high${tab}GHSA-n,GHSA-v${tab}pkg${tab}1.0.0${tab}no fix${tab}.${tab}direct${tab}-" \
  "$(report "$v1" "$(advisory 2 GHSA-n low pkg 1.0.0 - '.>pkg')")" --by-package

prints '--by-package sorts versions as versions' 0 \
  "low${tab}GHSA-a,GHSA-b${tab}pkg${tab}9.0.0,10.0.0${tab}9.0.1,10.0.1${tab}.${tab}direct${tab}-" \
  "$(report "$(advisory 1 GHSA-a low pkg 10.0.0 '>=10.0.1' '.>pkg')" "$(advisory 2 GHSA-b low pkg 9.0.0 '>=9.0.1' '.>pkg')")" --by-package

report "$only_direct" >"$scratch/report.json"
prints 'the report can be a file argument' 0 \
  "low${tab}GHSA-o${tab}figlet${tab}1.0.0${tab}1.0.1${tab}packages/configs${tab}direct${tab}-" \
  '' "$scratch/report.json"

prints 'a clean report prints nothing' 0 '' '{"actions":[],"advisories":{},"muted":[],"metadata":{}}'
prints 'a clean report prints nothing with --by-package too' 0 '' '{"advisories":{}}' --by-package

prints 'output that is not JSON is an error' 2 'audit-paths: stdin is not a pnpm audit --json report' 'ERR_PNPM_AUDIT_BAD_RESPONSE'

prints 'JSON without advisories is an error' 2 'audit-paths: stdin is not a pnpm audit --json report' '{"error":"x"}'

usage='usage: audit-paths.sh [--by-package] [--prod-report <prod.json>] [<report.json>]'
prints 'more than one argument is an error' 2 "$usage" '' a b
prints 'an unknown flag is an error' 2 "$usage" '' --dev

# The whole tree has GHSA-v at 1.0.0 and 2.0.0; production only at 1.0.0.
whole=$(report "$v1" "$v2" "$only_direct")
report "$v1" >"$scratch/prod.json"
prints 'with --prod-report, scope is prod only for a GHSA at a version production has' 0 \
  "high${tab}GHSA-v${tab}pkg${tab}prod${tab}1.0.0${tab}1.0.5${tab}.${tab}direct${tab}-
high${tab}GHSA-v${tab}pkg${tab}dev${tab}2.0.0${tab}2.0.3${tab}.${tab}via x${tab}x
low${tab}GHSA-o${tab}figlet${tab}dev${tab}1.0.0${tab}1.0.1${tab}packages/configs${tab}direct${tab}-" \
  "$whole" --prod-report "$scratch/prod.json"

prints '--by-package keeps a package prod and dev apart' 0 \
  "high${tab}GHSA-v${tab}pkg${tab}prod${tab}1.0.0${tab}1.0.5${tab}.${tab}direct${tab}-
high${tab}GHSA-v${tab}pkg${tab}dev${tab}2.0.0${tab}2.0.3${tab}.${tab}via x${tab}x
low${tab}GHSA-o${tab}figlet${tab}dev${tab}1.0.0${tab}1.0.1${tab}packages/configs${tab}direct${tab}-" \
  "$whole" --by-package --prod-report "$scratch/prod.json"

report >"$scratch/clean.json"
prints 'a clean production report makes every row dev' 0 \
  "low${tab}GHSA-o${tab}figlet${tab}dev${tab}1.0.0${tab}1.0.1${tab}packages/configs${tab}direct${tab}-" \
  "$(report "$only_direct")" --prod-report "$scratch/clean.json"

echo 'ERR_PNPM_AUDIT_BAD_RESPONSE' >"$scratch/bad.json"
prints 'a production report that is not one is an error' 2 \
  "audit-paths: $scratch/bad.json is not a pnpm audit --json report" \
  "$(report "$only_direct")" --prod-report "$scratch/bad.json"

prints '--prod-report needs a file' 2 "$usage" '' --prod-report

finish audit-paths
