# ADR-002: Phase 1 Uses Shared Group State And Thin Actions

## Status

Accepted

## Context

Phase 1 includes several actions that all depend on the same Sonos group state:

- play / pause
- mute / unmute
- next
- previous
- play mode
- album art
- optional now-playing encoder feedback

If each action fetches and interprets Sonos state on its own, the plugin will become harder to reason about and more fragile when playback changes outside Stream Deck.

## Decision

Use one shared normalized state model for the currently selected Sonos group.

All visible actions should render from that shared state and send commands through a shared command layer.

Action responsibilities should stay thin:

- receive user input
- dispatch one logical command
- render from normalized state

## Consequences

### Positive

- consistent UI state across actions
- easier support for external playback changes
- less duplicated Sonos interpretation logic
- easier future support for Stream Deck Plus feedback layouts

### Negative

- requires a clear shared state contract early
- command and render paths must be coordinated carefully

## Phase 1 Specific Notes

- Play / Pause should use real Sonos playback state, not optimistic toggle state alone.
- Mute / Unmute should use Sonos mute state.
- Skip buttons should respect Sonos capability flags.
- Play Mode may use a simplified UX, but any mapping from Sonos modes should be explicit.
