#!/usr/bin/env bash
# A released changelog entry is frozen: the entry of every version tagged `v<version>` must read as
# it did in that tag.
#
#   scripts/released-entries.sh [--repo <dir>]
#
# On a green push to main the `release` job tags the commit and publishes the entry, as it is in
# that commit, as the body of a GitHub Release. Nothing re-reads it afterwards, so an edit to the
# entry later only parts the file from what was published. A correction goes into the next entry.
# Compared against the tag rather than the Release body: the body is made from the tagged entry,
# and asking GitHub for it would need the network and a token here.
#
# An entry is everything from `## [<version>]` up to the next `## [`, its heading (date, branch)
# included and its trailing blank lines not. Prints one line per entry edited or removed — with a
# diff on stderr, for whoever reads a terminal — and exits 1 when there is any.
#
# The tags are the local ones, never asked of the remote: the Claude docs hook runs this on every
# edit to CHANGELOG.md, where a network call would be slow and could fail. CI fetches the tags with
# its checkout, and fails here if it did not, rather than comparing nothing.
#
# Three callers: scripts/docs-invariants.sh (invariant 6), the Claude docs hook, and its specs,
# scripts/released-entries.test.sh, which point `--repo` at a scratch repository. Needs bash, git
# and awk alone.
repo="$(dirname "${BASH_SOURCE[0]}")/.."
usage='usage: released-entries.sh [--repo <dir>]'
usage_error() {
  echo "$usage" >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)
      [ -n "${2:-}" ] || usage_error
      repo=$2
      shift 2
      ;;
    *)
      usage_error
      ;;
  esac
done

cd "$repo" || exit 2
# Outside a clone (a Docker build context) there are no tags to hold anything to.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -f CHANGELOG.md ] || exit 0

# entry <version>: that version's entry from the changelog on stdin. A blank line is held until the
# next line of text, so none trails the entry.
entry() {
  awk -v version="$1" '
    /^## \[/ {
      if (found) exit
      if (index($0, "## [" version "]") == 1) found = 1
    }
    !found { next }
    /^[ \t]*$/ { blanks = blanks $0 "\n"; next }
    { printf "%s", blanks; blanks = ""; print }
  '
}

failed=0
tags=$(git tag -l 'v[0-9]*')

if [ -z "$tags" ] && [ -n "$GITHUB_ACTIONS" ]; then
  echo 'no release tags fetched: the checkout must fetch them (fetch-depth: 0, or fetch-tags: true)'
  exit 1
fi

for tag in $tags; do
  version=${tag#v}
  # A tag from before the changelog, or without an entry of its own, has nothing to hold.
  released=$(git show "${tag}:CHANGELOG.md" 2>/dev/null | entry "$version")
  [ -n "$released" ] || continue

  current=$(entry "$version" <CHANGELOG.md)
  if [ -z "$current" ]; then
    echo "CHANGELOG.md [${version}]: the entry released in ${tag} is gone"
    failed=1
  elif [ "$current" != "$released" ]; then
    echo "CHANGELOG.md [${version}]: the entry differs from the one released in ${tag}; put a correction in the next entry"
    diff -u --label "${tag}:CHANGELOG.md" --label CHANGELOG.md \
      <(printf '%s\n' "$released") <(printf '%s\n' "$current") >&2
    failed=1
  fi
done

exit "$failed"
