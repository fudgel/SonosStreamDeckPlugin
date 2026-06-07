# Implementation Status

## Purpose

This document captures the current state of the `SonosStreamDeck` implementation so re-entry is faster and next steps stay obvious.

## Current State

**Stub milestone complete (2026-06-07).** The plugin is fully wired against the internal broker stub for Sonos auth, group discovery, command writes, state bootstrap, SSE live updates, capability-aware rendering, album art, and Stream Deck hardware feedback.

Ralph loops 01–07 are complete. Automated gate: `bash ralph/verify/run-all.sh`.

## Stub Milestone Checklist

| Area | Status |
|------|--------|
| Connect + default group | PI `fetch` + `setGlobalSettings`; optional per-key override |
| SSE / live state | Fetch-based SSE (`src/sonos/sse-stream.ts`); no `EventSource` |
| Action coverage | All five broker commands + encoder; hardware checklist signed off |
| PI cleanup | No PI `sendToPlugin` / `setSettings`; groups via PI `fetch` |
| PI polish | Stale/missing default warnings, clear override, DevTools docs |
| Capability UI | Skip/pause `Off` / `Locked` titles; encoder push descriptions |
| Album art | Broker art by item identity; SVG fallback; cache-bust on track revisit |
| Verification | `npm run smoke` + `ralph/verify/run-all.sh` |

See [worklog/2026-06-07-stream-deck-connect-investigation.md](./worklog/2026-06-07-stream-deck-connect-investigation.md) for the connect investigation arc.

## What Is Already Implemented

### Stream Deck Plugin Scaffold

- official Stream Deck SDK structure
- manifest, assets, and property inspector
- Rollup build and watch flow
- plugin validation passes

### Registered Actions

- Play / Pause
- Mute / Unmute
- Next Track
- Previous Track
- Play Mode
- Album Art
- Stream Deck Plus now-playing encoder

### Plugin-Core Layers

- explicit global-vs-action settings boundary
- plugin-core singleton for shared coordination
- shared in-process state store
- visible action registry with shared per-target runtimes
- typed Sonos client seam
- connection-loss downgrade flow for reconnect-required failures

### Sonos Client And Runtime Boundary

The plugin routes auth, discovery, commands, state bootstrap, and SSE subscriptions through a real service-facing seam.

Implemented client surface:

- `startAuthorization(...)`
- `fetchConnectionStatus(...)`
- `fetchGroups(...)`
- `sendCommand(...)`
- `fetchState(...)`
- `subscribe(...)`

Implemented command mapping:

- `play-pause` -> `playback.toggle`
- `mute-toggle` -> `group.mute.toggle`
- `next-track` -> `playback.next`
- `previous-track` -> `playback.previous`
- `play-mode` -> `playback.mode.cycle`
- encoder push/touch -> `playback.toggle`

### Live State And Rendering

- `SonosStateStore` tracks multiple Sonos groups using target keys
- `PluginCore` shares one fetch/subscription runtime per active configured group
- `fetchState(...)` bootstraps each target before subscribing
- `subscribe(...)` uses broker SSE with retryable disconnect handling
- local playback progress estimation runs at 1 Hz for album-art keys and the now-playing encoder
- playback metadata drives key titles, dial feedback, progress, and album art
- target state carries track/album identity alongside artwork URLs

### Property Inspector Behavior

- PI owns broker auth and group discovery via `fetch` to `/v1/sonos/*`
- connection metadata, `defaultTarget`, and optional per-key `actionTargets` persist through `setGlobalSettings`
- the plugin syncs targets on `didReceiveGlobalSettings`; PI does not use `sendToPlugin` or per-action `setSettings`

### Sonos Service Layer (Stub)

- internal broker stub: `scripts/sonos-broker-stub.mjs`
- endpoints: `/health`, `/v1/sonos/auth/start`, `/v1/sonos/connection`, `/v1/sonos/groups`, `/v1/sonos/commands`, `/v1/sonos/state`, `/v1/sonos/events`
- in-memory demo households, tracks, generated SVG artwork data URIs
- Sonos-like previous-track behavior (restart past 3s, skip back at start)

## Out Of Scope For Stub Milestone (Next Phase)

### Production Broker Integration

- replace stub auth and group discovery with real Sonos OAuth/token refresh
- persist broker state; exercise real Sonos API semantics

### Album Art (Production)

- fetch or proxy real HTTP(S) artwork from Sonos metadata (stub uses data URIs today)
- disk cache policy TBD

## Build And Verification Status

Verified locally:

- `npm install`
- `npm run build`
- `npm run validate`
- `npm run smoke`
- `bash ralph/verify/run-all.sh`

GitHub Actions runs `npm ci` and `npm run smoke`.

Hardware verification uses the local broker stub: connect in PI, set default group, exercise keys and encoder. See `ralph/loops/02-action-coverage/HARDWARE_CHECKLIST.md`.

## Product Boundary Reminder

The product is the installable Stream Deck plugin.

- users interact through the Stream Deck application and device hardware
- the property inspector is the only intended plugin UI surface
- any Sonos broker/service is internal support infrastructure only

## Next Recommended Steps

1. replace stub auth and group discovery with the real broker-backed Sonos flow
2. upgrade album-art handling from stub data URIs to real fetched or proxied artwork
3. extend capability-aware rendering (images/disabled states beyond title text)
