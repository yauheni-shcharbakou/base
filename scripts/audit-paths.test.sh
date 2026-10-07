#!/usr/bin/env bash
# Specs of scripts/audit-paths.sh: where each advisory of a `pnpm audit --json` report sits.
#
# The reports are written inline, in the shape `pnpm audit --json` prints: `advisories` keyed by id, each with
# `findings[].version` and `findings[].paths`. A change of that shape upstream is what these specs
# exist to catch — update the reports from a real `pnpm audit --json`, not from the script.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash and jq.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2
script="$(pwd)/scripts/audit-paths.sh"

passed=0
failed=0
tab=$'\t'
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

# prints <name> <expected exit> <expected output> <report> [<arg>...] — the report goes on stdin.
prints() {
  local name=$1 expected_status=$2 expected=$3 report=$4 actual status
  shift 4
  actual=$(printf '%s' "$report" | bash "$script" "$@" 2>&1)
  status=$?
  if [ "$actual" = "$expected" ] && [ "$status" = "$expected_status" ]; then
    passed=$((passed + 1))
  else
    echo "FAIL: ${name} — exit ${status}, expected ${expected_status}; got:"
    echo "$actual" | sed 's/^/    /'
    echo "  expected:"
    echo "$expected" | sed 's/^/    /'
    failed=$((failed + 1))
  fi
}

# advisory <id> <severity> <package> <version> <path>... — one entry of `advisories`.
advisory() {
  local id=$1 severity=$2 pkg=$3 version=$4
  shift 4
  jq -cn --arg id "$id" --arg s "$severity" --arg m "$pkg" --arg v "$version" \
    '{($id): {github_advisory_id: $id, severity: $s, module_name: $m, findings: [{version: $v, paths: $ARGS.positional}]}}' \
    --args "$@"
}

# report <advisory>... — the advisories merged into one report.
report() { printf '%s\n' "$@" | jq -cs '{advisories: (add // {}), metadata: {}}'; }

transitive=$(advisory GHSA-b 'high' minimatch-dep 1.1.15 \
  'backend__apps__auth>@nestjs/cli>glob>minimatch>minimatch-dep' \
  'frontend__apps__admin>jest>glob>minimatch>minimatch-dep' \
  'frontend__apps__admin>eslint>minimatch>minimatch-dep')
prints 'a transitive advisory: workspaces, direct deps and parents, each once and sorted' 0 \
  "high${tab}GHSA-b${tab}minimatch-dep${tab}1.1.15${tab}backend/apps/auth frontend/apps/admin${tab}via @nestjs/cli,eslint,jest${tab}minimatch" \
  "$(report "$transitive")"

direct=$(advisory GHSA-d 'moderate' qs 6.1.0 '.>qs' 'backend__apps__storage>qs' 'backend__apps__storage>express>qs')
prints 'a direct dependency says so, and its parents leave the workspaces out' 0 \
  "moderate${tab}GHSA-d${tab}qs${tab}6.1.0${tab}. backend/apps/storage${tab}direct, via express${tab}express" \
  "$(report "$direct")"

only_direct=$(advisory GHSA-o 'low' figlet 1.0.0 'packages__configs>figlet')
prints 'a dependency nobody else pulls in has no parents' 0 \
  "low${tab}GHSA-o${tab}figlet${tab}1.0.0${tab}packages/configs${tab}direct${tab}-" \
  "$(report "$only_direct")"

prints 'rows run critical → low, then by package, then by advisory' 0 \
  "critical${tab}GHSA-c${tab}zlib${tab}1.0.0${tab}.${tab}direct${tab}-
high${tab}GHSA-a${tab}aaa${tab}1.0.0${tab}.${tab}direct${tab}-
high${tab}GHSA-b${tab}minimatch-dep${tab}1.1.15${tab}backend/apps/auth frontend/apps/admin${tab}via @nestjs/cli,eslint,jest${tab}minimatch
low${tab}GHSA-o${tab}figlet${tab}1.0.0${tab}packages/configs${tab}direct${tab}-" \
  "$(report "$only_direct" "$transitive" \
    "$(advisory GHSA-c critical zlib 1.0.0 '.>zlib')" \
    "$(advisory GHSA-a high aaa 1.0.0 '.>aaa')")"

prints 'one advisory per vulnerable version, both kept' 0 \
  "high${tab}GHSA-v${tab}pkg${tab}1.0.0${tab}.${tab}direct${tab}-
high${tab}GHSA-v${tab}pkg${tab}2.0.0${tab}.${tab}via x${tab}x" \
  "$(report "$(advisory 2 high pkg 2.0.0 '.>x>pkg' | jq -c '.["2"].github_advisory_id = "GHSA-v"')" \
    "$(advisory 1 high pkg 1.0.0 '.>pkg' | jq -c '.["1"].github_advisory_id = "GHSA-v"')")"

report "$only_direct" >"$scratch/report.json"
prints 'the report can be a file argument' 0 \
  "low${tab}GHSA-o${tab}figlet${tab}1.0.0${tab}packages/configs${tab}direct${tab}-" \
  '' "$scratch/report.json"

prints 'a clean report prints nothing' 0 '' '{"actions":[],"advisories":{},"muted":[],"metadata":{}}'

prints 'output that is not JSON is an error' 2 'audit-paths: stdin is not a pnpm audit --json report' 'ERR_PNPM_AUDIT_BAD_RESPONSE'

prints 'JSON without advisories is an error' 2 'audit-paths: stdin is not a pnpm audit --json report' '{"error":"x"}'

prints 'more than one argument is an error' 2 'usage: audit-paths.sh [<report.json>]' '' a b

if [ "$failed" -gt 0 ]; then
  echo "${failed} failed, ${passed} passed."
  exit 1
fi
echo "audit-paths: ${passed} specs passed."
