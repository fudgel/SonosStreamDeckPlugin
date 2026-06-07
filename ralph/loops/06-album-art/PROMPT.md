# Loop 06 — Album art

## Objective

Upgrade album art from stub data URIs / SVG fallback to artwork bound to the **current playing item** via broker-provided URLs or a fetch/proxy seam.

## State fields

- `currentTrackId`, `currentAlbumId` — identity for cache keys
- `albumArtUrl`, `currentAlbumImageUrl`, `currentTrackImageUrl`

## Modules

- `src/core/plugin-core.ts` — `albumArtImage()`, rendering path
- `src/sonos/client.ts` — optional art fetch helper if not broker-only
- `scripts/sonos-broker-stub.mjs` — realistic http(s) art URLs for testing (optional)

## Success criteria

1. `bash ralph/verify/06-album-art.sh` exits 0
2. Album art action displays broker URL art when provided; SVG fallback when missing
3. Art updates when track identity changes (SSE or state poll)

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN.md, ralph/AGENTS.md, and docs/worklog/2026-04-26-item-identity-safe-album-art.md.
Implement Loop 06 only — album art bound to playing item identity.

Prefer broker-provided albumArtUrl / currentAlbumImageUrl. Add fetch/cache seam if needed for http URLs
in plugin runtime. Keep SVG fallback. Do not break data URI stub art.

Run: bash ralph/verify/06-album-art.sh
Output <promise>ALBUM_ART_COMPLETE</promise> when verify exits 0.
```
