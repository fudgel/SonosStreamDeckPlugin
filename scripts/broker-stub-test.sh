#!/usr/bin/env bash

set -euo pipefail

HOST="${SONOS_BROKER_HOST:-127.0.0.1}"
PORT="${SONOS_BROKER_PORT:-47831}"
BASE_URL="http://${HOST}:${PORT}"

PASS_COUNT=0
FAIL_COUNT=0
SESSION_REF=""
HOUSEHOLD_ID="house_1"
GROUP_ID="group_1"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Run curl-based smoke checks against the local Sonos broker stub.

Options:
  --host <host>   Broker host (default: ${HOST})
  --port <port>   Broker port (default: ${PORT})
  --help, -h      Show this help

Environment:
  SONOS_BROKER_HOST
  SONOS_BROKER_PORT

Examples:
  npm run smoke
  npm run broker:test
  ./scripts/broker-stub-test.sh --port 47831
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

BASE_URL="http://${HOST}:${PORT}"

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS  $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "FAIL  $1"
  if [[ $# -gt 1 ]]; then
    echo "      $2"
  fi
}

json_field() {
  local expression="$1"
  node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const value = ${expression};
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

assert_json_ok() {
  local name="$1"
  local body="$2"
  local ok

  if ! ok="$(printf '%s' "$body" | json_field "data.ok" 2>/dev/null)"; then
    fail "$name" "Response was not valid JSON."
    return 1
  fi

  if [[ "$ok" == "true" ]]; then
    pass "$name"
    return 0
  fi

  local code message
  code="$(printf '%s' "$body" | json_field "data.code" 2>/dev/null || echo "unknown")"
  message="$(printf '%s' "$body" | json_field "data.message" 2>/dev/null || echo "unknown error")"
  fail "$name" "${code}: ${message}"
  return 1
}

wait_for_connected() {
  local session_ref="$1"
  local attempt connection_body connection_status

  for attempt in 1 2 3 4 5; do
    sleep 1
    connection_body="$(
      curl_json GET "${BASE_URL}/v1/sonos/connection?sessionRef=${session_ref}"
    )"

    if [[ "$(printf '%s' "$connection_body" | json_field "data.ok" 2>/dev/null || echo false)" == "true" ]]; then
      connection_status="$(
        printf '%s' "$connection_body" | json_field "data.connectionStatus"
      )"

      if [[ "$connection_status" == "connected" ]]; then
        echo "$connection_body"
        return 0
      fi
    fi
  done

  return 1
}

echo "Sonos broker stub smoke test"
echo "Target: ${BASE_URL}"
echo

echo "== Reachability =="

if ! health_body="$(curl_json GET "${BASE_URL}/health")"; then
  fail "GET /health" "Could not reach ${BASE_URL}. Start the stub with: npm run broker:start"
  echo
  echo "Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
  exit 1
fi

if assert_json_ok "GET /health" "$health_body"; then
  service_name="$(printf '%s' "$health_body" | json_field "data.service" 2>/dev/null || true)"
  if [[ -n "$service_name" ]]; then
    echo "      service=${service_name}"
  fi
fi

cors_status="$(
  curl -sS -o /dev/null -w "%{http_code}" \
    -X OPTIONS "${BASE_URL}/v1/sonos/auth/start" \
    -H "Origin: null" \
    -H "Access-Control-Request-Method: POST"
)"

if [[ "$cors_status" == "204" || "$cors_status" == "200" ]]; then
  pass "OPTIONS /v1/sonos/auth/start (CORS preflight)"
else
  fail "OPTIONS /v1/sonos/auth/start (CORS preflight)" "Expected HTTP 204 or 200, got ${cors_status}"
fi

echo
echo "== Auth flow (PI auto-connect path) =="

auth_body="$(curl_json POST "${BASE_URL}/v1/sonos/auth/start" "{}")"
if assert_json_ok "POST /v1/sonos/auth/start" "$auth_body"; then
  SESSION_REF="$(printf '%s' "$auth_body" | json_field "data.sessionRef")"
  authorize_url="$(printf '%s' "$auth_body" | json_field "data.authorizeUrl")"
  echo "      sessionRef=${SESSION_REF}"
  echo "      authorizeUrl=${authorize_url}"
fi

if [[ -n "$SESSION_REF" ]]; then
  if connection_body="$(wait_for_connected "$SESSION_REF")"; then
    pass "GET /v1/sonos/connection auto-connects without browser login"
    connection_status="$(
      printf '%s' "$connection_body" | json_field "data.connectionStatus"
    )"
    echo "      connectionStatus=${connection_status}"
  else
    fail "GET /v1/sonos/connection auto-connects without browser login" \
      "Expected connected within ~5s (stub readyAt delay)"
  fi

  login_status="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      "${BASE_URL}/mock-sonos-login?sessionRef=${SESSION_REF}"
  )"

  if [[ "$login_status" == "200" ]]; then
    pass "GET /mock-sonos-login (optional browser path)"
  else
    fail "GET /mock-sonos-login (optional browser path)" "Expected HTTP 200, got ${login_status}"
  fi
fi

echo
echo "== Discovery and state =="

