# Loop 10 — Groups + state bootstrap

## Objective

Back `GET /v1/sonos/groups` and `GET /v1/sonos/state` with **live Sonos Control API** data, normalized to the plugin contract including item identity fields.

## Sonos API mapping (indicative)

- Households / groups — groups subscription or households API (see `docs/sonos-api-notes.md`)
- Playback + metadata — `getPlaybackStatus`, `getMetadataStatus` (or subscription snapshot)

## Normalized state must include

- `playbackStatus`, `positionMillis`, `durationMillis`
- `currentTrackTitle`, `currentArtistName`, `currentAlbumName`
- `currentTrackId`, `currentAlbumId` (Sonos service object ids)
- `currentTrackImageUrl`, `currentAlbumImageUrl`, `albumArtUrl` (prefer track image, then album)
- `availableActions.canSkip`, `canSkipBack`, `canPause`
- `isMuted`, `playModeLabel`

## Success criteria

1. `bash ralph/verify/10-sonos-discovery-state.sh` exits 0
2. Connected session returns real households/groups from Sonos account
3. State snapshot for a configured group matches contract shape (integration test or recorded fixture when offline)

## Out of scope

- Command writes (Loop 11)
- Live SSE fan-out (Loop 12) — state may be on-demand fetch only in this loop

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN-production.md, docs/sonos-service-contract.md,
docs/worklog/2026-04-26-item-identity-safe-album-art.md, and docs/sonos-api-notes.md.
Implement Loop 10 only — Sonos groups + state bootstrap in the production broker.

Run: bash ralph/verify/10-sonos-discovery-state.sh
Output <promise>SONOS_DISCOVERY_STATE_COMPLETE</promise> when verify exits 0.
```
