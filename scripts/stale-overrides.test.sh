#!/usr/bin/env bash
# Specs of scripts/stale-overrides.sh: which overrides the tree no longer needs.
#
# The real answer needs the registry, so `pnpm` here is a fake put first on PATH, run in a scratch
# directory. It answers from files the spec writes next to it — `resolved.yaml` is the lockfile
# `pnpm install` writes, `audit-base.json` what `pnpm audit` prints before the first install (the
# baseline), `audit.json` what it prints after, `install-fails` fails the install — copies the
# pnpm-workspace.yaml each install sees to `seen.yaml`, so a spec can read which line was dropped,
# and appends the arguments of each audit to `audit-args`.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash, awk, jq and sort -V.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2
script="$(pwd)/scripts/stale-overrides.sh"

passed=0
failed=0
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

mkdir "$scratch/bin"
cat >"$scratch/bin/pnpm" <<'FAKE'
#!/usr/bin/env bash
case "$1" in
  install)
    cp pnpm-workspace.yaml "$FAKE_DIR/seen.yaml"
    cat "$FAKE_DIR/resolved.yaml" 2>/dev/null >pnpm-lock.yaml || echo 'resolved' >pnpm-lock.yaml
    [ ! -e "$FAKE_DIR/install-fails" ]
    ;;
  audit)
    echo "$*" >>"$FAKE_DIR/audit-args"
    answer=audit.json
    [ -e "$FAKE_DIR/seen.yaml" ] || answer=audit-base.json
    cat "$FAKE_DIR/$answer" 2>/dev/null || echo '{"advisories":{}}'
    ;;
esac
FAKE
chmod +x "$scratch/bin/pnpm"

WORKSPACE="packages:
  - 'packages/*'

overrides:
  qs: '6.16.0'
  # Kept: one copy or dates break.
  # A second line, never printed.
  protobufjs: '7.6.6'
  #No space after the hash.
  pinned-range: '^1.0.0'
  # A comment a blank line cuts off.

  '@grpc/grpc-js': '1.14.5'
  ws: '^8.0.0'
  'a>b': '1.0.0' # a selector
  # a comment line

onlyBuiltDependencies:
  - esbuild"

# fresh — a scratch repo with the workspace above and a lockfile; prints its path.
fresh() {
  local dir
  dir=$(mktemp -d "$scratch/repo.XXXX")
  printf '%s\n' "$WORKSPACE" >"$dir/pnpm-workspace.yaml"
  echo 'locked' >"$dir/pnpm-lock.yaml"
  echo "$dir"
}

# resolves <dir> <lockfile key>... — keys of the packages section of the lockfile the install writes.
resolves() {
  local dir=$1
  shift
  {
    echo "lockfileVersion: '9.0'"
    echo 'importers:'
    echo '  .:'
    echo '    dependencies:'
    echo '      qs@6.1.0:'
    echo 'packages:'
    printf '  %s:\n    resolution: {}\n' "$@"
  } >>"$dir/resolved.yaml"
}

# prints <name> <dir> <expected exit> <expected output> [<pkg>...]
prints() {
  local name=$1 dir=$2 expected_status=$3 expected=$4 actual status
  shift 4
  actual=$(PATH="$scratch/bin:$PATH" FAKE_DIR="$dir" bash "$script" --repo "$dir" "$@" 2>&1)
  status=$?
  if [ "$actual" = "$expected" ] && [ "$status" = "$expected_status" ]; then
    passed=$((passed + 1))
  else
    echo "FAIL: ${name} — exit ${status}, expected ${expected_status}; got:"
    echo "$actual" | sed 's/^/    /'
    echo "  expected:"
    echo "$expected" | sed 's/^/    /'
    failed=$((failed + 1))
  fi
}

# holds <name> <condition>
holds() {
  if eval "$2"; then
    passed=$((passed + 1))
  else
    echo "FAIL: $1"
    failed=$((failed + 1))
  fi
}

dir=$(fresh)
resolves "$dir" qs@6.16.0 qsx@1.0.0 "'@grpc/grpc-js@1.14.5'" "'@grpc/grpc-js@1.15.0(peer@1.0.0)'"
prints 'every entry is judged, commented ones kept, ranges and selectors skipped' "$dir" 1 "stale qs
kept protobufjs: Kept: one copy or dates break.
kept pinned-range: No space after the hash.
stale @grpc/grpc-js
skipped ws: '^8.0.0' is not an exact version
skipped a>b: a selector, not a package name"
holds 'the workspace file is restored' "printf '%s\n' \"\$WORKSPACE\" | cmp -s - '$dir/pnpm-workspace.yaml'"
holds 'the lockfile is restored' "[ \"\$(cat '$dir/pnpm-lock.yaml')\" = locked ]"

