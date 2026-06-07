#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 01: SSE / live state ==="

bash ralph/helpers/ensure-broker.sh

echo "Running baseline smoke (build, validate, tsc, broker tests)..."
npm run smoke

echo "Testing fetch-based SSE against stub..."
node ralph/helpers/test-node-eventsource.mjs

echo "<promise>SSE_LIVE_STATE_COMPLETE</promise>"
