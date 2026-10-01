#!/usr/bin/env bash
# Prints one version's CHANGELOG.md entry, shaped for the body of a GitHub Release.
#
#   scripts/release-notes.sh <version> [<link base>]
#
# The entry is everything under `## [<version>]` up to the next `## [`. Two things differ between
# the file and a release, and both are put right here rather than in the changelog:
#
#   1. A release body keeps every line break, where the file is wrapped at a column. Wrapped lines
#      are joined back into their paragraph or list item; code fences are left as they are.
#   2. A relative link (`docs/adr/0001-….md`) resolves against the release's own URL. With a link
#      base — `https://github.com/<owner>/<repo>/blob/<tag>` — each one is made absolute, pinned to
#      the tag, so it keeps pointing at the file as released.
#
# One copy, two callers: the `tag` job of .github/workflows/check.yaml, and anyone previewing the
# notes before a merge. Exits 1 when the changelog has no entry for the version. Needs bash and awk
# alone.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

version=${1:?usage: release-notes.sh <version> [<link base>]}
base=${2:-}

awk -v version="$version" -v base="$base" '
  # Every `](target)` that is not a URL of its own or an anchor gets the base in front.
  function absolute(line,    out, target) {
    if (base == "") return line
    out = ""
    while (match(line, /\]\([^)]+\)/)) {
      target = substr(line, RSTART + 2, RLENGTH - 3)
      out = out substr(line, 1, RSTART - 1) "]("
      if (target !~ /^(https?:|mailto:|#)/) out = out base "/"
      out = out target ")"
      line = substr(line, RSTART + RLENGTH)
    }
    return out line
  }

  function flush() {
    if (held != "") {
      print absolute(held)
      held = ""
      started = 1
    }
  }

  /^## \[/ {
    if (found) exit
    if (index($0, "## [" version "]") == 1) found = 1
    next
  }

  !found { next }

  /^[ \t]*```/ {
    flush()
    print
    fenced = !fenced
    next
  }

  fenced {
    print
    next
  }

  /^[ \t]*$/ {
    flush()
    # No blank line before the first one of text.
    if (started) print ""
    next
  }

  {
    text = $0
    sub(/^[ \t]+/, "", text)

    # A line that opens nothing of its own — no list item, heading, quote or table row — is the
    # rest of the line being held.
    if (held != "" && text !~ /^([-*+] |[0-9]+\. |#|>|\|)/) {
      held = held " " text
      next
    }

    flush()
    held = $0
    if (text ~ /^#/) flush()
  }

  END {
    flush()
    if (!found) exit 1
  }
' CHANGELOG.md

status=$?
if [ "$status" -ne 0 ]; then
  echo "CHANGELOG.md has no entry for ${version}." >&2
fi
exit "$status"
