#!/usr/bin/env bash
# Fails when a migration snapshot changed since <base> without a new migration beside it.
#
#   scripts/snapshot-migrations.sh [--repo <dir>] <base>
#
# Only `migration:create` may move a snapshot (see backend/CLAUDE.md): one changed without a
# migration would make the next `migrate:create` drop whatever it lost. A change is judged by
# content, not by bytes — both sides are read through `jq -c .`, so reformatting a snapshot
# (prettier, an editor) is no change, while any value, key or key order that moves still is.
# A snapshot that is not valid JSON on either side counts as changed.
#
# The diff is `<base>...HEAD`, the pull request's own commits. Prints one `::error` line per
# offending snapshot, for the GitHub Actions log. Exits 1 on any, 2 on a usage error. Its specs are
# scripts/snapshot-migrations.test.sh. Needs bash, git and jq.
usage='usage: snapshot-migrations.sh [--repo <dir>] <base>'
usage_error() {
  echo "$usage" >&2
  exit 2
}
repo=$(dirname "${BASH_SOURCE[0]}")/..

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)
      [ -n "${2:-}" ] || usage_error
      repo=$2
      shift 2
      ;;
    -*)
      usage_error
      ;;
    *) break ;;
  esac
done
[ $# -eq 1 ] && [ -n "$1" ] || usage_error
base=$1
cd "$repo" || exit 2

changed() {
  git diff --name-only --no-renames "$@"
}

# The snapshot at <rev>, whitespace aside; empty when it is missing or not JSON.
content() {
  git show "$1:$2" 2>/dev/null | jq -c . 2>/dev/null
}

fork=$(git merge-base "$base" HEAD) || {
  echo "snapshot-migrations: no common ancestor of ${base} and HEAD" >&2
  exit 2
}

failed=0
while IFS= read -r snapshot; do
  [ -n "$snapshot" ] || continue
  dir=$(dirname "$snapshot")
  [ -z "$(changed --diff-filter=A "$fork" HEAD -- "$dir/*.migration.ts")" ] || continue
  before=$(content "$fork" "$snapshot")
  after=$(content HEAD "$snapshot")
  [ -n "$before" ] && [ "$before" = "$after" ] && continue
  echo "::error file=$snapshot::The snapshot changed without a new migration in $dir. Generate one with \`pnpm migrate:create\`."
  failed=1
done < <(changed --diff-filter=AM "$fork" HEAD -- 'backend/apps/*/src/migrations/.snapshot-*.json')
exit "$failed"
