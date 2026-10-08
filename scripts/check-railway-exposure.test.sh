#!/usr/bin/env bash
# Specs of scripts/check-railway-exposure.sh, against small graphs written inline.
#
# The guard is the only thing that sees a public endpoint made in the Railway dashboard, and it
# fails quietly in the wrong direction: a filter that reads an empty list as an endpoint stops every
# deploy, one that misses a kind lets a proxy through. So each shape of the pulled graph is written
# down here with the answer it must get.
#
# Run by `pnpm check:scripts`, in CI's `check` job. Needs bash and jq.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

command -v jq >/dev/null || {
  echo 'jq is needed to run these specs.' >&2
  exit 2
}

guard=scripts/check-railway-exposure.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

. scripts/lib/spec.sh

# run <name> <allow-list json> <graph json>: output in $tmp/out, exit code in $status.
run() {
  name=$1
  printf '%s' "$2" >"$tmp/allow.json"
  printf '%s' "$3" | bash "$guard" "$tmp/allow.json" >"$tmp/out" 2>&1
  status=$?
}

exits() { if [ "$status" -eq "$1" ]; then pass; else fail "exit ${status}, expected $1"; fi; }
fails() { if [ "$status" -ne 0 ]; then pass; else fail 'exit 0, expected a failure'; fi; }
says() { if grep -qF -- "$1" "$tmp/out"; then pass; else fail "no \"$1\" in: $(cat "$tmp/out")"; fi; }
never_says() { if grep -qF -- "$1" "$tmp/out"; then fail "\"$1\" is in: $(cat "$tmp/out")"; else pass; fi; }
lines() {
  local n
  n=$(grep -c '^::error::' "$tmp/out")
  if [ "$n" -eq "$1" ]; then pass; else fail "${n} error lines, expected $1"; fi
}

none='{}'
admin_domain='{"resources":[{"address":"service.a","networking":{"serviceDomains":{"secret-host.up.railway.app":{"port":1}}}}]}'

run 'a graph with no endpoint passes' "$none" '{"resources":[{"address":"service.a","networking":{"privateNetworkEndpoint":"a"}}]}'
exits 0

run 'a resource without networking passes' "$none" '{"resources":[{"address":"volume.v","networking":null},{"address":"group.g"}]}'
exits 0

run 'a null endpoint kind is not an endpoint' "$none" '{"resources":[{"address":"database.d","networking":{"tcpProxies":null}}]}'
exits 0

run 'an empty endpoint kind is not an endpoint' "$none" '{"resources":[{"address":"service.a","networking":{"serviceDomains":{},"customDomains":{}}}]}'
exits 0

run 'an endpoint nobody allowed fails' "$none" "$admin_domain"
exits 1
says '::error::service.a exposes serviceDomains'

run 'a hostname is never printed' "$none" "$admin_domain"
never_says 'secret-host'

run 'an allowed endpoint passes' '{"service.a":["serviceDomains"]}' "$admin_domain"
exits 0

run 'a kind is allowed per resource' '{"service.b":["serviceDomains"]}' "$admin_domain"
exits 1

run 'a kind is allowed per kind' '{"service.a":["customDomains"]}' "$admin_domain"
exits 1

run 'a TCP proxy fails' "$none" '{"resources":[{"address":"database.Postgres","networking":{"tcpProxies":{"5432":{}}}}]}'
exits 1
says '::error::database.Postgres exposes tcpProxies'

run 'a custom domain fails' "$none" '{"resources":[{"address":"service.a","networking":{"customDomains":{"x.example.com":{}}}}]}'
exits 1
says 'exposes customDomains'

run 'every violation is reported' "$none" '{"resources":[{"address":"service.a","networking":{"serviceDomains":{"h":{}},"tcpProxies":{"1":{}}}},{"address":"service.b","networking":{"customDomains":{"h":{}}}}]}'
exits 1
lines 3

run 'an allowed kind does not hide another' '{"service.a":["serviceDomains"]}' '{"resources":[{"address":"service.a","networking":{"serviceDomains":{"h":{}},"tcpProxies":{"1":{}}}}]}'
exits 1
lines 1

name='a missing allow-list is a failure'
echo '{"resources":[]}' | bash "$guard" "$tmp/does-not-exist.json" >"$tmp/out" 2>&1
status=$?
fails

name='a graph that is not JSON is a failure'
echo 'not json' | bash "$guard" "$tmp/allow.json" >"$tmp/out" 2>&1
status=$?
fails

finish check-railway-exposure assertions
