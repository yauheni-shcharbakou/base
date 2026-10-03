#!/usr/bin/env bash
# PostToolUse / Write|Edit documentation guard.
#
# Runs the two documentation checks CI runs, at the moment of the edit that breaks one.
#
# On a documentation edit:
#   - the invariants of the docs layout — dangling docs/ links, an ADR missing from the index,
#     a workspace name that does not exist, a changelog entry that is not the root version's or
#     would publish badly. They live in scripts/docs-invariants.sh, the one copy CI runs too
#     (`pnpm check:docs`); what each one is and why is there, and so is their numbering. An
#     edit to CHANGELOG.md or to the root version does not trigger them here: between the two
#     the changelog ones are legitimately broken.
#
# On an edit to CHANGELOG.md:
#   - no released entry changed (scripts/released-entries.sh, invariant 6 above). Unlike the
#     other changelog invariants this one is never broken on the way to a release, so it runs
#     at the edit: a released entry was published as it stood in its tag.
#
# On an edit to a zod env schema, a manifest, or a document carrying an env table:
#   - the generated env tables still match the schemas (@packages/env-docs --check),
#     which also rejects a `zod.number()` that forgot `zod.coerce` and a config file
#     no marker documents. A manifest counts because the service/package map in
#     docs/env.md is read off the workspace dependencies.
#
# Reads the hook JSON on stdin; on a violation prints a PostToolUse "block"
# decision so the model is told what to fix. Always exits 0.
content=$(cat)
path=$(printf '%s' "$content" | jq -r '.tool_input.file_path // ""')

is_doc=false
is_schema=false
is_changelog=false

case "$path" in
  */CLAUDE.md | CLAUDE.md | */docs/adr/*.md) is_doc=true ;;
  */CHANGELOG.md | CHANGELOG.md) is_changelog=true ;;
  */docs/env.md | */common.validation.ts) is_schema=true ;;
  */package.json | */pnpm-workspace.yaml) is_schema=true ;;
  # Content, not filename: `*.config.ts` used to miss backend/apps/auth/src/config.ts, and a
  # source that does not validate env leaves without paying for a tsx start-up.
  *.ts) grep -q 'validateEnv' "$path" 2>/dev/null && is_schema=true || exit 0 ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -d "$root" ] || exit 0
cd "$root" || exit 0

problems=""

# The layout invariants, one line per violation. Its closing hint goes to stderr and is
# dropped: this hook ends with its own.
if [ "$is_doc" = true ] && [ -f scripts/docs-invariants.sh ]; then
  if ! doc_report=$(GITHUB_ACTIONS='' bash scripts/docs-invariants.sh 2>/dev/null); then
    while IFS= read -r line; do
      [ -n "$line" ] && problems="${problems}  - ${line}"$'\n'
    done <<<"$doc_report"
  fi
fi

# The released entries of the changelog, one line per entry edited; the diff on stderr is dropped.
if [ "$is_changelog" = true ] && [ -f scripts/released-entries.sh ]; then
  if ! released_report=$(GITHUB_ACTIONS='' bash scripts/released-entries.sh 2>/dev/null); then
    while IFS= read -r line; do
      [ -n "$line" ] && problems="${problems}  - ${line}"$'\n'
    done <<<"$released_report"
  fi
fi

# Generated env tables still match the schemas they are projected from. Runs the
# generator's own --check rather than reimplementing it (~0.5 s).
if [ "$is_schema" = true ]; then
  tsx="packages/env-docs/node_modules/.bin/tsx"

  if [ -x "$tsx" ]; then
    if ! env_report=$("$tsx" packages/env-docs/compiler/main.ts --check 2>&1); then
      problems="${problems}${env_report}"$'\n'
    fi
  fi
fi

if [ -n "$problems" ]; then
  jq -n --arg r "Documentation invariants broken (project hook):"$'\n'"${problems}
Fix the reference, add the missing ADR/index row, or regenerate; restore a released changelog entry and put the correction in the next one. See docs/adr/README.md." \
    '{decision: "block", reason: $r}'
fi
exit 0
