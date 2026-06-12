#!/usr/bin/env bash
# PreToolUse / Bash safety guard.
# Denies dangerous git/pnpm commands regardless of flag position (unlike the
# prefix-matched permission deny rules). Reads the hook JSON on stdin and, on a
# match, prints a PreToolUse "deny" decision. Always exits 0 (allow = no output).
content=$(cat)
cmd=$(printf '%s' "$content" | jq -r '.tool_input.command // ""')

re='git[[:space:]]+push([[:space:]].*)?(--force|[[:space:]]-f([[:space:]]|$))'
re+='|git[[:space:]]+reset([[:space:]].*)?--hard'
re+='|git[[:space:]]+clean([[:space:]].*)?-[[:alnum:]]*f'
re+='|git[[:space:]]+branch([[:space:]].*)?-[[:alnum:]]*D'
re+='|git[[:space:]]+checkout([[:space:]].*)?--([[:space:]]|$)'
re+='|git[[:space:]]+restore([[:space:]]|$)'
re+='|git[[:space:]]+reflog[[:space:]]+expire'
re+='|git[[:space:]]+gc([[:space:]].*)?--prune'
re+='|git[[:space:]]+filter-branch'
re+='|pnpm[[:space:]]+(run[[:space:]]+)?reset(:modules)?([[:space:]]|$)'

if printf '%s' "$cmd" | grep -Eq "$re"; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked by project safety hook: dangerous git/pnpm command (force-push, reset --hard, clean -f, branch -D, checkout -- / restore, reflog expire, gc --prune, filter-branch, or pnpm reset/reset:modules). Run it manually in a terminal if you truly intend to."}}
JSON
fi
exit 0
