# Loop 07 — Stub milestone E2E

## Objective

Final gate: all loops 01–06 complete, full automated smoke green, stub milestone documented as demo-ready.

## Success criteria

1. `ralph/IMPLEMENTATION_PLAN.md` — loops 01–06 marked `[x]`
2. `bash ralph/verify/07-stub-milestone-e2e.sh` exits 0
3. `docs/implementation-status.md` updated — stub milestone complete; SSE, actions, PI, capabilities, album art checked off
4. No regressions on connect → assign group → command flow

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN.md and ralph/AGENTS.md.
Implement Loop 07 only — stub milestone E2E gate.

Verify loops 01–06 are complete. Run full smoke and ralph/verify/run-all.sh.
Update docs/implementation-status.md to reflect stub milestone completion.
Fix any regressions found — do not add production Sonos scope.

Run: bash ralph/verify/07-stub-milestone-e2e.sh
Output <promise>STUB_MILESTONE_COMPLETE</promise> when verify exits 0.
```
