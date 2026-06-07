# Loop 02 — Action coverage

## Objective

Ensure every registered action command type is accepted by the broker stub and wired correctly from plugin actions. Confirm on hardware that each action sends the expected command when a group is assigned.

## Command map

| Action | Command type |
|--------|----------------|
| Play / Pause | `playback.toggle` |
| Next Track | `playback.next` |
| Previous Track | `playback.previous` |
| Mute / Unmute | `group.mute.toggle` |
| Play Mode | `playback.mode.cycle` |
| Now Playing encoder (press/touch) | `playback.toggle` |

## Modules

- `src/actions/*.ts` — all extend `sonos-action` pattern
- `src/core/plugin-core.ts` — `runCommand`, target resolution via `actionTargets`
- `scripts/broker-stub-test.sh` — extend or mirror in loop verify

## Success criteria

1. `bash ralph/verify/02-action-coverage.sh` exits 0 (all command types accepted by stub)
2. `npm run smoke` passes
3. Hardware checklist signed off (see `HARDWARE_CHECKLIST.md`)

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN.md and ralph/AGENTS.md.
Implement Loop 02 only — action coverage for all stub command types.

Ensure each action passes action.id to runCommand and resolves target from global actionTargets.
Extend automated verify to POST every command type to the stub and assert accepted=true.
Fix any mapping gaps in plugin-core or sonos client.

Do NOT start Loop 03 (PI dead-code) unless a one-line fix is required for a failing command.

Run: bash ralph/verify/02-action-coverage.sh
Complete ralph/loops/02-action-coverage/HARDWARE_CHECKLIST.md checkboxes in IMPLEMENTATION_PLAN notes.
Output <promise>ACTION_COVERAGE_COMPLETE</promise> when verify exits 0.
```
