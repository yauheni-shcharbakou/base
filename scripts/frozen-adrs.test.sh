#!/usr/bin/env bash
# Specs of scripts/frozen-adrs.sh, in a scratch repository built for each case.
#
# The check fails silently in its permissive direction — an ADR it never looks at, or a base it
# never finds, pass as "nothing edited" — so each case states the exit code it must get, and the
# cases that must pass sit next to the ones that must not.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash and git alone.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

script="$PWD/scripts/frozen-adrs.sh"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

. scripts/lib/spec.sh

landed='# 0001 — Something was decided

**Status:** Accepted (2026-01-01)
**Applies to:** `@backend/x`

## Context

Why it had to be decided.
'

adr=docs/adr/0001-something.md

# repo [no-base]: a fresh repository whose one commit holds the landed ADR and an index, with
# `origin/main` pointing at it unless told otherwise. The tree is then left as committed; each case
# edits it before calling `expects`.
repo() {
  rm -rf "$scratch/repo"
  mkdir -p "$scratch/repo/docs/adr"
  git -C "$scratch/repo" init -q
  printf '%s' "$landed" >"$scratch/repo/$adr"
  echo '| [0001](0001-something.md) | Something | Accepted |' >"$scratch/repo/docs/adr/README.md"
  git -C "$scratch/repo" add -A
  git -C "$scratch/repo" -c user.name=spec -c user.email=spec@example.com \
    commit -q -m landed
  if [ "${1:-}" != no-base ]; then
    git -C "$scratch/repo" update-ref refs/remotes/origin/main HEAD
  fi
}

# write <path> <content>: replaces a file of the scratch tree.
write() {
  printf '%s' "$2" >"$scratch/repo/$1"
}

# expects <name> <exit code> [GITHUB_ACTIONS value]: runs the script on the scratch repository.
expects() {
  local name=$1 expected=$2 actual
  env GITHUB_ACTIONS="${3:-}" bash "$script" --repo "$scratch/repo" >/dev/null 2>&1
  actual=$?
  if [ "$actual" = "$expected" ]; then pass; else fail "exited ${actual}, expected ${expected}"; fi
}

repo
expects 'an untouched ADR passes' 0

repo
write "$adr" "${landed/Accepted (2026-01-01)/Superseded by 0002 (2026-02-01)}"
expects 'a status line moved by a superseding ADR passes' 0

repo
write "$adr" "${landed/Why it had to be decided./Why it had to be decided, reworded.}"
expects 'an edited body fails' 1

repo
write "$adr" "${landed/Why it had to/Why it hda to}"
expects 'a typo fix fails too' 1

repo
write "$adr" "${landed/\`@backend\/x\`/\`@backend\/y\`}"
expects 'an edited Applies to line fails' 1

repo
write "$adr" "${landed/\*\*Status:\*\* Accepted (2026-01-01)
/}"
expects 'a removed status line fails' 1

repo
rm "$scratch/repo/$adr"
expects 'a deleted ADR fails' 1

repo
mv "$scratch/repo/$adr" "$scratch/repo/docs/adr/0001-renamed.md"
expects 'a renamed ADR fails' 1

repo
write docs/adr/0002-new.md '# 0002 — A new decision
'
write docs/adr/0002-new.md '# 0002 — A new decision, still being written
'
expects 'an ADR the branch adds is its own to edit' 0

repo
write docs/adr/README.md '| [0001](0001-something.md) | Something | Superseded |
'
expects 'the index is not an ADR' 0

repo no-base
write "$adr" "${landed/Why it had to be decided./Edited.}"
expects 'no base outside CI holds nothing' 0
expects 'no base in CI fails' 1 1

usage='usage: frozen-adrs.sh [--repo <dir>] [--base <ref>]'
# refuses <name> <arg>...: a usage error — exit 2 and the usage line alone on stderr.
refuses() {
  local name=$1 output actual
  shift
  output=$(bash "$script" "$@" 2>&1 >/dev/null)
  actual=$?
  matches 2 "$usage" "$actual" "$output"
}

refuses '--repo needs a directory' --repo
refuses '--base needs a ref' --repo "$scratch/repo" --base
refuses 'an empty --base is no ref' --base ''
refuses 'an unknown option' --nope

finish frozen-adrs
