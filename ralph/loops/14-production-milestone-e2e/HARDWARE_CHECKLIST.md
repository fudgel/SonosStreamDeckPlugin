# Loop 14 — Production hardware checklist

Run with **production broker** (HTTPS reachable from Sonos + Stream Deck), plugin built, Stream Deck restarted.

Prerequisites:

- Sonos developer app configured; broker env vars set
- PI **Service base URL** points to production broker (not `127.0.0.1:47831` stub)
- OAuth completed; **Default Sonos Group** selected

| Step | Expected | HW |
|------|----------|-----|
| Connect in PI | `connectionStatus=connected`, real account label | [ ] |
| Groups list | Real household/room names from your Sonos system | [ ] |
| Play / Pause | Controls real speaker/group | [ ] |
| Next / Previous | Track changes on device; art/titles update | [ ] |
| Mute / Unmute | Group mute toggles on Sonos | [ ] |
| Play Mode | Mode cycle affects Sonos queue | [ ] |
| Album Art | Real artwork or SVG fallback; updates on track change | [ ] |
| Encoder | Live title/progress; push toggles playback | [ ] |
| External change | Change playback in Sonos app → Stream Deck updates via SSE | [ ] |

## Sign-off

- **Date:**
- **Broker URL:**
- **Household / default group:**
