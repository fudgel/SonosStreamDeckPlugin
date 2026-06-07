#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 09: Sonos OAuth + sessions ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

test -f services/sonos-broker/src/auth.mjs || fail "missing services/sonos-broker/src/auth.mjs"
test -f services/sonos-broker/src/sessions.mjs || fail "missing services/sonos-broker/src/sessions.mjs"

rg -q "SONOS_CLIENT_ID|SONOS_CLIENT_SECRET|SONOS_REDIRECT_URI" services/sonos-broker/README.md || \
  fail "services/sonos-broker/README.md missing Sonos env documentation"

if [[ -n "${SONOS_CLIENT_ID:-}" && -n "${SONOS_CLIENT_SECRET:-}" && -n "${SONOS_REDIRECT_URI:-}" ]]; then
  bash ralph/helpers/ensure-production-broker.sh
  bash ralph/helpers/verify-production-oauth.mjs
else
  echo "SKIP  live OAuth integration (set SONOS_CLIENT_ID, SONOS_CLIENT_SECRET, SONOS_REDIRECT_URI to enable)"
  rg -q "authorizeUrl" services/sonos-broker/src/auth.mjs || fail "auth.mjs missing authorizeUrl handling"
fi

bash ralph/verify/08-production-broker-scaffold.sh >/dev/null

echo "PASS  Sonos OAuth scaffold"
echo "<promise>SONOS_OAUTH_COMPLETE</promise>"
