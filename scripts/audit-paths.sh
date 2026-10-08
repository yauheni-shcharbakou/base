#!/usr/bin/env bash
# Where each advisory of a `pnpm audit --json` report sits in the tree, one line per advisory.
#
#   pnpm audit [--prod] --json | scripts/audit-paths.sh [--by-package] [--prod-report <prod.json>]
#   scripts/audit-paths.sh [--by-package] [--prod-report <prod.json>] <report.json>
#
# Prints, tab-separated and sorted critical → low (then by package):
#
#   <severity> <GHSA> <package> [<scope>] <versions> <patched> <workspaces> <how> <parents>
#
# read from the report's own `findings[].paths` (`<workspace>><direct dep>>…><parent>><pkg>`, the
# workspace with `/` spelled `__`), so the `/audit` skill gets every row's path in one pass instead
# of one `pnpm why` per row. <how> is `direct`, `via <direct deps>`, or both; <parents> are the
# packages that depend on it, `-` when only workspaces do — the column the choice of fix turns on.
# Lists are comma-separated, except workspaces (space-separated, there can be many).
#
# <patched> holds one entry per vulnerable version, in the order of <versions>: the lowest version
# that fixes every advisory of the row at that version (the highest of their `>=` bounds), the
# advisory's own range when it is not a plain `>=`, or `no fix` when any of them has no patched
# release — nothing to apply, only to wait for.
#
# `--by-package` merges the rows of one package (and one scope) into a single row: the highest
# severity, every GHSA, every version. One package often carries a dozen advisories, and the fix —
# one bump per version — is the same for all of them.
#
# With `--prod-report`, the report is a whole-tree audit (`/audit --dev`) and <scope> says whether
# the advisory ships: `prod` when the `--prod` report given there has the same GHSA at one of the
# same versions, `dev` otherwise. By version, not GHSA alone — one advisory often covers several
# copies of a package, only some of which are in production.
#
# A report with no advisories prints nothing and exits 0; input that is not such a report exits 2.
# Its specs are scripts/audit-paths.test.sh. Needs bash and jq.
usage='usage: audit-paths.sh [--by-package] [--prod-report <prod.json>] [<report.json>]'
usage_error() {
  echo "$usage" >&2
  exit 2
}
prod=''
by_package=false
input=()

while [ $# -gt 0 ]; do
  case "$1" in
    --by-package)
      by_package=true
      shift
      ;;
    --prod-report)
      [ -n "${2:-}" ] || usage_error
      prod=$2
      shift 2
      ;;
    -*)
      usage_error
      ;;
    *)
      input+=("$1")
      shift
      ;;
  esac
done
[ "${#input[@]}" -le 1 ] || usage_error
source=${input[0]:-/dev/stdin}

# "<GHSA>@<version>" of every finding the production report has; null without --prod-report.
shipped=null
if [ -n "$prod" ]; then
  shipped=$(jq -c '
    if (.advisories | type) != "object" then error("not a pnpm audit report") else . end
    | [.advisories[] | .github_advisory_id as $id | .findings[]? | "\($id)@\(.version)"] | unique
  ' "$prod" 2>/dev/null) || {
    echo "audit-paths: ${prod} is not a pnpm audit --json report" >&2
    exit 2
  }
fi

jq -r --argjson shipped "$shipped" --argjson by_package "$by_package" '
  def rank: {critical: 0, high: 1, moderate: 2, low: 3, info: 4}[.] // 5;
  def list(sep): unique | if length == 0 then "-" else join(sep) end;
  def semver: split("-")[0] | split(".") | map(tonumber? // 0);
  # The fix for one version, from the patched ranges of every advisory that has it.
  def fix:
    if any(.[]; . == null or . == "" or . == "<0.0.0") then "no fix"
    elif all(.[]; test("^>= *[0-9][^ ]*$")) then map(sub("^>= *"; "")) | max_by(semver)
    else unique | join(" ") end;
  if (.advisories | type) != "object" then error("not a pnpm audit report") else . end
  | [.advisories[]
      | .github_advisory_id as $id
      | .patched_versions as $patched
      | {
          severity,
          ids: [$id],
          module: .module_name,
          scope: (if $shipped == null then null
                  elif any(.findings[]?; "\($id)@\(.version)" | IN($shipped[])) then "prod"
                  else "dev" end),
          findings: [.findings[]? | {version, paths: (.paths // []), patched: $patched}]
        }]
  | if $by_package then
      group_by([.module, .scope])
      | map({
          severity: (map(.severity) | min_by(rank)),
          ids: (map(.ids[]) | unique),
          module: .[0].module,
          scope: .[0].scope,
          findings: map(.findings[])
        })
    else . end
  | sort_by((.severity | rank), .module, .ids, [.findings[].version])[]
  | (.findings | map(.version) | unique | sort_by(semver)) as $versions
  | .findings as $findings
  | [.findings[].paths[] | split(">")] as $paths
  | ($paths | map(select(length > 2))) as $deep
  | [
      .severity,
      (.ids | join(",")),
      .module,
      (.scope // empty),
      (if ($versions | length) == 0 then "-" else $versions | join(",") end),
      (if ($versions | length) == 0 then "-"
       else $versions | map(. as $v | [$findings[] | select(.version == $v) | .patched] | fix) | join(",") end),
      ($paths | map(.[0] | gsub("__"; "/")) | list(" ")),
      ([
        (if any($paths[]; length == 2) then "direct" else empty end),
        (if ($deep | length) > 0 then "via " + ($deep | map(.[1]) | list(",")) else empty end)
      ] | if length == 0 then "-" else join(", ") end),
      ($deep | map(.[-2]) | list(","))
    ]
  | @tsv
' "$source" 2>/dev/null || {
  echo "audit-paths: ${input[0]:-stdin} is not a pnpm audit --json report" >&2
  exit 2
}
