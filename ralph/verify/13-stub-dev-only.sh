#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 13: Stub dev-only ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

test -f scripts/sonos-broker-stub.mjs || fail "stub must remain for CI: scripts/sonos-broker-stub.mjs"

rg -q "broker:stub|47831" package.json || fail "package.json must keep broker:stub on 47831 for CI"

rg -q "broker:prod|47832|services/sonos-broker" README.md || \
  fail "README.md must document production broker as real Sonos path"

! rg -q "demo households|mock tracks" README.md || \
  fail "README still presents stub demo content as primary path without prod distinction"

npm run smoke >/dev/null

bash ralph/verify/12-sonos-subscriptions-sse.sh >/dev/null

echo "PASS  stub dev-only separation"
echo "<promise>STUB_DEV_ONLY_COMPLETE</promise>"
