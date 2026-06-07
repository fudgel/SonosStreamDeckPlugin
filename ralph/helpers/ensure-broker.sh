#!/usr/bin/env bash
# Ensure broker stub is running; start if needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if node scripts/broker-stub.mjs status >/dev/null 2>&1; then
  exit 0
fi

node scripts/broker-stub.mjs start
sleep 1

if ! node scripts/broker-stub.mjs status >/dev/null 2>&1; then
  echo "FAIL: broker stub did not start" >&2
  exit 1
fi
