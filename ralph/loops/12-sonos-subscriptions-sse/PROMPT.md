# Loop 12 — Subscriptions → SSE

## Objective

Register Sonos **HTTPS event subscriptions** in the production broker and fan out normalized state to plugin clients on `GET /v1/sonos/events` (same SSE shape as stub).

## Reference

- `docs/sonos-api-notes.md` — subscription callbacks must be fast; reconnect + resync
- Plugin already uses fetch-based SSE (`src/sonos/sse-stream.ts`) — do not change unless required

## Broker responsibilities

- Register playback / metadata / groups / volume subscriptions with Sonos using public callback URL
- Ingest Sonos callback POSTs, normalize to contract state, bump `revision`
- Push `event: state` SSE frames to connected plugin clients for matching `sessionRef` + target

## Success criteria

1. `bash ralph/verify/12-sonos-subscriptions-sse.sh` exits 0
2. Plugin receives SSE updates without polling after external Sonos app changes playback
3. **Hardware:** album art, titles, encoder progress update live without key press

## Out of scope

- Stub removal (Loop 13)
- Disk-backed subscription renewal daemon (document TODO if deferred)

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN-production.md, docs/sonos-api-notes.md, and src/sonos/sse-stream.ts.
Implement Loop 12 only — Sonos subscriptions feeding broker SSE.

Run: bash ralph/verify/12-sonos-subscriptions-sse.sh
Output <promise>SONOS_SUBSCRIPTIONS_SSE_COMPLETE</promise> when verify exits 0.
```
