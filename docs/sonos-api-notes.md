# Sonos API Notes

## Scope

This note captures the Sonos Control API behaviors and constraints most relevant to `SonosStreamDeck`.

## Auth Constraints

- Sonos uses OAuth 2.0 authorization code flow.
- The redirect URI must be publicly routable and HTTPS.
- Token exchange uses the client secret and should be server-side.
- Access tokens expire after 24 hours.
- Refresh tokens can be used to obtain new access tokens.

Implication for this project:

- avoid putting Sonos client secrets in the Stream Deck plugin package
- prefer a service layer to handle Sonos auth and token refresh

## Eventing Constraints

- Sonos subscriptions send event callbacks to a registered HTTPS callback URL.
- Subscription callbacks should respond quickly.
- Sonos does not replay missed events indefinitely.
- Subscriptions are important for continuity of control because playback may change from outside the plugin.

Implication for this project:

- phase 1 should be designed around Sonos event subscriptions, not plugin-only polling
- the plugin should tolerate reconnects and re-sync state from fresh reads

## Relevant Control Endpoints

Group playback commands:

- play
- pause
- togglePlayPause
- skipToNextTrack
- skipToPreviousTrack
- setPlayModes
- getPlaybackStatus

Group volume commands:

- getVolume
- setMute
- setVolume

Metadata and system state:

- getMetadataStatus
- playback subscription
- playbackMetadata subscription
- groups subscription
- groupVolume subscription

## Play / Pause

Sonos supports `togglePlayPause`, which is a good fit for a combined Stream Deck action.

Recommended plugin behavior:

- send `togglePlayPause`
- update UI from returned or subscribed playback state rather than assuming success alone

## Mute / Unmute

Use Sonos group mute.

Important behavior:

- Sonos group mute is distinct from group volume
- do not emulate mute by setting group volume to zero
- group mute preserves relative speaker volumes better than volume-zero workarounds

## Skip Controls

Skip forward and backward are not always allowed.

The playback status exposes whether content can:

- skip
- skip back
- pause
- repeat
- repeat one
- shuffle

Recommended plugin behavior:

- display disabled or muted visuals when the action is not allowed

## Play Modes

Sonos models play modes with booleans such as:

- `repeat`
- `repeatOne`
- `shuffle`
- `crossfade`

This does not naturally collapse into a simple fixed three-state model.

Project implication:

- if the phase 1 UX only exposes a smaller user-facing cycle, document the mapping clearly

## Playback Metadata

Playback metadata provides:

- current item
- next item when available
- track name
- artist name
- album or container name
- image URL
- service information
- duration when available

Project implication:

- album art and now-playing display should be driven from playback metadata, not inferred from playback state alone

## Progress Timing

Sonos does not continuously push position updates during ordinary playback.

Project implication:

- if the plugin shows elapsed time or a progress bar, use the last reported `positionMillis` and advance locally while playback is active
