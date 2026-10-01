#!/usr/bin/env bash
# Specs of scripts/release-notes.sh, against the fixtures in scripts/fixtures/release-notes/.
#
# The notes it prints become a published Release, and the only non-obvious thing it does — joining
# wrapped lines back together — fails silently: the output is still valid markdown, only wrong.
# So what each kind of line must come to is written down here, by hand, and compared whole.
#
# The fixtures are `.txt` on purpose. scripts/classify-changes.sh reads a change to `*.md` alone as
# documentation, which skips the job that runs this; and nothing should format them.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash, awk and diff alone.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

notes=scripts/release-notes.sh
fixtures=scripts/fixtures/release-notes
changelog="$fixtures/changelog.txt"
broken="$fixtures/changelog.broken.txt"

actual=$(mktemp)
trap 'rm -f "$actual"' EXIT

passed=0
failed=0

pass() {
  passed=$((passed + 1))
}

fail() {
  echo "FAIL: ${name} — $1"
  failed=$((failed + 1))
}

# Runs the script; its output (stderr too) lands in $actual and its exit code in $status.
run() {
  name=$1
  shift
  bash "$notes" "$@" >"$actual" 2>&1
  status=$?
}

exits() {
  if [ "$status" -eq "$1" ]; then pass; else fail "exit ${status}, expected $1"; fi
}

prints() {
  if diff -u "$1" "$actual"; then pass; else fail "the output differs from $1"; fi
}

prints_nothing() {
  if [ ! -s "$actual" ]; then pass; else
    fail 'printed something:'
    cat "$actual"
  fi
}

has() {
  if grep -qF -- "$1" "$actual"; then pass; else
    fail "no \"$1\" in:"
    cat "$actual"
  fi
}

lacks() {
  if grep -qF -- "$1" "$actual"; then
    fail "\"$1\" in:"
    cat "$actual"
  else pass; fi
}

lines() {
  count=$(grep -c '' "$actual")
  if [ "$count" -eq "$1" ]; then pass; else
    fail "${count} lines, expected $1:"
    cat "$actual"
  fi
}

# --- the notes ---

run 'an entry with a link base' --file "$changelog" 2.0.0 https://example.test/blob/v2.0.0
exits 0
prints "$fixtures/notes-2.0.0.txt"

run 'the last entry, without a base: links stay as written' --file "$changelog" 1.0.0
exits 0
prints "$fixtures/notes-1.0.0.txt"

run 'a version the changelog does not have' --file "$changelog" 9.9.9
exits 1
has 'has no entry for 9.9.9'
lines 1

run 'a prefix of a version is not that version' --file "$changelog" 2.0
exits 1

run 'no version' --file "$changelog"
exits 1
has 'usage:'

run 'an unknown option' --nope 2.0.0
exits 2
has 'usage:'

run 'a changelog that is not there' --file "$fixtures/nowhere.txt" 2.0.0
exits 2

# --- --check ---

run 'check: an entry that would publish well' --check --file "$changelog" 2.0.0
exits 0
prints_nothing

run 'check: no entry' --check --file "$changelog" 9.9.9
exits 1
has 'the changelog has no such entry'
lines 1

run 'check: an empty entry' --check --file "$broken" 3.2.0
exits 1
has 'the entry is empty'
lines 1

run 'check: an unclosed code fence, whose links are not read' --check --file "$broken" 3.1.0
exits 1
has 'a code fence is never closed'
lacks 'docs/in-a-fence.md'
lines 1

run 'check: links to files that do not exist' --check --file "$broken" 3.0.0
exits 1
has 'a link to a file that does not exist: docs/no-such-file.md'
has 'a link to a file that does not exist: no/such/dir/ "with a title"'
lacks 'docs/env.md'
lacks 'example.test'
lines 2

if [ "$failed" -ne 0 ]; then
  echo "release-notes: ${failed} failed, ${passed} passed."
  exit 1
fi

echo "release-notes: ${passed} assertions passed."
