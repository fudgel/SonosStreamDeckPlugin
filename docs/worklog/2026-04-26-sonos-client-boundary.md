# Worklog: 2026-04-26 Sonos Client Boundary

## Session Goal

Replace the placeholder command path with a real Sonos transport/client boundary while keeping the backend contract intentionally small.

## Created

- `src/sonos/client.ts`

## Updated

- `src/core/plugin-core.ts`
- `src/core/state-store.ts`
- `src/actions/`
- `docs/architecture.md`
- `README.md`

## Notes

- `sendCommand(...)` is now a real HTTP client seam with typed request and failure handling.
- `fetchState(...)` and `subscribe(...)` remain stubbed until the next phase.
- Per-action target resolution still comes from action settings at the moment of invocation, not shared singleton state.
