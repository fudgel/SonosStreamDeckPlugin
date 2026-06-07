#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PROD_HOST="${SONOS_BROKER_PROD_HOST:-127.0.0.1}"
PROD_PORT="${SONOS_BROKER_PROD_PORT:-47832}"
BASE_URL="http://${PROD_HOST}:${PROD_PORT}"

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

echo "=== Loop 08: Production broker scaffold ==="

test -d services/sonos-broker || fail "missing services/sonos-broker/"
test -f services/sonos-broker/package.json || fail "missing services/sonos-broker/package.json"
test -f services/sonos-broker/README.md || fail "missing services/sonos-broker/README.md"

rg -q "broker:prod" package.json || fail "package.json missing broker:prod script"

bash ralph/helpers/ensure-production-broker.sh

health_body="$(curl -sS "${BASE_URL}/health")"
ok="$(printf '%s' "$health_body" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(String(d.ok===true));")"
if [[ "$ok" != "true" ]]; then
  fail "GET /health did not return ok:true"
fi
echo "PASS  GET /health"

for path in \
  "/v1/sonos/auth/start:POST" \
  "/v1/sonos/connection:GET" \
  "/v1/sonos/groups:GET" \
  "/v1/sonos/state:GET" \
  "/v1/sonos/events:GET" \
  "/v1/sonos/commands:POST"; do
  route="${path%%:*}"
  method="${path##*:}"
  query=""
  if [[ "$route" == *connection* || "$route" == *groups* || "$route" == *state* || "$route" == *events* ]]; then
    query="?sessionRef=test&householdId=h&groupId=g"
  fi

  if [[ "$method" == "POST" ]]; then
    status="$(
      curl -sS -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "content-type: application/json" \
        --data "{}" \
        "${BASE_URL}${route}${query}"
    )"
  else
    status="$(
      curl -sS -o /dev/null -w "%{http_code}" \
        -X "$method" \
        "${BASE_URL}${route}${query}"
    )"
  fi

  if [[ "$status" =~ ^[45][0-9][0-9]$ || "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "PASS  ${method} ${route} (HTTP ${status})"
  else
    fail "${method} ${route} unexpected HTTP ${status}"
  fi
done

npm run smoke >/dev/null

echo "PASS  production broker scaffold"
echo "<promise>PRODUCTION_BROKER_SCAFFOLD_COMPLETE</promise>"
