#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 10: Groups + state bootstrap ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

test -f services/sonos-broker/src/groups.mjs || fail "missing services/sonos-broker/src/groups.mjs"
test -f services/sonos-broker/src/state.mjs || fail "missing services/sonos-broker/src/state.mjs"

rg -q "currentTrackId|albumArtUrl|availableActions" services/sonos-broker/src/state.mjs || \
  fail "state.mjs missing contract normalization fields"

if [[ -n "${SONOS_INTEGRATION_TEST:-}" ]]; then
  node ralph/helpers/verify-production-groups-state.mjs
else
  echo "SKIP  live Sonos groups/state (set SONOS_INTEGRATION_TEST=1 with connected session to enable)"
fi

bash ralph/verify/09-sonos-oauth.sh >/dev/null

echo "PASS  Sonos discovery + state bootstrap"
echo "<promise>SONOS_DISCOVERY_STATE_COMPLETE</promise>"
