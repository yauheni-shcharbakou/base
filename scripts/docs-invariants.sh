#!/usr/bin/env bash
# The invariants of the docs layout described in the root CLAUDE.md. They are cheap, always
# true, and each one has already caught a real drift: a CLAUDE.md kept referencing
# @backend/nats and @backend/redis for weeks after those packages were renamed to
# @backend/event-bus-*.
#
#   1. every docs/ page linked from a CLAUDE.md exists (ADRs, the generated env page)
#   2. every ADR file appears in the docs/adr/README.md index
#   3. every @backend/* | @packages/* | @frontend/* name in a CLAUDE.md is a real workspace
#   4. the top entry of CHANGELOG.md is for the version in the root package.json
#   5. that entry can be published as it stands: it is not empty, its code fences close, and
#      every relative link in it names a file that exists
#
# Deliberately NOT checked: duplicated wording. That needs a bespoke marker list
# which goes stale faster than the docs do — dedup is an audit, not an invariant.
#
# One copy, two callers: CI (`pnpm check:docs`) and the Claude docs hook
# (.claude/hooks/check-docs-invariants.sh), which turns the same lines into a block decision.
# CI runs it on a code change as well as on a docs one — a renamed package breaks 3 without a
# single .md changing.
#
# Prints one line per violation and exits 1 when there is any. Needs bash, grep and awk alone:
# no jq, no node_modules.
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

# 4. The version and its changelog entry move together: a bump without an entry, or an entry
#    without a bump, is half a release. Only that the two agree — not that the version grew since
#    main, which would fail every pull request that releases nothing (Dependabot's).
if [ -f CHANGELOG.md ] && [ -f package.json ]; then
  version=$(grep -m1 -oE '"version": *"[^"]+"' package.json | grep -oE '[0-9][^"]*')
  entry=$(grep -m1 -oE '^## \[[^]]+\]' CHANGELOG.md | grep -oE '[0-9][^]]*')
  if [ "$version" != "$entry" ]; then
    report "CHANGELOG.md's top entry is [${entry:-none}], package.json's version is ${version:-none}"
  else
    # 5. The entry becomes the body of a GitHub Release once it lands on main, where nothing can
    #    be fixed before it is read. Asked of the script that shapes it; only of this entry — an
    #    older one was published as it was, and its links may have moved since.
    while IFS= read -r problem; do
      [ -n "$problem" ] && report "$problem"
    done < <(bash scripts/release-notes.sh --check "$version" 2>&1)
  fi
fi

if [ "$failed" -ne 0 ]; then
  echo 'Fix the reference, add the missing ADR/index row, or bring the version and the changelog together. See docs/adr/README.md and the /release skill.' >&2
fi

exit "$failed"
