#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 11: Sonos command writes ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

test -f services/sonos-broker/src/commands.mjs || fail "missing services/sonos-broker/src/commands.mjs"

for cmd in playback.toggle playback.next playback.previous group.mute.toggle playback.mode.cycle; do
  rg -q "$cmd" services/sonos-broker/src/commands.mjs || fail "commands.mjs missing $cmd handler"
done

if [[ -n "${SONOS_INTEGRATION_TEST:-}" ]]; then
  node ralph/helpers/verify-production-commands.mjs
else
  echo "SKIP  live Sonos commands (set SONOS_INTEGRATION_TEST=1 to enable)"
fi

bash ralph/verify/10-sonos-discovery-state.sh >/dev/null

echo "PASS  Sonos command writes"
echo "<promise>SONOS_COMMANDS_COMPLETE</promise>"
