#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 12: Subscriptions → SSE ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

test -f services/sonos-broker/src/subscriptions.mjs || fail "missing services/sonos-broker/src/subscriptions.mjs"
test -f services/sonos-broker/src/sse.mjs || fail "missing services/sonos-broker/src/sse.mjs"

rg -q "event: state|text/event-stream" services/sonos-broker/src/sse.mjs || \
  fail "sse.mjs missing event: state SSE framing"

if [[ -n "${SONOS_INTEGRATION_TEST:-}" ]]; then
  node ralph/helpers/verify-production-sse.mjs
else
  echo "SKIP  live Sonos SSE (set SONOS_INTEGRATION_TEST=1 to enable)"
fi

bash ralph/verify/11-sonos-commands.sh >/dev/null

echo "PASS  Sonos subscriptions → SSE"
echo "<promise>SONOS_SUBSCRIPTIONS_SSE_COMPLETE</promise>"
