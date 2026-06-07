# Loop 03 — PI dead-code cleanup

## Objective

Align property inspector and plugin with the **global-settings-only** architecture. Remove or gate code paths that rely on PI `sendToPlugin` or PI `setSettings`, which do not reach the plugin on Stream Deck 7.x in observed testing.

## Candidates to remove or gate

**PI (`com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js`)**

- `sendToPlugin({ type: "sync-connection", ... })`
- `sendToPlugin({ type: "refresh-groups", ... })`
- `sendToPlugin({ type: "request-snapshot" })`
- Any duplicate connect path that bypasses PI `fetch` + `setGlobalSettings`

**Plugin (`src/core/plugin-core.ts`, `src/actions/sonos-action.ts`)**

- Handlers for `sync-connection`, `refresh-groups` if PI no longer sends them
- PI `setSettings` in `sonos-action.ts` if unused (targets come from global `actionTargets`)

**Keep**

- PI `fetch` to broker for auth, connection poll, groups
- `setGlobalSettings` for connection metadata and `actionTargets[actionContext]`
- Plugin `onDidReceiveGlobalSettings` + `#syncVisibleActionTargetsFromGlobalSettings`

## Success criteria

1. `bash ralph/verify/03-pi-dead-code.sh` exits 0
2. `npm run smoke` passes
3. Hardware: connect → assign group → play/pause still works

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN.md, ralph/AGENTS.md, and docs/worklog/2026-06-07-stream-deck-connect-investigation.md Resolution section.
Implement Loop 03 only — PI dead-code cleanup.

Remove or clearly gate PI sendToPlugin and setSettings paths that never reach the plugin.
Preserve the working flow: PI fetch + setGlobalSettings(actionTargets) + plugin global settings sync.
Update docs/architecture.md if the PI diagram still shows sendToPlugin as primary.

Do NOT start Loop 04+ yet.

Run: bash ralph/verify/03-pi-dead-code.sh
Output <promise>PI_DEAD_CODE_COMPLETE</promise> when verify exits 0.
```
