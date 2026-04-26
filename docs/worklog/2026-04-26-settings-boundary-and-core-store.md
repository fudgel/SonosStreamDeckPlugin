# Worklog: 2026-04-26 Settings Boundary And Core Store

## Session Goal

Make the Stream Deck settings boundary explicit and introduce a small plugin-core store so shared Sonos state does not end up on `SingletonAction` instances.

## Created

- `src/core/settings.ts`
- `src/core/state-store.ts`
- `src/core/plugin-core.ts`

## Updated

- `src/plugin.ts`
- `src/actions/`
- `docs/stream-deck-sdk-notes.md`
- `docs/architecture.md`
- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.html`

## Notes

- Global settings are now explicitly limited to non-secret connection metadata.
- Per-action household and group targeting is now the intended action settings contract.
- Actions stay thin and route shared state concerns through `pluginCore`.
