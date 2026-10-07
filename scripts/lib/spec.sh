# What every spec in scripts/*.test.sh shares: the counts, how a failure is reported, and the
# summary that ends the run. Sourced after the spec has moved to the repository root:
#
#   . scripts/lib/spec.sh
#
# A failure is reported under `$name`, the spec being run — a global the spec sets, or a local of
# the helper that calls `fail` (bash scopes it dynamically). Helpers that run the script under test
# stay in each spec: what they feed it and read back differs from one script to the next.

passed=0
failed=0

# pass — one more assertion held.
pass() {
  passed=$((passed + 1))
}

# fail <message> [<detail>] — one more did not; the detail (output, usually) indented below.
fail() {
  echo "FAIL: ${name} — $1"
  [ $# -lt 2 ] || printf '%s\n' "$2" | sed 's/^/    /'
  failed=$((failed + 1))
}

# matches <expected exit> <expected output> <exit> <output> — both must be equal.
matches() {
  if [ "$3" = "$1" ] && [ "$4" = "$2" ]; then
    pass
  else
    fail "exit $3, expected $1; got:" "$4"
    echo '  expected:'
    printf '%s\n' "$2" | sed 's/^/    /'
  fi
}

# finish <suite> [<noun>] — the summary line; exits 1 when anything failed, or when nothing ran at
# all: a helper broken early must not pass as a green run.
finish() {
  if [ "$failed" -gt 0 ]; then
    echo "$1: ${failed} failed, ${passed} passed."
    exit 1
  fi
  if [ "$passed" -eq 0 ]; then
    echo "$1: no ${2:-specs} ran."
    exit 1
  fi
  echo "$1: ${passed} ${2:-specs} passed."
}
