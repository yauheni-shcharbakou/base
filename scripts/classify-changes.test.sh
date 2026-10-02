#!/usr/bin/env bash
# Specs of scripts/classify-changes.sh: which of CI's jobs a set of changed paths asks for.
#
# A wrong answer here is silent in both directions — a path read as docs skips the build and the
# tests, a path read as code costs a run — so each kind of path is written down with the answer it
# must get, and compared whole.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash alone.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

passed=0
failed=0

# classifies <name> <expected "code docs railway"> <path>... — the paths go in one per line; none
# at all is an empty diff.
classifies() {
  local name=$1 expected=$2 actual
  shift 2
  actual=$(printf '%s\n' "$@" | { [ "$#" -gt 0 ] && cat || true; } | bash scripts/classify-changes.sh | sed 's/^[a-z]*=//' | tr '\n' ' ')
  actual=${actual% }
  if [ "$actual" = "$expected" ]; then
    passed=$((passed + 1))
  else
    echo "FAIL: ${name} — got \"${actual}\" (code docs railway), expected \"${expected}\""
    failed=$((failed + 1))
  fi
}

classifies 'a source file is code' 'true false false' backend/apps/auth/src/main.ts
classifies 'a path nobody named is code' 'true false false' some/new/place/file.bin
classifies 'a markdown file is docs' 'false true false' CHANGELOG.md docs/adr/0001-x.md
classifies "Claude's own files are nothing" 'false false false' .claude/settings.json .claude/plans/x.md
classifies 'a plan is not a doc' 'false false false' .claude/plans/x.md
classifies 'railway.ts alone is railway' 'false false true' .railway/railway.ts
classifies 'the exposure guard is code, its spec runs in check' 'true false false' scripts/check-railway-exposure.sh
classifies 'the allow-list is railway' 'false false true' .railway/public-endpoints.json
classifies 'the railway README is docs' 'false true false' .railway/README.md
classifies 'railway and docs together' 'false true true' .railway/railway.ts CHANGELOG.md
classifies 'one code path makes it code' 'true false true' .railway/railway.ts package.json
classifies 'the workflow is code' 'true false false' .github/workflows/check.yaml
classifies 'an empty diff is code' 'true false false'

if [ "$failed" -gt 0 ]; then
  echo "${failed} failed, ${passed} passed."
  exit 1
fi
echo "classify-changes: ${passed} specs passed."
