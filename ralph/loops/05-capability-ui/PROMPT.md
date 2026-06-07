# Loop 05 — Capability-aware UI

## Objective

Reflect Sonos playback capabilities in Stream Deck rendering when `availableActions` indicates skip or pause is unavailable.

## State fields

From `SonosGroupState.availableActions`:

- `canSkip`
- `canSkipBack`
- `canPause`

## Modules

- `src/core/plugin-core.ts` — rendering for keypad actions and encoder
- Action assets or title suffixes for disabled feedback (match existing SVG/style conventions)

## Success criteria

1. `bash ralph/verify/05-capability-ui.sh` exits 0
2. Unit or integration tests for at least one capability branch (e.g. next-track hidden/disabled when `canSkip: false`)
3. Stub can expose varying capabilities via state/SSE (extend stub if needed)

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN.md and ralph/AGENTS.md.
Implement Loop 05 only — capability-aware UI.

Wire availableActions from SonosGroupState into plugin-core rendering for next/previous/play-pause
and encoder surfaces. Extend broker stub state if needed to exercise canSkip/canPause false cases in verify.

Do NOT start Loop 06 (album art fetch) in this loop.

Run: bash ralph/verify/05-capability-ui.sh
Output <promise>CAPABILITY_UI_COMPLETE</promise> when verify exits 0.
```
