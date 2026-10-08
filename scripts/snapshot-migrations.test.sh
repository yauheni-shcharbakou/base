#!/usr/bin/env bash
# Specs of scripts/snapshot-migrations.sh: a snapshot moves only with a migration beside it.
#
# Each spec builds a scratch git repository: a `main` commit with a service's snapshot, then a
# branch with the change under test. The guard fails in both directions — one that misses a change
# lets a lost column through to the next `migrate:create`, one that counts reformatting as a change
# fails every pull request that runs prettier — so both are written down here.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash, git and jq.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2
script="$(pwd)/scripts/snapshot-migrations.sh"

. scripts/lib/spec.sh
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

migrations=backend/apps/auth/src/migrations
snapshot=$migrations/.snapshot-auth.json
error="::error file=$snapshot::The snapshot changed without a new migration in $migrations. Generate one with \`pnpm migrate:create\`."

# fresh — a repository on a branch off `main`, whose snapshot has one table; prints its path.
fresh() {
  local dir
  dir=$(mktemp -d "$scratch/repo.XXXX")
  git -C "$dir" init -q -b main
  mkdir -p "$dir/$migrations"
  echo '{"tables":[{"name":"user","columns":{"id":{},"email":{}}}]}' >"$dir/$snapshot"
  touch "$dir/$migrations/Migration1.migration.ts"
  commit "$dir" 'base'
  git -C "$dir" checkout -q -b branch
  echo "$dir"
}

# commit <dir> <message> — everything in the tree.
commit() {
  git -C "$1" add -A
  git -C "$1" -c user.name=spec -c user.email=spec@example.com commit -q -m "$2"
}

# prints <name> <dir> <expected exit> <expected output> [<arg>...] — the args default to `main`.
prints() {
  local name=$1 dir=$2 expected_status=$3 expected=$4 actual status
  shift 4
  [ $# -gt 0 ] || set -- main
  actual=$(bash "$script" --repo "$dir" "$@" 2>&1)
  status=$?
  matches "$expected_status" "$expected" "$status" "$actual"
}

dir=$(fresh)
prints 'an untouched snapshot passes' "$dir" 0 ''

dir=$(fresh)
jq . "$dir/$snapshot" >"$dir/tmp" && mv "$dir/tmp" "$dir/$snapshot"
commit "$dir" 'format'
prints 'a reformatted snapshot is no change' "$dir" 0 ''

dir=$(fresh)
echo '{"tables":[{"name":"user","columns":{"id":{}}}]}' >"$dir/$snapshot"
commit "$dir" 'drop a column'
prints 'a changed value without a migration fails' "$dir" 1 "$error"

dir=$(fresh)
echo '{"tables":[{"name":"user","columns":{"email":{},"id":{}}}]}' >"$dir/$snapshot"
commit "$dir" 'reorder'
prints 'a key order that moves is a change' "$dir" 1 "$error"

dir=$(fresh)
echo '{"tables":[{"name":"user","columns":{"id":{}}}]}' >"$dir/$snapshot"
touch "$dir/$migrations/Migration2.migration.ts"
commit "$dir" 'drop a column, with a migration'
prints 'a change with a new migration beside it passes' "$dir" 0 ''

dir=$(fresh)
echo '{"tables":[{"name":"user","columns":{"id":{}}}]}' >"$dir/$snapshot"
mkdir -p "$dir/backend/apps/storage/src/migrations"
touch "$dir/backend/apps/storage/src/migrations/Migration2.migration.ts"
commit "$dir" 'a migration in another service'
prints "another service's migration does not count" "$dir" 1 "$error"

dir=$(fresh)
echo '{"tables":[{"name":"user","columns":{"id":{}}}]}' >"$dir/$snapshot"
echo '// edited' >>"$dir/$migrations/Migration1.migration.ts"
commit "$dir" 'edit the old migration'
prints 'an edited old migration does not count' "$dir" 1 "$error"

dir=$(fresh)
mkdir -p "$dir/backend/apps/storage/src/migrations"
echo '{}' >"$dir/backend/apps/storage/src/migrations/.snapshot-storage.json"
commit "$dir" 'a new snapshot'
prints 'a new snapshot without a migration fails' "$dir" 1 \
  "::error file=backend/apps/storage/src/migrations/.snapshot-storage.json::The snapshot changed without a new migration in backend/apps/storage/src/migrations. Generate one with \`pnpm migrate:create\`."

dir=$(fresh)
echo '{"tables": [' >"$dir/$snapshot"
commit "$dir" 'break it'
prints 'a snapshot that is not JSON counts as changed' "$dir" 1 "$error"

dir=$(fresh)
git -C "$dir" checkout -q main
echo '{"tables":[]}' >"$dir/$snapshot"
commit "$dir" 'a change on main'
git -C "$dir" checkout -q branch
prints "main's own changes since the fork are not the branch's" "$dir" 0 ''

usage='usage: snapshot-migrations.sh [--repo <dir>] <base>'
prints 'a base is needed' "$(fresh)" 2 "$usage" ''
prints '--repo needs a directory' "$(fresh)" 2 "$usage" --repo
prints 'an unknown option is an error' "$(fresh)" 2 "$usage" --nope main

finish snapshot-migrations
