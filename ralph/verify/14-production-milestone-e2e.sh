#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 14: Production milestone E2E ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

PLAN="ralph/IMPLEMENTATION_PLAN-production.md"

for loop in "Loop 08" "Loop 09" "Loop 10" "Loop 11" "Loop 12" "Loop 13"; do
  if rg -q "\\- \\[ \\] \\*\\*${loop}" "$PLAN"; then
    fail "${loop} not marked complete in ${PLAN}"
  fi
done

npm run smoke

for script in ralph/verify/0{8,9}-*.sh ralph/verify/1{0,1,2,3}-*.sh; do
  echo "Re-running $(basename "$script")..."
  bash "$script"
done

rg -qi "production milestone" docs/implementation-status.md || \
  fail "implementation-status.md missing production milestone completion note"

echo "PASS  production milestone E2E gate"
echo "<promise>PRODUCTION_MILESTONE_COMPLETE</promise>"
