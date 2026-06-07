#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

scripts=(
  "ralph/verify/08-production-broker-scaffold.sh"
  "ralph/verify/09-sonos-oauth.sh"
  "ralph/verify/10-sonos-discovery-state.sh"
  "ralph/verify/11-sonos-commands.sh"
  "ralph/verify/12-sonos-subscriptions-sse.sh"
  "ralph/verify/13-stub-dev-only.sh"
  "ralph/verify/14-production-milestone-e2e.sh"
)

for script in "${scripts[@]}"; do
  echo
  bash "$script"
done

echo
echo "All production Ralph verify scripts passed."