if [[ -n "$SESSION_REF" ]]; then
  groups_body="$(
    curl_json GET "${BASE_URL}/v1/sonos/groups?sessionRef=${SESSION_REF}"
  )"

  if assert_json_ok "GET /v1/sonos/groups" "$groups_body"; then
    household_count="$(
      printf '%s' "$groups_body" | json_field "(data.households || []).length"
    )"
    echo "      households=${household_count}"
  fi

  state_body="$(
    curl_json GET \
      "${BASE_URL}/v1/sonos/state?sessionRef=${SESSION_REF}&householdId=${HOUSEHOLD_ID}&groupId=${GROUP_ID}"
  )"

  if assert_json_ok "GET /v1/sonos/state" "$state_body"; then
    playback_status="$(
      printf '%s' "$state_body" | json_field "data.state.playbackStatus" 2>/dev/null || true
    )"
    track_title="$(
      printf '%s' "$state_body" | json_field "data.state.currentTrackTitle" 2>/dev/null || true
    )"
    echo "      playbackStatus=${playback_status:-unknown}"
    if [[ -n "$track_title" ]]; then
      echo "      currentTrackTitle=${track_title}"
    fi
  fi
fi

echo
echo "== Commands =="

if [[ -n "$SESSION_REF" ]]; then
  command_body="$(
    curl_json POST "${BASE_URL}/v1/sonos/commands" "$(cat <<EOF
{
  "sessionRef": "${SESSION_REF}",
  "target": {
    "householdId": "${HOUSEHOLD_ID}",
    "groupId": "${GROUP_ID}",
    "groupName": "Living Room"
  },
  "command": {
    "type": "playback.toggle"
  }
}
EOF
)"
  )"

  if assert_json_ok "POST /v1/sonos/commands (playback.toggle)" "$command_body"; then
    accepted="$(
      printf '%s' "$command_body" | json_field "data.accepted" 2>/dev/null || true
    )"
    echo "      accepted=${accepted:-unknown}"
  fi

  next_body="$(
    curl_json POST "${BASE_URL}/v1/sonos/commands" "$(cat <<EOF
{
  "sessionRef": "${SESSION_REF}",
  "target": {
    "householdId": "${HOUSEHOLD_ID}",
    "groupId": "${GROUP_ID}"
  },
  "command": {
    "type": "playback.next"
  }
}
EOF
)"
  )"

  if assert_json_ok "POST /v1/sonos/commands (playback.next)" "$next_body"; then
    sleep 4

    state_after_next="$(
      curl_json GET \
        "${BASE_URL}/v1/sonos/state?sessionRef=${SESSION_REF}&householdId=${HOUSEHOLD_ID}&groupId=${GROUP_ID}"
    )"
    track_before_previous="$(
      printf '%s' "$state_after_next" | json_field "data.state.currentTrackTitle" 2>/dev/null || true
    )"

    restart_body="$(
      curl_json POST "${BASE_URL}/v1/sonos/commands" "$(cat <<EOF
{
  "sessionRef": "${SESSION_REF}",
  "target": {
    "householdId": "${HOUSEHOLD_ID}",
    "groupId": "${GROUP_ID}"
  },
  "command": {
    "type": "playback.previous"
  }
}
EOF
)"
    )"

    if assert_json_ok "POST /v1/sonos/commands (playback.previous restart)" "$restart_body"; then
      state_after_restart="$(
        curl_json GET \
          "${BASE_URL}/v1/sonos/state?sessionRef=${SESSION_REF}&householdId=${HOUSEHOLD_ID}&groupId=${GROUP_ID}"
      )"
      track_after_restart="$(
        printf '%s' "$state_after_restart" | json_field "data.state.currentTrackTitle" 2>/dev/null || true
      )"
      position_after_restart="$(
        printf '%s' "$state_after_restart" | json_field "data.state.positionMillis" 2>/dev/null || true
      )"

      if [[ "$track_after_restart" == "$track_before_previous" && "${position_after_restart:-999}" -le 1000 ]]; then
        pass "playback.previous restarts current track when past threshold"
      else
        fail "playback.previous restarts current track when past threshold" \
          "expected same track (${track_before_previous}) near start, got ${track_after_restart} @ ${position_after_restart}ms"
      fi
    fi

    skip_back_body="$(
      curl_json POST "${BASE_URL}/v1/sonos/commands" "$(cat <<EOF
{
  "sessionRef": "${SESSION_REF}",
  "target": {
    "householdId": "${HOUSEHOLD_ID}",
    "groupId": "${GROUP_ID}"
  },
  "command": {
    "type": "playback.previous"
  }
}
EOF
)"
    )"

    if assert_json_ok "POST /v1/sonos/commands (playback.previous skip back)" "$skip_back_body"; then
      state_after_skip_back="$(
        curl_json GET \
          "${BASE_URL}/v1/sonos/state?sessionRef=${SESSION_REF}&householdId=${HOUSEHOLD_ID}&groupId=${GROUP_ID}"
      )"
      track_after_skip_back="$(
        printf '%s' "$state_after_skip_back" | json_field "data.state.currentTrackTitle" 2>/dev/null || true
      )"

      if [[ "$track_after_skip_back" != "$track_before_previous" ]]; then
        pass "playback.previous skips back when at track start"
        echo "      ${track_before_previous} -> ${track_after_skip_back}"
      else
        fail "playback.previous skips back when at track start" \
          "expected different track after second previous, still on ${track_after_skip_back}"
      fi
    fi
  fi
fi

echo
echo "== SSE =="

if [[ -n "$SESSION_REF" ]]; then
  sse_output="$(
    curl -sS -N --max-time 2 \
      "${BASE_URL}/v1/sonos/events?sessionRef=${SESSION_REF}&householdId=${HOUSEHOLD_ID}&groupId=${GROUP_ID}" \
      2>/dev/null || true
  )"

  if [[ "$sse_output" == *"event:"* || "$sse_output" == *"data:"* ]]; then
    pass "GET /v1/sonos/events (initial SSE frame)"
  else
    fail "GET /v1/sonos/events (initial SSE frame)" "No SSE event/data lines received"
  fi
fi

echo
echo "Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
