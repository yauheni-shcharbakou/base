#!/usr/bin/env bash
# Prints one version's CHANGELOG.md entry, shaped for the body of a GitHub Release.
#
#   scripts/release-notes.sh [--check] [--file <changelog>] <version> [<link base>]
#
# The entry is everything under `## [<version>]` up to the next `## [`. Two things differ between
# the file and a release, and both are put right here rather than in the changelog:
#
#   1. A release body keeps every line break, where the file is wrapped at a column. Wrapped lines
#      are joined back into their paragraph, list item or quote; code fences are left as they are.
#   2. A relative link (`docs/adr/0001-….md`) resolves against the release's own URL. With a link
#      base — `https://github.com/<owner>/<repo>/blob/<tag>` — each one is made absolute, pinned to
#      the tag, so it keeps pointing at the file as released.
#
# `--check` prints no notes. It prints one line per reason the entry would publish badly — there
# is no entry, it is empty, a code fence is never closed, a relative link names a file that does
# not exist — and exits 1 when there is any. scripts/docs-invariants.sh runs it on the root version,
# so a pull request learns it, not the release.
#
# `--file` reads another changelog (the specs' fixtures). Its path and every relative link are
# read from the repository root, where CHANGELOG.md lives.
#
# One copy, three callers: the `release` job of .github/workflows/main.yaml, the docs invariants,
# and anyone previewing the notes before a merge. Specs: scripts/release-notes.test.sh. Exits 1
# when the changelog has no entry for the version. Needs bash and awk alone.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

usage='usage: release-notes.sh [--check] [--file <changelog>] <version> [<link base>]'
check=0
file=CHANGELOG.md

while [ $# -gt 0 ]; do
  case "$1" in
    --check)
      check=1
      shift
      ;;
    --file)
      file=${2:?$usage}
      shift 2
      ;;
    -*)
      echo "$usage" >&2
      exit 2
      ;;
    *) break ;;
  esac
done

version=${1:?$usage}
base=${2:-}

if [ ! -f "$file" ]; then
  echo "No changelog at ${file}." >&2
  exit 2
fi

# With `check` set the program prints findings instead of the notes: `link <target>` for every
# relative link outside a code fence, then `missing`, `empty` or `fence`.
program='
  # Whether a line opens a block of its own: a list item, a heading, a quote, a table row.
  function opens(text) {
    return text ~ /^([-*+] |[0-9]+\. |#|>|\|)/
  }

  # Every `](target)` that is not a URL of its own or an anchor gets the base in front.
  function absolute(line,    out, target) {
    out = ""
    while (match(line, /\]\([^)]+\)/)) {
      target = substr(line, RSTART + 2, RLENGTH - 3)
      out = out substr(line, 1, RSTART - 1) "]("
      if (target !~ /^(https?:|mailto:|#)/) {
        if (check) print "link " target
        else if (base != "") out = out base "/"
      }
      out = out target ")"
      line = substr(line, RSTART + RLENGTH)
    }
    return out line
  }

  # A blank line is owed until the next line of text: none leads the notes, none trails them, and
  # several in a row are one.
  function emit(line) {
    started = 1
    if (check) return
    if (blank) print ""
    blank = 0
    print line
  }

  function flush() {
    if (held != "") {
      emit(absolute(held))
      held = ""
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
    emit($0)
    fenced = !fenced
    next
  }

  fenced {
    if (!check) print
    next
  }

  /^[ \t]*$/ {
    flush()
    blank = started
    next
  }

  {
    text = $0
    sub(/^[ \t]+/, "", text)

    if (held != "") {
      # The rest of the line being held: it opens nothing of its own.
      if (!opens(text)) {
        held = held " " text
        next
      }

      # Or the next line of the quote being held, under its own `>`. A bare `>` is the blank line
      # between two quoted paragraphs, and a quoted list item is an item, so neither is joined.
      if (quoted && text ~ /^>/) {
        rest = text
        sub(/^>[ \t]*/, "", rest)
        if (rest != "" && !opens(rest)) {
          held = held " " rest
          next
        }
      }
    }

    flush()
    held = $0
    quoted = (text ~ /^>/)
    if (text ~ /^#/ || text ~ /^>[ \t]*$/) flush()
  }

  END {
    flush()
    if (check) {
      if (!found) print "missing"
      else if (!started) print "empty"
      if (fenced) print "fence"
    } else if (!found) {
      exit 1
    }
  }
'

if [ "$check" -eq 0 ]; then
  awk -v version="$version" -v base="$base" -v check=0 "$program" "$file"
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "${file} has no entry for ${version}." >&2
  fi
  exit "$status"
fi

failed=0

problem() {
  echo "${file} [${version}]: $1"
  failed=1
}

while IFS= read -r finding; do
  case "$finding" in
    'link '*)
      link=${finding#link }
      # The file a link names, without its anchor or its title.
      target=${link%%#*}
      target=${target%% *}
      [ -e "$target" ] || problem "a link to a file that does not exist: ${link}"
      ;;
    missing) problem 'the changelog has no such entry' ;;
    empty) problem 'the entry is empty' ;;
    fence) problem 'a code fence is never closed' ;;
  esac
done < <(awk -v version="$version" -v base='' -v check=1 "$program" "$file")

exit "$failed"
