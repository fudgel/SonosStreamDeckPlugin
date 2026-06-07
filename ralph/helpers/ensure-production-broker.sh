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

if ! curl -sS -o /dev/null --connect-timeout 1 "${BASE_URL}/health" 2>/dev/null; then
  if ! npm run broker:prod:start >/dev/null 2>&1; then
    fail "production broker not running; implement Loop 08 and add npm run broker:prod:start"
  fi
  for attempt in 1 2 3 4 5; do
    sleep 1
    if curl -sS -o /dev/null --connect-timeout 1 "${BASE_URL}/health" 2>/dev/null; then
      break
    fi
  done
fi

curl -sS "${BASE_URL}/health" >/dev/null || fail "production broker unreachable at ${BASE_URL}"