dir=$(fresh)
resolves "$dir" qs@6.16.0
prints 'only the named packages are judged' "$dir" 1 'stale qs' qs
holds 'only the judged line is dropped' "! grep -q '^  qs:' '$dir/seen.yaml' && grep -q 'grpc-js' '$dir/seen.yaml' && grep -q '^onlyBuiltDependencies:' '$dir/seen.yaml'"

dir=$(fresh)
resolves "$dir" protobufjs@6.0.0
prints 'a kept entry is never resolved without it' "$dir" 0 'kept protobufjs: Kept: one copy or dates break.' protobufjs
holds 'a kept entry triggers no install' "[ ! -e '$dir/seen.yaml' ]"

dir=$(fresh)
resolves "$dir" qs@6.16.0
echo '{"advisories":{"1":{"module_name":"qs","github_advisory_id":"GHSA-xxxx-yyyy-zzzz"},"2":{"module_name":"ws","github_advisory_id":"GHSA-other"}}}' >"$dir/audit.json"
prints 'an advisory without it means needed' "$dir" 0 'needed qs: GHSA-xxxx-yyyy-zzzz without it' qs

dir=$(fresh)
resolves "$dir" qs@6.16.0
echo '{"advisories":{"1":{"module_name":"qs","github_advisory_id":"GHSA-old"}}}' >"$dir/audit-base.json"
cp "$dir/audit-base.json" "$dir/audit.json"
prints 'an advisory the baseline already reports does not make it needed' "$dir" 1 'stale qs' qs

dir=$(fresh)
resolves "$dir" qs@6.16.0
echo '{"advisories":{"1":{"module_name":"qs","github_advisory_id":"GHSA-old"}}}' >"$dir/audit-base.json"
echo '{"advisories":{"1":{"module_name":"qs","github_advisory_id":"GHSA-old"},"2":{"module_name":"qs","github_advisory_id":"GHSA-new"}}}' >"$dir/audit.json"
prints 'only an advisory the baseline lacks makes it needed' "$dir" 0 'needed qs: GHSA-new without it' qs

dir=$(fresh)
resolves "$dir" qs@6.16.0
prints 'the audit is --prod by default' "$dir" 1 'stale qs' qs
holds 'both audits ask for --prod' "[ \"\$(grep -c -- '--prod' '$dir/audit-args')\" = 2 ]"

dir=$(fresh)
resolves "$dir" qs@6.16.0
prints 'the audit covers dev dependencies with --dev' "$dir" 1 'stale qs' --dev qs
holds 'no audit asks for --prod with --dev' "[ \"\$(wc -l <'$dir/audit-args' | tr -d ' ')\" = 2 ] && ! grep -q -- '--prod' '$dir/audit-args'"

dir=$(fresh)
resolves "$dir" qs@6.15.1 "qs@6.15.1(peer@2.0.0)" qs@6.16.0
prints 'a copy below the pin means needed, deeper-indented and peer-suffixed keys aside' "$dir" 0 'needed qs: resolves to 6.15.1 without it, below 6.16.0' qs

dir=$(fresh)
resolves "$dir" qs@6.100.0
prints 'versions compare as versions, not strings' "$dir" 1 'stale qs' qs

dir=$(fresh)
prints 'a package gone from the tree is stale' "$dir" 1 'stale qs' qs

dir=$(fresh)
touch "$dir/install-fails"
prints 'a tree that does not resolve without it means needed' "$dir" 0 'needed qs: the tree does not resolve without it' qs
holds 'the files are restored after a failed install' "[ \"\$(cat '$dir/pnpm-lock.yaml')\" = locked ]"

dir=$(fresh)
echo 'not json' >"$dir/audit.json"
prints 'an unreadable audit means needed, not stale' "$dir" 0 'needed qs: pnpm audit gave no answer' qs

prints 'a directory without the workspace file is an error' "$scratch/bin" 2 "no pnpm-workspace.yaml in $scratch/bin"

if [ "$failed" -gt 0 ]; then
  echo "${failed} failed, ${passed} passed."
  exit 1
fi
echo "stale-overrides: ${passed} specs passed."
