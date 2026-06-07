# Loop 14 — Production milestone E2E

## Objective

Final gate: loops 08–13 complete, production verify suite green, real Sonos hardware checklist signed off.

## Success criteria

1. `ralph/IMPLEMENTATION_PLAN-production.md` — loops 08–13 marked `[x]`
2. `bash ralph/verify/14-production-milestone-e2e.sh` exits 0
3. `bash ralph/verify/run-all-production.sh` exits 0
4. `docs/implementation-status.md` — production milestone complete
5. `ralph/loops/14-production-milestone-e2e/HARDWARE_CHECKLIST.md` signed off

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN-production.md and ralph/AGENTS.md.
Implement Loop 14 only — production milestone E2E gate.

Run: bash ralph/verify/14-production-milestone-e2e.sh
Output <promise>PRODUCTION_MILESTONE_COMPLETE</promise> when verify exits 0.
```
