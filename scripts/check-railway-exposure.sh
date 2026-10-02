#!/usr/bin/env bash
# Fails when the Railway environment exposes a resource to the internet that
# `.railway/public-endpoints.json` does not allow. Reads the graph that
# `railway config pull --json` prints on stdin:
#
#   railway config pull --json | bash scripts/check-railway-exposure.sh
#
# Why this exists: `railway config plan` only compares what railway.ts declares, so a public domain
# or TCP proxy added in the dashboard is invisible to it. Only the address of the resource and the
# kind of endpoint are printed, never a hostname or a value from the graph.
set -euo pipefail

allow="${1:-$(dirname "$0")/../.railway/public-endpoints.json}"

violations=$(jq -r --slurpfile allow "$allow" '
  ($allow[0] // {}) as $allowed
  | .resources[]
  | select(.networking != null)
  | .address as $address
  | .networking
  | to_entries[]
  | select(.key | IN("serviceDomains", "customDomains", "tcpProxies"))
  | select(.value != null and (.value | length) > 0)
  | .key as $kind
  | select(($allowed[$address] // []) | index($kind) | not)
  | "\($address) exposes \($kind)"
')

if [ -n "$violations" ]; then
  while IFS= read -r line; do
    echo "::error::$line, which .railway/public-endpoints.json does not allow."
  done <<< "$violations"
  exit 1
fi
echo 'Every public endpoint in Railway is allowed by .railway/public-endpoints.json.'
