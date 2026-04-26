# Stream Deck SDK Notes

## Scope

This note captures the Stream Deck SDK constraints and capabilities that matter most for `SonosStreamDeck`.

## Runtime Model

The official plugin model is split into two environments.

- application layer: Node.js plugin backend
- property inspector: Chromium-based UI inside Stream Deck

Implication for this project:

- keep the plugin implementation in TypeScript on the official SDK path
- avoid unnecessary native runtime dependencies in phase 1

## Cross-Platform Direction

The supported plugin shape is already cross-platform when built with the official SDK.

Recommended targets:

- macOS
- Windows
- Stream Deck 7.1+
- Node.js 24 in the manifest

## Settings Guidance

The SDK distinguishes between:

- action settings
- global settings

Recommended use for this project:

- use global settings only for non-secret Sonos connection metadata
- keep action settings for per-action household and group targeting
- avoid storing security-sensitive information in action settings
- do not store Sonos access tokens, refresh tokens, or client secrets in plugin settings
- do not package vendor secrets into the plugin

### Boundary To Keep Explicit

Global settings should contain only values such as:

- connection status
- service base URL
- non-secret session reference or account label
- last connection error summary

Action settings should contain only values such as:

- household ID
- group ID
- group name
- future action-specific display preferences

This split keeps exported Stream Deck profiles free of Sonos credentials while still allowing each action instance to target a specific group.

## Key Action Behavior

Relevant capabilities:

- multi-state keys support up to two fully supported states
- key images can be updated dynamically
- titles can be updated dynamically
- automatic toggle state behavior can be disabled

Project implication:

- Play / Pause and Mute / Unmute are good fits for controlled two-state keys
- Play Mode should not rely on multi-state keys if the UX needs more than two states

## Dial And Touch Strip Behavior

For Stream Deck Plus:

- one encoder action controls one dial and one quarter of the touch strip
- each touch-strip quarter is effectively `200 x 100` pixels
- built-in layouts can show icon, text, and indicator elements
- feedback can be updated dynamically with `setFeedback`

Project implication:

- phase 1 touch-strip display should stay compact
- a full-width now-playing bar would require coordination across all four encoder slots

## Feedback Model

Recommended pattern:

- subscribe actions to shared normalized Sonos state
- update visible keys and encoder feedback when state changes
- avoid action-specific network fetches when shared state is already available
- keep shared state in a plugin-core store, not on `SingletonAction` instance fields

## Property Inspector Guidance

The property inspector should be used for:

- Sonos account connection flow handoff
- selected household or group selection
- future action-specific configuration if needed

Keep phase 1 simple:

- one clean global configuration path is better than many per-action options
