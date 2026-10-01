#!/usr/bin/env bash
# The invariants of the docs layout described in the root CLAUDE.md. They are cheap, always
# true, and each one has already caught a real drift: a CLAUDE.md kept referencing
# @backend/nats and @backend/redis for weeks after those packages were renamed to
# @backend/event-bus-*.
#
#   1. every docs/ page linked from a CLAUDE.md exists (ADRs, the generated env page)
#   2. every ADR file appears in the docs/adr/README.md index
#   3. every @backend/* | @packages/* | @frontend/* name in a CLAUDE.md is a real workspace
#
# Deliberately NOT checked: duplicated wording. That needs a bespoke marker list
# which goes stale faster than the docs do — dedup is an audit, not an invariant.
#
# One copy, two callers: CI (`pnpm check:docs`) and the Claude docs hook
# (.claude/hooks/check-docs-invariants.sh), which turns the same lines into a block decision.
# CI runs it on a code change as well as on a docs one — a renamed package breaks 3 without a
# single .md changing.
#
# Prints one line per violation and exits 1 when there is any. Needs bash and grep alone: no
# jq, no node_modules.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

grep_docs() {
  grep -rhoE "$1" --include=CLAUDE.md \
    --exclude-dir=.claude --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null | sort -u
}

failed=0

report() {
  # An annotation on the run's summary in CI; a plain line for the hook and a terminal.
  if [ -n "$GITHUB_ACTIONS" ]; then
    echo "::error::$1"
  else
    echo "$1"
  fi
  failed=1
}

# 1. Links into docs/ resolve (ADRs and the generated env page).
while IFS= read -r link; do
  [ -n "$link" ] || continue
  [ -f "$link" ] || report "dangling docs link: ${link}"
done < <(grep_docs 'docs/(adr/[0-9a-z-]+|env)\.md')

# 2. Every ADR is listed in the index.
if [ -f docs/adr/README.md ]; then
  for adr in docs/adr/[0-9]*.md; do
    [ -e "$adr" ] || continue
    grep -q "$(basename "$adr")" docs/adr/README.md ||
      report "ADR not in the docs/adr/README.md index: ${adr}"
  done
fi

# 3. Referenced workspaces exist. A match ending in "/" is a path fragment
#    (@packages/configs/eslint/…), not a package reference — skipped.
while IFS= read -r name; do
  [ -n "$name" ] || continue
  case "$name" in */) continue ;; esac
  short=${name#*/}
  if [ ! -d "backend/packages/$short" ] &&
    [ ! -d "packages/$short" ] &&
    [ ! -d "frontend/packages/$short" ]; then
    report "unknown workspace referenced: ${name}"
  fi
done < <(grep_docs '@(backend|packages|frontend)/[a-z][a-z0-9-]*/?')

if [ "$failed" -ne 0 ]; then
  echo 'Fix the reference or add the missing ADR/index row. See docs/adr/README.md.' >&2
fi

exit "$failed"
