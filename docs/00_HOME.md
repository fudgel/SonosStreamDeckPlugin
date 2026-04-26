# SonosStreamDeck Home

This `docs/` folder is the durable project knowledge layer for `SonosStreamDeck`.

It exists to make re-entry easy after time away from the project and to keep key architectural decisions, SDK constraints, and Sonos integration notes in one place.

## Authority Model

- The source of truth for the implementation is the code in this repository.
- The source of truth for vendor behavior is the official Sonos and Elgato documentation.
- These docs are project guidance and design records. If implementation changes, update the relevant doc or ADR.
- AI-generated notes and summaries are only useful if they are promoted into committed docs like these.

## Start Here

- [architecture.md](./architecture.md)
- [implementation-status.md](./implementation-status.md)
- [sonos-service-contract.md](./sonos-service-contract.md)
- [sonos-api-notes.md](./sonos-api-notes.md)
- [stream-deck-sdk-notes.md](./stream-deck-sdk-notes.md)
- [troubleshooting.md](./troubleshooting.md)
- [decisions/ADR-001-project-architecture.md](./decisions/ADR-001-project-architecture.md)
- [decisions/ADR-002-phase-1-action-model.md](./decisions/ADR-002-phase-1-action-model.md)

## Current Goal

Build a functional Stream Deck plugin for Sonos, initially targeting Stream Deck Plus, with phase 1 support for:

- Play / Pause
- Mute / Unmute
- Next Track
- Previous Track
- Play Mode switching
- Current album art
- Optional compact now-playing display for the Stream Deck Plus touch strip

## Product Boundary

`SonosStreamDeck` is the plugin that is installed into the Stream Deck application.

- The Stream Deck app is the host environment and the place where users map actions to buttons.
- Stream Deck keys and encoder slots are the primary interaction surface.
- The property inspector is the only plugin UI we intend to build inside the Stream Deck app.
- We are not building a separate standalone desktop UI as the product.
- Any broker or service process exists only to support Sonos auth, commands, and state sync for the plugin.

## Current Architectural Direction

- Product name: `SonosStreamDeck`
- Plugin runtime: official Elgato Stream Deck SDK with Node.js and TypeScript
- Sonos integration: Sonos Control API
- Recommended control model: thin Stream Deck plugin plus a small Sonos broker/service for OAuth, token refresh, subscriptions, and normalized state
- Project docs remain simple and in-repo until there is a proven need for a separate retrieval system

## Current Implementation Snapshot

- Stream Deck plugin scaffold exists and validates successfully
- plugin-core store, visible-action coordinator, and settings boundary exist
- command, auth, discovery, state fetch, and SSE subscription route through a typed internal Sonos client seam
- target-aware state caching now tracks visible configured groups by `householdId:groupId`
- the property inspector now uses a thin-client model for base URL persistence and per-action group selection
- an internal broker stub exists for auth, discovery, commands, state bootstrap, and SSE using in-memory demo data

## External References

- Sonos API reference: <https://docs.sonos.com/reference/>
- Stream Deck SDK: <https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/>

## Working Rules

- Record durable design decisions as ADRs in `docs/decisions/`.
- Keep troubleshooting notes concrete and operational.
- Prefer editing existing docs over creating many overlapping notes.
- Keep this folder small until the project complexity proves it should grow.
