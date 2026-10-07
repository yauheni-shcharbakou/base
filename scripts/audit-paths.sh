#!/usr/bin/env bash
# Where each advisory of a `pnpm audit --json` report sits in the tree, one line per advisory.
#
#   pnpm audit [--prod] --json | scripts/audit-paths.sh
#   scripts/audit-paths.sh <report.json>
#
# Prints, tab-separated and sorted critical → low (then by package):
#
#   <severity> <GHSA> <package> <versions> <workspaces> <how> <parents>
#
# read from the report's own `findings[].paths` (`<workspace>><direct dep>>…><parent>><pkg>`, the
# workspace with `/` spelled `__`), so the `/audit` skill gets every row's path in one pass instead
# of one `pnpm why` per row. <how> is `direct`, `via <direct deps>`, or both; <parents> are the
# packages that depend on it, `-` when only workspaces do — the column the choice of fix turns on.
# Lists are comma-separated, except workspaces (space-separated, there can be many).
#
# A report with no advisories prints nothing and exits 0; input that is not such a report exits 2.
# Its specs are scripts/audit-paths.test.sh. Needs bash and jq.
usage='usage: audit-paths.sh [<report.json>]'
[ $# -le 1 ] || {
  echo "$usage" >&2
  exit 2
}

jq -r '
  def rank: {critical: 0, high: 1, moderate: 2, low: 3, info: 4}[.] // 5;
  def list(sep): unique | if length == 0 then "-" else join(sep) end;
  if (.advisories | type) != "object" then error("not a pnpm audit report") else . end
  | [.advisories[]]
  | sort_by((.severity | rank), .module_name, .github_advisory_id, [.findings[]?.version])[]
  | [.findings[]?.paths[]? | split(">")] as $paths
  | ($paths | map(select(length > 2))) as $deep
  | [
      .severity,
      .github_advisory_id,
      .module_name,
      ([.findings[]?.version] | list(",")),
      ($paths | map(.[0] | gsub("__"; "/")) | list(" ")),
      ([
        (if any($paths[]; length == 2) then "direct" else empty end),
        (if ($deep | length) > 0 then "via " + ($deep | map(.[1]) | list(",")) else empty end)
      ] | if length == 0 then "-" else join(", ") end),
      ($deep | map(.[-2]) | list(","))
    ]
  | @tsv
' "${1:-/dev/stdin}" 2>/dev/null || {
  echo "audit-paths: ${1:-stdin} is not a pnpm audit --json report" >&2
  exit 2
}
