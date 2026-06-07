#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

scripts=(
  "ralph/verify/01-sse-live-state.sh"
  "ralph/verify/02-action-coverage.sh"
  "ralph/verify/03-pi-dead-code.sh"
  "ralph/verify/04-pi-polish.sh"
  "ralph/verify/05-capability-ui.sh"
  "ralph/verify/06-album-art.sh"
  "ralph/verify/07-stub-milestone-e2e.sh"
)

for script in "${scripts[@]}"; do
  echo
  bash "$script"
done

echo
echo "All Ralph verify scripts passed."
