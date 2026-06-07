# Loop 11 — Command writes

## Objective

Map plugin command types to **Sonos group playback and volume APIs** via `POST /v1/sonos/commands`.

## Command map

| Plugin command | Sonos API (see sonos-api-notes) |
|----------------|----------------------------------|
| `playback.toggle` | `togglePlayPause` |
| `playback.next` | `skipToNextTrack` |
| `playback.previous` | `skipToPreviousTrack` (respect Sonos restart-then-skip semantics) |
| `group.mute.toggle` | group mute API |
| `playback.mode.cycle` | `setPlayModes` with documented UX mapping |

Return HTTP `202` + `{ ok: true, accepted: true, requestId }` on success. Publish updated state after command (fetch or subscription).

## Success criteria

1. `bash ralph/verify/11-sonos-commands.sh` exits 0
2. All five command types accepted against prod broker with connected session
3. **Hardware:** Stream Deck keys drive real Sonos playback (log `Sonos command accepted: …`)

## Out of scope

- Subscription-driven SSE (Loop 12) except post-command state refresh
- Removing stub (Loop 13)

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN-production.md and docs/sonos-api-notes.md.
Implement Loop 11 only — Sonos command writes in the production broker.

Run: bash ralph/verify/11-sonos-commands.sh
Output <promise>SONOS_COMMANDS_COMPLETE</promise> when verify exits 0.
```
