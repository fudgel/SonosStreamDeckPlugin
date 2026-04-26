# Implementation Status

## Purpose

This document captures the current state of the `SonosStreamDeck` implementation so re-entry is faster and next steps stay obvious.

## Current State

The plugin is now fully wired against the internal broker stub for Sonos auth, group discovery, command writes, state bootstrap, SSE live updates, and Stream Deck rendering.

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

The plugin now routes auth, discovery, commands, state bootstrap, and SSE subscriptions through a real service-facing seam rather than placeholder logging or one-off action-local state.

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

- `SonosStateStore` now tracks multiple Sonos groups simultaneously using target keys
- `PluginCore` tracks visible actions and shares one fetch/subscription runtime per active configured group
- `fetchState(...)` bootstraps each active target before subscribing
- `subscribe(...)` now listens to broker SSE updates and retries retryable disconnects
- local playback progress estimation runs on a 1 Hz timer for album-art keys and the now-playing encoder
- real playback metadata now drives key titles, dial feedback, progress, and dynamic SVG album art

### Property Inspector Behavior

- the property inspector now follows a thin-client model and persists settings directly through Stream Deck
- Sonos auth and group discovery are delegated to the plugin over PI messaging
- auth and group refresh messages carry `serviceBaseUrl` explicitly to avoid persistence races
- discovered Sonos groups can be assigned per action

### Sonos Service Layer

- internal broker stub exists as `scripts/sonos-broker-stub.mjs`
- `/health` exists in the broker stub
- `/v1/sonos/commands` exists in the broker stub
- `/v1/sonos/state` exists in the broker stub
- `/v1/sonos/events` exists in the broker stub as SSE
- `/v1/sonos/auth/start` exists in the broker stub
- `/v1/sonos/connection` exists in the broker stub
- `/v1/sonos/groups` exists in the broker stub
- broker state is currently in-memory demo state only, including mock households, mock tracks, and generated artwork data URIs

## Current Gaps And In-Progress Areas

### Production Broker Integration

- auth and group discovery are still stub-backed, not real Sonos production flows
- the broker stub does not persist state or exercise real Sonos OAuth/token refresh behavior

### Album Art

- current album art is either broker-provided data URIs or plugin-generated SVG fallback art
- real fetched or proxied album art handling is still pending

### Capability-Aware Rendering

- skip and pause capability flags are parsed but not yet reflected in button enablement or alternate visuals

### Property Inspector Polish

- stale or missing group selections still need tighter validation and clearer recovery UX

## Build And Verification Status

Verified locally:

- `npm install`
- `npm run build`
- `npm run validate`
- `npm run broker:stub`

Build and validation pass. The broker stub is available for local end-to-end exercise.

There is not yet an automated unit or integration test suite in the repository. Current verification is local build validation plus manual testing against the local broker stub in Stream Deck, with GitHub Actions also running `npm ci`, `npm run build`, and `npm run validate`.

## Product Boundary Reminder

The product is the installable Stream Deck plugin.

- users interact through the Stream Deck application and device hardware
- the property inspector is the only intended plugin UI surface
- any Sonos broker/service is internal support infrastructure only

## Next Recommended Steps

1. replace stub auth and group discovery with the real broker-backed Sonos flow
2. upgrade album-art handling from stub data URIs to real fetched or proxied artwork
3. add richer capability-aware rendering for skip and pause availability
4. tighten property inspector polish and validation around empty or stale targets
