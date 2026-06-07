# Loop 02 — Hardware checklist

Run with broker stub (`npm run broker:stub`), plugin built (`npm run build`), Stream Deck restarted.

Prerequisites: connect in PI, choose **Default Sonos Group** once in the Connection section. Per-key overrides are optional.

| Action | Steps | Expected plugin log | HW |
|--------|-------|---------------------|-----|
| Any key (default) | Set default group only; leave key override empty | `Sonos command accepted: …` with default target | [x] |
| Play / Pause | Press key | `Sonos command accepted: play-pause` | [x] |
| Next Track | Press key (no override needed if default set) | `Sonos command accepted: next-track` | [x] |
| Previous Track | Press key | `Sonos command accepted: previous-track` | [x] |
| Mute / Unmute | Press key | `Sonos command accepted: mute-toggle` | [x] |
| Play Mode | Press key | `Sonos command accepted: play-mode` | [x] |
| Album Art | Default group only | No error; image/title renders | [x] |
| Now Playing encoder | Press encoder (push or touch) | `Sonos command accepted: now-playing-encoder:push` or `:touch` | [x] |

## Failure modes

| Symptom | Likely cause |
|---------|----------------|
| `invalid_target` | No default group set and no per-key override |
| No log line | Action not registered or key not mapped |
| `not_connected` | PI connect / sessionRef missing from global settings |

## Sign-off

- **Date:** 2026-06-07
- **Automated:** `bash ralph/verify/02-action-coverage.sh` — all five broker command types accepted; action wiring + smoke green
- **Hardware:** default-group commands, play/pause, next/previous, album art, and encoder confirmed on Stream Deck against local broker stub
