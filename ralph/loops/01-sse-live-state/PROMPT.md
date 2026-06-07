# Loop 01 — SSE / live state

## Objective

Fix plugin SSE subscription against the local broker stub so live playback state reaches `PluginCore` / `SonosStateStore`. After connect + group assignment, album art, key titles, and encoder feedback should update without requiring a key press.

## Context

- Broker SSE works: `npm run broker:test` passes `GET /v1/sonos/events`.
- Hardware logs show: `Sonos state subscription failed: service_unreachable` after commands succeed.
- Likely causes: Stream Deck Node runtime lacks `EventSource`, or subscribe path fails after global-settings connect.
- Investigation: `docs/worklog/2026-06-07-stream-deck-connect-investigation.md`.

## Modules

- `src/sonos/client.ts` — `HttpSonosClient.subscribe()`
- `src/core/plugin-core.ts` — runtime subscription lifecycle
- Optionally: polyfill or fetch-based SSE reader if `EventSource` unavailable in plugin runtime

## Success criteria

1. `bash ralph/verify/01-sse-live-state.sh` exits 0
2. `npm run smoke` still passes
3. **Hardware:** plugin log shows successful subscription (no `service_unreachable` for stub SSE after group assigned)
4. **Hardware:** visible action updates title/state within ~5s of stub state change (or SSE tick)

## Out of scope

- Production broker SSE
- PI changes unless required for subscription context (sessionRef / target)

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN.md, ralph/AGENTS.md, and docs/worklog/2026-06-07-stream-deck-connect-investigation.md.
Implement Loop 01 only — SSE / live state for the stub milestone.

Fix HttpSonosClient.subscribe() and plugin-core subscription wiring so the plugin receives
broker SSE updates on hardware. If EventSource is missing in the Stream Deck Node runtime,
add a minimal compatible SSE reader (polyfill or fetch stream parser) — do not break curl/smoke.

Do NOT implement Loop 02+ (action coverage, PI cleanup, capability UI, album art fetch).

Run: bash ralph/verify/01-sse-live-state.sh
When verify exits 0 and hardware checklist items in this PROMPT are satisfied, output:
<promise>SSE_LIVE_STATE_COMPLETE</promise>
```

## Hardware checklist (manual)

- [ ] Connect stub in PI; assign group to Play/Pause action
- [ ] Plugin log: no `Sonos state subscription failed: service_unreachable` for assigned target
- [ ] Key title or album art updates after stub emits SSE (toggle play or wait for tick)
