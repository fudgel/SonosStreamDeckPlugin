#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 07: Stub milestone E2E ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

PLAN="ralph/IMPLEMENTATION_PLAN.md"

for loop in "Loop 01" "Loop 02" "Loop 03" "Loop 04" "Loop 05" "Loop 06"; do
  if rg -q "\\- \\[ \\] \\*\\*${loop}" "$PLAN"; then
    fail "${loop} not marked complete in ${PLAN}"
  fi
done

npm run smoke

for script in ralph/verify/0{1,2,3,4,5,6}-*.sh; do
  echo "Re-running $(basename "$script")..."
  bash "$script"
done

rg -qi "stub milestone" docs/implementation-status.md || fail "implementation-status.md missing stub milestone completion note"

echo "PASS  stub milestone E2E gate"
echo "<promise>STUB_MILESTONE_COMPLETE</promise>"
