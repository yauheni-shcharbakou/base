#!/usr/bin/env bash
# Which entries of `overrides:` in pnpm-workspace.yaml the tree no longer needs.
#
#   scripts/stale-overrides.sh [--dev] [--repo <dir>] [<pkg>...]
#
# An override pins a transitive version nobody upgrades again, so each one has to keep earning its
# place. For every entry (or only the named ones) the script drops that one line, re-resolves the
# lockfile (`pnpm install --lockfile-only`), and asks two questions of the tree without it:
#
#   - does `pnpm audit --prod` report an advisory for the package that the tree with every override
#     does not report (the baseline, audited once before the first entry)?
#   - does the lockfile resolve any copy of it below the pinned version?
#
# Both no → the override is stale. The baseline is what makes `--dev` usable: it audits the whole
# tree, devDependencies included (no `--prod`), where advisories nobody has fixed yet already exist
# and must not make every override on that package look needed. An unreadable baseline counts as
# empty, which can only turn a stale verdict into a needed one. Prints one line per entry — `stale <pkg>`, `needed <pkg>: <why>`,
# `kept <pkg>: <why>` or `skipped <pkg>: <why>` — and exits 1 when any is stale. An entry with a
# comment right above it is kept unjudged: the comment is a person's reason, which no resolve can
# overrule, and its first line is the `<why>`. Only an exact pin (`1.2.3`) on a plain package name
# is judged; a range or a selector (`a>b`, `a@<2`) is skipped, not guessed at.
#
# The two files are copied aside first and restored after every entry and on exit, whatever
# happens: the tree is left as it was found, uncommitted edits included. `node_modules` is never
# touched. Needs the registry (audit, resolution), so it is not part of any check: the `/audit`
# skill runs it. Its specs, scripts/stale-overrides.test.sh, put a fake `pnpm` first on PATH and
# point `--repo` at a scratch directory. Needs bash, awk, jq and sort -V.
repo="$(dirname "${BASH_SOURCE[0]}")/.."
usage='usage: stale-overrides.sh [--dev] [--repo <dir>] [<pkg>...]'
usage_error() {
  echo "$usage" >&2
  exit 2
}
only=()
scope=(--prod)

while [ $# -gt 0 ]; do
  case "$1" in
    --dev)
      scope=()
      shift
      ;;
    --repo)
      [ -n "${2:-}" ] || usage_error
      repo=$2
      shift 2
      ;;
    -*)
      usage_error
      ;;
    *)
      only+=("$1")
      shift
      ;;
  esac
done

cd "$repo" || exit 2
for file in pnpm-workspace.yaml pnpm-lock.yaml; do
  [ -f "$file" ] || {
    echo "no ${file} in $(pwd)" >&2
    exit 2
  }
done

backup=$(mktemp -d)
cp pnpm-workspace.yaml pnpm-lock.yaml "$backup/"
restore() { cp "$backup/pnpm-workspace.yaml" "$backup/pnpm-lock.yaml" .; }
trap 'restore; rm -rf "$backup"' EXIT

# "<line number>\t<key>\t<value>\t<reason>" per entry of the top-level `overrides:` block, quotes
# stripped; the reason is the first line of the comment right above the entry, or empty.
entries=$(awk '
  /^overrides:/ { block = 1; next }
  block && /^[^ #]/ { block = 0 }
  !block { next }
  /^  #/ {
    if (reason == "") { reason = $0; sub(/^  #[ \t]*/, "", reason) }
    next
  }
  !/^  [^ #]/ { reason = ""; next }
  {
    line = $0
    sub(/^  /, "", line)
    sub(/[ \t]+#.*$/, "", line)
    split_at = index(line, ": ")
    key = substr(line, 1, split_at - 1)
    value = substr(line, split_at + 2)
    gsub(/^[\x27"]|[\x27"]$/, "", key)
    gsub(/^[\x27"]|[\x27"]$/, "", value)
    printf "%d\t%s\t%s\t%s\n", NR, key, value, reason
    reason = ""
  }
' pnpm-workspace.yaml)

# Every version of <pkg> the lockfile resolves, from its `packages:` and `snapshots:` keys
# (`  qs@6.16.0:`, `  '@grpc/grpc-js@1.14.5(peer@1.0.0)':`). Not `pnpm why`: it reads
# node_modules, which a lockfile-only install leaves as it was.
resolved() {
  awk -v p="$1" '
    /^  [^ ]/ {
      key = substr($0, 3)
      sub(/^\x27/, "", key)
      if (substr(key, 1, length(p) + 1) != p "@") next
      version = substr(key, length(p) + 2)
      sub(/[(\x27:].*$/, "", version)
      if (version ~ /^[0-9]/) print version
    }
  ' pnpm-lock.yaml | sort -uV
}

# `pnpm audit` exits non-zero when it finds anything; only unreadable output is an error.
audit() { pnpm audit "${scope[@]}" --json 2>/dev/null; }

# {"<pkg>": ["GHSA-…", …]} the tree reports with every override in place.
baseline=$(audit | jq -c \
  'reduce (.advisories[]? | select(.module_name)) as $a ({}; .[$a.module_name] += [$a.github_advisory_id])' \
  2>/dev/null) || baseline='{}'
[ -n "$baseline" ] || baseline='{}'

stale=0

while IFS=$'\t' read -r line pkg pin reason; do
  [ -n "$pkg" ] || continue
  if [ "${#only[@]}" -gt 0 ] && ! printf '%s\n' "${only[@]}" | grep -Fxq -- "$pkg"; then
    continue
  fi
  if [ -n "$reason" ]; then
    echo "kept ${pkg}: ${reason}"
    continue
  fi
  if [[ "${pkg#@}" == *[@\>]* ]]; then
    echo "skipped ${pkg}: a selector, not a package name"
    continue
  fi
  if ! [[ "$pin" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "skipped ${pkg}: '${pin}' is not an exact version"
    continue
  fi

  awk -v drop="$line" 'NR != drop' "$backup/pnpm-workspace.yaml" >pnpm-workspace.yaml
  if ! pnpm install --lockfile-only --ignore-scripts >/dev/null 2>&1; then
    echo "needed ${pkg}: the tree does not resolve without it"
    restore
    continue
  fi

  if ! advisories=$(audit | jq -r --arg p "$pkg" --argjson base "$baseline" \
    '[.advisories[]? | select(.module_name == $p) | .github_advisory_id] - ($base[$p] // []) | join(", ")' \
    2>/dev/null); then
    echo "needed ${pkg}: pnpm audit gave no answer"
    restore
    continue
  fi
  if [ -n "$advisories" ]; then
    echo "needed ${pkg}: ${advisories} without it"
    restore
    continue
  fi

  below=$(resolved "$pkg" |
    while IFS= read -r version; do
      [ "$(printf '%s\n%s\n' "$version" "$pin" | sort -V | head -n1)" = "$pin" ] || echo "$version"
    done)
  if [ -n "$below" ]; then
    echo "needed ${pkg}: resolves to $(echo "$below" | paste -sd, -) without it, below ${pin}"
    restore
    continue
  fi

  echo "stale ${pkg}"
  stale=1
  restore
done <<<"$entries"

exit "$stale"
