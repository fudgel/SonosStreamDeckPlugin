# Ralph loop learnings

Update this file after each loop with non-obvious findings. Keep entries short.

## Global constraints

- **Working PI path:** PI `fetch` to broker + `setGlobalSettings` (`actionTargets[actionContext]`). Do not reintroduce reliance on PI `sendToPlugin` or PI `setSettings` until proven on hardware.
- **Broker contract:** `/v1/sonos/*` as documented in `docs/sonos-service-contract.md`. Stub lives in `scripts/sonos-broker-stub.mjs`, managed by `scripts/broker-stub.mjs`.
- **Verification:** `npm run smoke` is the baseline gate. Loop verify scripts add scope-specific checks.
- **Scope:** Loops 01–07 complete the **stub milestone**. Production Sonos OAuth/broker is out of scope here.

## Loop 01 — SSE / live state

- Root cause: **`EventSource` is not available** in Node 22 / Stream Deck plugin runtime — `new EventSource()` threw, surfacing as `service_unreachable`.
- Fix: `src/sonos/sse-stream.ts` — `pumpSseStream()` reads `fetch` response body and parses SSE blocks; `HttpSonosClient.subscribe()` uses this instead of `EventSource`.
- Removed redundant SSE preflight probe (single long-lived fetch handles errors + stream).
- Hardware sign-off: rebuild plugin, connect + assign group, confirm no subscription warning and live title/art updates.

## Loop 02 — Action coverage

- Automated: all five broker command types + static action wiring via `ralph/helpers/verify-action-wiring.mjs`.
- Manual: `ralph/loops/02-action-coverage/HARDWARE_CHECKLIST.md` — all rows signed off 2026-06-07 (default group, every key + encoder on stub).

## Loop 03 — PI dead-code cleanup

- Removed PI `sendToPlugin` (`sync-connection`, `refresh-groups`, `request-snapshot`) and plugin handlers for those messages.
- Removed `SonosAction.onSendToPlugin` / PI `setSettings` set-target path.
- PI loads groups via `refreshGroupsInPI()` → `GET /v1/sonos/groups` (same as connect auth path).
- Plugin still pushes optional `snapshot` on PI appear; PI treats it as fallback only.

## Loop 04 — PI polish

- PI warns when default group is missing, stale (not found in discovery), or override is stale.
- Clear override button resets per-key target to default.
- First-press / `invalid_target` guidance when no default is set.
- DevTools: `defaults write com.elgato.StreamDeck html_remote_debugging_enabled -bool YES` → Chrome `http://localhost:23654/`.

## Loop 05 — Capability-aware UI

- `src/core/capability-ui.ts` centralizes skip/pause availability helpers.
- Key titles: Next/Prev → `Off` when unavailable; Play/Pause → `Locked` when pause unavailable while playing.
- Encoder shows `Pause unavailable` on push when `canPause` is false.
- Stub: skip actions only when `playbackStatus === "playing"` (verify toggles paused vs playing).

## Loop 06 — Album art

- Broker `albumArtUrl` bound to `currentTrackId` / `currentAlbumId`; SVG fallback when art missing.
- `streamDeckAlbumArtUrl()` injects an SVG comment cache token (fragments break Stream Deck `data:` URLs).
- HTTP(S) art URLs get a `?sd=` query cache-bust param.
- Stub emits per-track SVG data URIs; Sonos-like previous (restart past 3s, skip back at start).
- Hardware: art updates on next/previous; revisit-after-skip-back works.

## Loop 07 — Stub milestone

- All loops 01–06 marked complete in `ralph/IMPLEMENTATION_PLAN.md`.
- Run `bash ralph/verify/run-all.sh` before declaring done.

## Verify

Run in order:

```bash
bash ralph/verify/01-sse-live-state.sh
# … through …
bash ralph/verify/07-stub-milestone-e2e.sh
```

Or: `bash ralph/verify/run-all.sh`

## Phase 2 — Production Sonos (loops 08–14)

- Plan: `ralph/IMPLEMENTATION_PLAN-production.md`
- Start Loop 08: production broker at `services/sonos-broker/` (port `47832`); keep stub on `47831` for CI
- OAuth + subscriptions require public HTTPS callbacks — see `docs/sonos-api-notes.md`
- Verify: `bash ralph/verify/run-all-production.sh`
- **Do not** change plugin `/v1/sonos/*` contract unless ADR + contract doc updated

## Loop 08 — Production broker scaffold

- `services/sonos-broker/` on port **47832**; lifecycle via `scripts/broker-prod.mjs` (`npm run broker:prod:*`).
- `/health` returns `{ service: "sonos-broker", sonosConfigured }`.
- Routes exist; return `not_configured` / `not_connected` until loops 09–12 wire Sonos API.
