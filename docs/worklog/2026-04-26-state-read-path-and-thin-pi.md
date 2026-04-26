# Worklog: 2026-04-26 State Read Path And Thin PI

## Session Goal

Finish the first end-to-end broker-backed Sonos loop inside the Stream Deck plugin: auth kickoff, connection polling, group discovery, target-aware state bootstrap, SSE live updates, and visible action rendering.

## Updated

- `src/core/plugin-core.ts`
- `src/core/state-store.ts`
- `src/sonos/client.ts`
- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js`
- `scripts/sonos-broker-stub.mjs`

## Implemented

- Made `SonosStateStore` target-aware so it can cache multiple visible groups at once.
- Centralized visible action tracking in `PluginCore` and shared one runtime per configured target group.
- Added broker-backed `fetchState(...)` and SSE `subscribe(...)` support in `HttpSonosClient`.
- Added SSE preflight probing so structured auth and target failures surface cleanly before `EventSource` is opened.
- Added a thin property inspector flow where settings persist directly through Stream Deck while auth and discovery stay plugin-driven.
- Hardened PI-to-plugin messaging by passing `serviceBaseUrl` explicitly during auth and group refresh requests.
- Added 1 Hz local progress rendering for album-art keys and the now-playing encoder.
- Expanded the broker stub with auth, connection, group discovery, state, events, mock playback metadata, and generated artwork.

## Notes

- `not_connected` failures now trigger a connection-loss recovery flow that downgrades the plugin back to a reconnect-required state.
- Album art still uses broker-provided data URIs or plugin-generated SVG fallback imagery; real artwork fetching remains a later phase.
- Capability flags are now present in the state model, but the key rendering layer does not yet vary visuals based on those capabilities.

## Follow-Up

1. Replace stub-backed auth and discovery with the production broker flow.
2. Support real fetched or proxied album art.
3. Use capability flags to dim or otherwise differentiate unavailable transport controls.
4. Tighten property inspector handling for stale or missing target selections.
