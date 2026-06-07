#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Loop 06: Album art ==="

fail() {
  echo "FAIL  $1" >&2
  exit 1
}

rg -q "currentTrackId|currentAlbumId" src/sonos/client.ts || fail "client missing track/album identity fields"
rg -q "albumArtImage" src/core/plugin-core.ts || fail "plugin-core missing albumArtImage renderer"

# Loop 06 complete when http(s) art fetch or broker URL path exists beyond data: URIs only.
if rg -q "function albumArtImage" src/core/plugin-core.ts; then
  if ! rg -q "http|fetch.*art|albumArtUrl|currentAlbumImageUrl" src/core/plugin-core.ts; then
    fail "album art path does not handle http(s) or broker album URLs yet"
  fi
fi

npm run smoke

echo "PASS  album art identity + URL path checks"
echo "<promise>ALBUM_ART_COMPLETE</promise>"
