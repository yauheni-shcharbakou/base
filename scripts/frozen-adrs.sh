#!/usr/bin/env bash
# A merged ADR is immutable but for its status line: every `docs/adr/NNNN-*.md` on main must read
# the same here, save the one `**Status:**` line a superseding ADR moves (docs/adr/README.md).
#
#   scripts/frozen-adrs.sh [--repo <dir>] [--base <ref>]
#
# The base is `origin/main` — the ADRs that have landed; one a branch adds is still its own to
# edit. The status line is blanked on both sides rather than dropped, so removing it is an edit
# too. An ADR gone from the tree (deleted, or renamed: links to it break) is an edit as well — a
# superseded ADR stays, and its number is never reused.
#
# Prints one line per ADR edited or removed — with a diff on stderr, for whoever reads a terminal —
# and exits 1 when there is any. Without the base ref there is nothing to compare with: locally that
# passes (a clone that never fetched main), in CI it fails, rather than comparing nothing.
#
# Two callers: scripts/docs-invariants.sh (invariant 7, so the Claude docs hook too, on an edit to
# an ADR) and its specs, scripts/frozen-adrs.test.sh, which point `--repo` at a scratch repository.
# Needs bash, git and awk alone.
repo="$(dirname "${BASH_SOURCE[0]}")/.."
base=origin/main
usage='usage: frozen-adrs.sh [--repo <dir>] [--base <ref>]'

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)
      repo=${2:?$usage}
      shift 2
      ;;
    --base)
      base=${2:?$usage}
      shift 2
      ;;
    *)
      echo "$usage" >&2
      exit 2
      ;;
  esac
done

cd "$repo" || exit 2
# Outside a clone (a Docker build context) there is no main to hold anything to.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  if [ -n "$GITHUB_ACTIONS" ]; then
    echo "no ${base} to hold the ADRs to: the checkout must fetch it"
    exit 1
  fi
  exit 0
fi

# The ADR with its status line blanked: everything else in it is frozen.
frozen() {
  awk '{ if ($0 ~ /^\*\*Status:\*\*/) print "**Status:**"; else print }'
}

failed=0

while IFS= read -r adr; do
  [ -n "$adr" ] || continue
  if [ ! -f "$adr" ]; then
    echo "${adr}: a merged ADR is gone; supersede it with a new one instead"
    failed=1
    continue
  fi
  landed=$(git show "${base}:${adr}" | frozen)
  current=$(frozen <"$adr")
  if [ "$current" != "$landed" ]; then
    echo "${adr}: a merged ADR changed beyond its status line; record the new decision in a new ADR"
    diff -u --label "${base}:${adr}" --label "$adr" \
      <(printf '%s\n' "$landed") <(printf '%s\n' "$current") >&2
    failed=1
  fi
done < <(git ls-tree --name-only "$base" -- docs/adr/ | grep -E '^docs/adr/[0-9]{4}-[^/]*\.md$')

exit "$failed"
