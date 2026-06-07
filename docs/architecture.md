# Architecture

## Purpose

`SonosStreamDeck` is a Stream Deck plugin that lets a user control Sonos playback and view current playback information from Stream Deck hardware, with initial focus on Stream Deck Plus.

The intended product experience is:

- install the plugin in the Stream Deck application
- assign plugin actions to keys or encoder slots
- configure those actions through the Stream Deck property inspector
- press the physical Stream Deck controls to perform Sonos actions

The project is not intended to become a separate custom desktop controller app.

## Recommended System Shape

The current recommended shape is a hybrid architecture with two cooperating parts.

## Current Repository Scaffold

The repository now contains the initial official-style Stream Deck plugin scaffold:

- `package.json` for build, watch, and validation commands
- `tsconfig.json` using the current Rollup-friendly TypeScript settings
- `rollup.config.mjs` to bundle `src/plugin.ts` into the plugin bundle
- `src/plugin.ts` as the plugin entry point
- `src/actions/` for phase-1 action classes
- `src/sonos/client.ts` as the initial Sonos service transport boundary
- `com.sonosstreamdeck.plugin.sdPlugin/manifest.json` as the Stream Deck manifest
- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.html` as the initial property inspector
- `com.sonosstreamdeck.plugin.sdPlugin/imgs/` for plugin and action assets

The current scaffold registers all planned phase-1 actions, and the plugin now has a real broker-facing command and state path for auth, discovery, state bootstrap, and SSE updates.

The current implementation uses a shared `PluginCore` coordinator plus a typed Sonos client seam so visible actions can reuse one runtime per configured Sonos group instead of opening duplicate fetch and subscription paths.

### 1. Stream Deck Plugin

Responsibilities:

- implement Stream Deck actions
- render key images, titles, and touch-strip feedback
- host the property inspector for configuration
- persist user-specific plugin settings
- send user commands to the Sonos integration layer
- update visible actions when Sonos state changes

User-facing boundary:

- this is the actual product users interact with
- this is what gets installed into Stream Deck
- this is where button mapping and encoder mapping happen

Technology direction:

- official Elgato SDK
- Node.js application layer
- Chromium property inspector UI
- TypeScript
- Rollup-based bundle output to `.sdPlugin/bin/plugin.js`

### 2. Sonos Integration Layer

Responsibilities:

- Sonos OAuth redirect handling
- token exchange and refresh
- Sonos household and group discovery
- subscriptions for playback, metadata, groups, and volume
- normalized state storage for configured target groups
- event fan-out to the plugin

Non-goal:

- this layer is not a second end-user UI
- this layer is not a standalone Sonos controller product
- this layer exists only to support the plugin runtime

This can eventually be implemented as either:

- a hosted broker service, which is the preferred path for Sonos compliance and cross-platform simplicity
- or a local-only helper if later testing proves it can satisfy Sonos constraints cleanly

## Why The Split Exists

Sonos and Stream Deck have different strengths and constraints.

- Stream Deck plugins are a good local hardware UX layer.
- Sonos auth and subscription delivery are better handled by a service layer because Sonos expects public HTTPS endpoints for OAuth redirect and subscription callbacks.

That makes the clean design:

- Stream Deck plugin = interaction and rendering
- Sonos service = internal auth, subscriptions, normalized state support for the plugin

## State Model

The plugin now operates from one shared state store with two layers:

- global connection metadata shared across the plugin
- target-aware group snapshots keyed by `householdId:groupId`

That state lives in `PluginCore` and `SonosStateStore` rather than on action-class instances, because Stream Deck action classes are singletons per action type, not per visible button.

`PluginCore` owns the visible-action registry and shared per-target runtimes so multiple visible controls pointed at the same Sonos group reuse one state bootstrap and one SSE subscription.

Each normalized target snapshot currently includes:

- selected household ID
- selected group ID
- group name
- playback state
- current position in milliseconds
- current track title
- current artist name
- current track identity (`serviceId` / `objectId` / `accountId` when available)
- current album name
- current album identity when available
- track duration in milliseconds
- available playback actions like skip and pause
- broker-supplied `playModeLabel`
- group mute state
- current track image URL when available
- current album image URL when available
- album art URL
- received-at timestamp used for local playback progress estimation

The broker should treat album art as metadata attached to the exact current item, not as a separate text-based lookup. `albumArtUrl` is the current display field, while track and album identities let the broker or plugin keep artwork tied to the currently playing Sonos item.

Richer metadata normalization and any future next-item support are still later-phase work rather than part of the current state shape.

## Phase 1 UI Model

### Key Actions

- Play / Pause
- Mute / Unmute
- Next Track
- Previous Track
- Play Mode
- Album Art

### Stream Deck Plus Encoder Action

- compact now-playing display in one encoder quarter
- artist and track display
- local progress timer between broker updates

The current implementation includes a working now-playing encoder action with elapsed / duration feedback and a progress indicator.

Important constraint:

- a single action only controls one quarter of the Stream Deck Plus touch strip, not the full-width strip

## Control Principles

- action state should be driven by real Sonos state, not just local button presses
- skip controls should reflect Sonos playback capabilities
- mute should use the Sonos mute command, not volume zero
- progress display should use a local timer between Sonos playback status updates
- metadata and album art should be updated from Sonos playback metadata
- global plugin settings should hold only non-secret connection metadata
- per-action household and group targeting should live in action settings
- the active Sonos target should be resolved from the current action settings at command time, not from one shared "current target" value
- the property inspector should stay thin: it persists settings directly and asks the plugin to do auth and discovery work
- reconnect-needed failures should downgrade plugin connection state and clear stale target runtimes

## Open Implementation Questions

- how the plugin should authenticate the user against the Sonos service layer
- whether the service layer should use HTTPS polling fallback in addition to push events
- whether album art should be cached only in memory or also on disk
- whether the phase 1 play mode action should intentionally collapse Sonos modes into a smaller user-facing cycle
