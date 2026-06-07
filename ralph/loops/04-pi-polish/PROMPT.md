# Loop 04 — PI polish

## Objective

Improve property inspector UX for common failure cases and document PI debugging for future regressions.

## Deliverables

1. **Empty target** — clear hint when no Sonos group is selected; avoid silent "Saving…" forever
2. **Stale group** — when saved `actionTargets` group is missing from discovery, show recovery (re-select or clear)
3. **First press** — optional inline note that first key press may fail until group is assigned
4. **Troubleshooting** — add PI DevTools steps to `docs/troubleshooting.md`:
   - `defaults write com.elgato.StreamDeck html_remote_debugging_enabled -bool YES`
   - Chrome → `http://localhost:23654/` while PI is open

## Modules

- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.html`
- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js`
- `docs/troubleshooting.md`

## Success criteria

1. `bash ralph/verify/04-pi-polish.sh` exits 0
2. `npm run smoke` passes
3. Manual: PI shows helpful copy for disconnected / no-group / stale-group states

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN.md and ralph/AGENTS.md.
Implement Loop 04 only — PI polish.

Tighten connection and group-assignment UX in settings.html/js.
Add stale/missing group validation against latest groups fetch.
Document PI DevTools workflow in docs/troubleshooting.md.

Do NOT change broker contract or plugin command routing.

Run: bash ralph/verify/04-pi-polish.sh
Output <promise>PI_POLISH_COMPLETE</promise> when verify exits 0.
```
