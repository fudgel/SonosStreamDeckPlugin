#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 03: PI dead-code cleanup ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

# Broken paths should be removed or explicitly gated off.
if rg -n "type: \"sync-connection\"" com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js >/dev/null 2>&1; then
  fail "settings.js still sends sync-connection via sendToPlugin"
fi

if rg -n "type: \"refresh-groups\"" com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js >/dev/null 2>&1; then
  fail "settings.js still sends refresh-groups via sendToPlugin"
fi

if rg -n "type: \"request-snapshot\"" com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js >/dev/null 2>&1; then
  fail "settings.js still sends request-snapshot via sendToPlugin"
fi

if rg -n "sync-connection" src/core/plugin-core.ts >/dev/null 2>&1; then
  fail "plugin-core still handles sync-connection PI messages"
fi

if rg -n "\\.setSettings\\(" src/actions/sonos-action.ts >/dev/null 2>&1; then
  fail "sonos-action.ts still calls PI setSettings (use global actionTargets instead)"
fi

# Working path must remain.
rg -q "defaultTarget" com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js || fail "settings.js missing defaultTarget global settings path"
rg -q "actionTargets" com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js || fail "settings.js missing actionTargets global settings path"
rg -q "refreshGroupsInPI" com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js || fail "settings.js missing PI-owned group refresh"
rg -q "syncVisibleActionTargetsFromGlobalSettings|defaultTarget|actionTargets" src/core/plugin-core.ts || fail "plugin-core missing global target sync"

npm run smoke

echo "PASS  PI uses global-settings-only target path"
echo "<promise>PI_DEAD_CODE_COMPLETE</promise>"
