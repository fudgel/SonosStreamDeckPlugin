#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 04: PI polish ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

rg -q "23654" docs/troubleshooting.md || fail "troubleshooting.md missing PI DevTools localhost:23654 guidance"
rg -q "html_remote_debugging_enabled" docs/troubleshooting.md || fail "troubleshooting.md missing Stream Deck remote debugging defaults write"

# Stale / missing group UX hooks (adjust patterns if implementation uses different names).
if ! rg -qi "stale|missing|no group|select a group|not found" com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js; then
  fail "settings.js missing stale/missing group user-facing copy"
fi

npm run smoke

echo "PASS  PI polish checks"
echo "<promise>PI_POLISH_COMPLETE</promise>"
