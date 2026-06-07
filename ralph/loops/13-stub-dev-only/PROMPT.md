# Loop 13 — Stub dev-only path

## Objective

Make the **production broker the documented default** for real Sonos use. Keep the stub only for offline development and CI smoke tests.

## Changes

- README / PI copy: default `serviceBaseUrl` examples point to prod broker (or env-driven)
- `npm run smoke` continues to use stub on `47831` (no Sonos credentials in CI)
- Add `npm run smoke:production` or document manual prod verify separately
- CONTRIBUTING.md: clarify stub vs prod boundaries
- Do **not** delete `scripts/sonos-broker-stub.mjs`

## Success criteria

1. `bash ralph/verify/13-stub-dev-only.sh` exits 0
2. No user-facing doc implies stub households/tracks are real Sonos
3. `npm run smoke` still green in CI

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN-production.md and CONTRIBUTING.md.
Implement Loop 13 only — stub dev-only, production broker default in docs and scripts.

Run: bash ralph/verify/13-stub-dev-only.sh
Output <promise>STUB_DEV_ONLY_COMPLETE</promise> when verify exits 0.
```
