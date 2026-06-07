# SonosStreamDeck Stub Milestone — Ralph Loops

Run loops **01 → 07** in order. Do not start the next loop until the current verify script exits 0.

## Near term

- [x] **Loop 01 — SSE / live state** — fetch-based SSE parser; automated verify green; hardware play/pause + no subscription WARN confirmed
- [x] **Loop 02 — Action coverage** — all command types accepted; action wiring verified; hardware checklist signed off
- [x] **Loop 03 — PI dead-code cleanup** — removed PI `sendToPlugin` / `setSettings`; PI fetches groups directly
- [x] **Loop 04 — PI polish** — stale/missing group UX, DevTools troubleshooting note

## Medium term

- [x] **Loop 05 — Capability-aware UI** — skip/pause availability reflected on keys and encoder
- [x] **Loop 06 — Album art** — item-identity-bound broker art, SVG fallback, Stream Deck cache-bust; hardware next/previous OK

## Milestone gate

- [x] **Loop 07 — Stub milestone E2E** — full smoke + all loops checked; hardware demo-ready

## Current loop

Stub milestone complete (`a90ba78`). **Start Phase 2:** [IMPLEMENTATION_PLAN-production.md](./IMPLEMENTATION_PLAN-production.md) — Loop 08 production broker scaffold.

## Progress log

| Date | Loop | Notes |
|------|------|-------|
| 2026-06-07 | — | Ralph loops created after stub connect/commands E2E landed (`b0af286`). |
| 2026-06-07 | 01 | Replaced `EventSource` with `fetch` + `pumpSseStream`. Verify + hardware OK (no subscription WARN). |
| 2026-06-07 | 02 | All command types + wiring verify; hardware checklist signed off (default group, all keys + encoder). |
| 2026-06-07 | 03 | Removed dead PI `sendToPlugin`/`setSettings`; PI `refreshGroupsInPI()` fetches groups directly. |
| 2026-06-07 | 04 | PI stale/missing default warnings, clear override, DevTools docs in troubleshooting. |
| 2026-06-07 | 05 | `capability-ui.ts` + stub paused/playing availableActions; keys show Off/Locked. |
| 2026-06-07 | 06 | `streamDeckAlbumArtUrl` SVG comment cache-bust; Sonos-like previous (restart then skip back); hardware art OK. |
| 2026-06-07 | 07 | `run-all.sh` green; stub milestone documented in implementation-status. |
