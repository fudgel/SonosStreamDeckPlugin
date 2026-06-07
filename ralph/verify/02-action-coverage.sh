#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

HOST="${SONOS_BROKER_HOST:-127.0.0.1}"
PORT="${SONOS_BROKER_PORT:-47831}"
BASE_URL="http://${HOST}:${PORT}"
SESSION_REF=""
HOUSEHOLD_ID="house_1"
GROUP_ID="group_1"
GROUP_NAME="Living Room"

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

json_field() {
  node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const value = ${1};
    if (value === undefined || value === null) process.exit(2);
    if (typeof value === 'object') console.log(JSON.stringify(value));
    else console.log(String(value));
  "
}

curl_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"

  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" \
      -H "content-type: application/json" \
      --data "$data"
  else
    curl -sS -X "$method" "$url"
  fi
}

echo "=== Loop 02: Action coverage ==="

bash ralph/helpers/ensure-broker.sh

auth_body="$(curl_json POST "${BASE_URL}/v1/sonos/auth/start" "{}")"
SESSION_REF="$(printf '%s' "$auth_body" | json_field "data.sessionRef" 2>/dev/null || true)"

if [[ -z "$SESSION_REF" ]]; then
  fail "POST /v1/sonos/auth/start did not return sessionRef"
fi

for attempt in 1 2 3 4 5; do
  sleep 1
  connection_body="$(curl_json GET "${BASE_URL}/v1/sonos/connection?sessionRef=${SESSION_REF}")"
  connection_status="$(printf '%s' "$connection_body" | json_field "data.connectionStatus" 2>/dev/null || true)"
  if [[ "$connection_status" == "connected" ]]; then
    break
  fi
done

if [[ "$connection_status" != "connected" ]]; then
  fail "connection did not reach connected"
fi

declare -a COMMANDS=(
  "playback.toggle"
  "playback.next"
  "playback.previous"
  "group.mute.toggle"
  "playback.mode.cycle"
)

for command_type in "${COMMANDS[@]}"; do
  command_body="$(
    curl_json POST "${BASE_URL}/v1/sonos/commands" "$(cat <<EOF
{
  "sessionRef": "${SESSION_REF}",
  "target": {
    "householdId": "${HOUSEHOLD_ID}",
    "groupId": "${GROUP_ID}",
    "groupName": "${GROUP_NAME}"
  },
  "command": {
    "type": "${command_type}"
  }
}
EOF
)"
  )"

  ok="$(printf '%s' "$command_body" | json_field "data.ok" 2>/dev/null || echo false)"
  accepted="$(printf '%s' "$command_body" | json_field "data.accepted" 2>/dev/null || echo false)"

  if [[ "$ok" != "true" || "$accepted" != "true" ]]; then
    fail "POST /v1/sonos/commands (${command_type}) not accepted"
  fi

  echo "PASS  POST /v1/sonos/commands (${command_type})"
done

echo
echo "== Action wiring =="
node ralph/helpers/verify-action-wiring.mjs

npm run smoke >/dev/null

echo
echo "Manual: complete ralph/loops/02-action-coverage/HARDWARE_CHECKLIST.md on Stream Deck hardware."
echo "<promise>ACTION_COVERAGE_COMPLETE</promise>"
