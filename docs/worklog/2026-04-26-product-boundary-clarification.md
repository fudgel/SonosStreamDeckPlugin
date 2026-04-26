# Worklog: 2026-04-26 Product Boundary Clarification

## Session Goal

Clarify that `SonosStreamDeck` is the installable Stream Deck plugin product and that any Sonos broker/service work is only support infrastructure.

## Updated

- `README.md`
- `docs/00_HOME.md`
- `docs/architecture.md`
- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.html`

## Notes

- The Stream Deck application remains the host UI where actions are mapped.
- The property inspector remains the only plugin configuration UI surface we plan to build.
- The Sonos service layer is internal plumbing for auth, command dispatch, and state sync.
