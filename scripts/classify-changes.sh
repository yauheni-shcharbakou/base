#!/usr/bin/env bash
# Decides what a change needs from CI. Reads the changed paths on stdin, one per line, and
# prints two lines for $GITHUB_OUTPUT:
#
#   code=true|false   something CI builds, lints or tests changed — the full check runs
#   docs=true|false   documentation changed — its own checks are enough when `code` is false
#
# The full check is the default: `code` is false only when every path is on the list below, and
# an empty list (a diff that could not be computed) counts as code. A path nobody thought of
# costs a run, never a skipped one.
code=false
docs=false
seen=false

while IFS= read -r file; do
  [ -n "$file" ] || continue
  seen=true

  case "$file" in
    # Claude's own hooks, skills, settings and plans: nothing in CI runs or reads them, the
    # docs checks included — both skip the directory. Before `*.md`, so a plan is not a doc.
    .claude/*) ;;
    *.md) docs=true ;;
    *) code=true ;;
  esac
done

[ "$seen" = true ] || code=true

echo "code=$code"
echo "docs=$docs"
