#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 05: Capability-aware UI ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

rg -q "availableActions" src/sonos/client.ts || fail "client missing availableActions parsing"
rg -q "capability-ui" src/core/plugin-core.ts || fail "plugin-core missing capability-ui integration"
rg -q "isSkipForwardAvailable|isSkipBackAvailable|playPauseKeyTitle|capabilityKeyTitle" src/core/capability-ui.ts || fail "capability-ui helpers missing"

bash ralph/helpers/ensure-broker.sh
node scripts/broker-stub.mjs restart
sleep 1
node ralph/helpers/verify-capability-ui.mjs

npm run smoke

echo "PASS  capability-aware UI wiring present"
echo "<promise>CAPABILITY_UI_COMPLETE</promise>"
