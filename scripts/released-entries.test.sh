#!/usr/bin/env bash
# Specs of scripts/released-entries.sh, in a scratch repository built for each case.
#
# The check fails silently in its permissive direction — an entry it cannot find, or tags it never
# sees, pass as "nothing edited" — so each case states the exit code it must get, and the cases
# that must pass sit next to the ones that must not.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash and git alone.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

script="$PWD/scripts/released-entries.sh"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

. scripts/lib/spec.sh

released='# Changelog

## [1.1.0] — 2026-01-02 — `feat/b`

- The second release.

## [1.0.0] — 2026-01-01 — `feat/a`

- The first release.
'

# repo <changelog at the tag> <changelog in the tree> [tag]: a fresh repository whose one commit,
# tagged (annotated, as the release job tags), holds the first; the second is left in the tree. An
# empty first commits no changelog at all; no tag argument tags nothing.
repo() {
  rm -rf "$scratch/repo"
  mkdir "$scratch/repo"
  git -C "$scratch/repo" init -q
  if [ -n "$1" ]; then
    printf '%s' "$1" >"$scratch/repo/CHANGELOG.md"
  else
    echo 'no changelog yet' >"$scratch/repo/README"
  fi
  git -C "$scratch/repo" add -A
  git -C "$scratch/repo" -c user.name=spec -c user.email=spec@example.com \
    commit -q -m release
  if [ -n "${3:-}" ]; then
    git -C "$scratch/repo" -c user.name=spec -c user.email=spec@example.com \
      tag -a "$3" -m "$3"
  fi
  printf '%s' "$2" >"$scratch/repo/CHANGELOG.md"
}

# expects <name> <exit code> [env assignment]: runs the script on the scratch repository.
expects() {
  local name=$1 expected=$2 actual
  env GITHUB_ACTIONS="${3:-}" bash "$script" --repo "$scratch/repo" >/dev/null 2>&1
  actual=$?
  if [ "$actual" = "$expected" ]; then pass; else fail "exited ${actual}, expected ${expected}"; fi
}

repo "$released" "$released" v1.1.0
expects 'an untouched entry passes' 0

repo "$released" "${released/The second release./The second release, reworded.}" v1.1.0
expects 'an edited line in a released entry fails' 1

repo "$released" "${released/2026-01-02/2026-01-03}" v1.1.0
expects 'an edited heading fails' 1

repo "$released" "${released/The first release./The first release, reworded.}" v1.0.0
expects 'an older released entry is held too' 1

repo "$released" "${released/The first release./The first release, reworded.}" v1.1.0
expects 'an entry whose own tag is not here is not held' 0

repo "$released" "$(printf '# Changelog\n\n## [1.0.0] — 2026-01-01 — `feat/a`\n\n- The first release.\n')" v1.1.0
expects 'a removed released entry fails' 1

repo "$released" "${released/\# Changelog/# Changelog

## [1.2.0] — 2026-01-03 — \`feat/c\`

- Not released yet.
}" v1.1.0
expects 'a new entry above the released ones passes' 0

repo "$released" "${released}
" v1.1.0
expects 'a trailing blank line is no edit' 0

repo '' "$released" v1.1.0
expects 'a tag without a changelog holds nothing' 0

repo "$released" "$released"
expects 'no tags outside CI hold nothing' 0
expects 'no tags in CI fail' 1 1

usage='usage: released-entries.sh [--repo <dir>]'
# refuses <name> <arg>...: a usage error — exit 2 and the usage line alone on stderr.
refuses() {
  local name=$1 output actual
  shift
  output=$(bash "$script" "$@" 2>&1 >/dev/null)
  actual=$?
  matches 2 "$usage" "$actual" "$output"
}

refuses '--repo needs a directory' --repo
refuses 'an unknown option' --nope

finish released-entries
