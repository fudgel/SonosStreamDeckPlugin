# Troubleshooting

## Purpose

Track real operational issues and fixes for the current local stub-backed development flow, and expand this document as the production Sonos broker replaces the stub.

## Current Local Development Flow

Today the repository is expected to work like this:

- `npm run broker:stub` runs the local Sonos broker stub at `http://127.0.0.1:47831`
- the plugin is built locally and linked into Stream Deck
- the property inspector stores `serviceBaseUrl`, a **default Sonos group**, and optional per-key overrides via `setGlobalSettings`
- `PluginCore` reacts to global settings changes, bootstraps state, and opens SSE subscriptions
- live updates arrive over SSE, not webhooks

If a troubleshooting step assumes real Sonos OAuth infrastructure or a production broker, call that out explicitly.

## Likely Early Failure Modes

### Plugin does not appear in Stream Deck

Possible causes:

- the plugin was not linked into Stream Deck
- the latest bundle was not built
- Stream Deck developer mode is disabled
- Stream Deck needs a restart after linking or rebuilding

Initial checks:

- run `npm run build`
- run `npm run validate`
- run `npx streamdeck dev`
- run `npx streamdeck link com.sonosstreamdeck.plugin.sdPlugin`
- restart the plugin with `npx streamdeck restart com.sonosstreamdeck.plugin`
- restart the Stream Deck app if the category still does not appear

### Sonos auth starts but the plugin never becomes connected

Possible causes:

- the broker stub is not running
- the property inspector saved the wrong `serviceBaseUrl`
- the stub auth browser page was not completed
- connection polling failed or timed out

Initial checks:

- confirm `npm run broker:stub` is still running
- confirm the property inspector base URL is `http://127.0.0.1:47831`
- click `Connect Sonos` again and complete the opened stub auth page
- confirm the property inspector shows `Connected`
- choose a **Default Sonos Group** in the Connection section (required for keys to work)
- use per-key override only when that key should target a different room
- inspect Stream Deck logs for `com.sonosstreamdeck.plugin` restart activity and connection failures
- if connect or group assignment fails in Stream Deck, see [worklog/2026-06-07-stream-deck-connect-investigation.md](./worklog/2026-06-07-stream-deck-connect-investigation.md) (resolution + PI Web Inspector notes)

### Groups do not load in the property inspector

Possible causes:

- auth did not actually complete
- the saved session reference became stale
- the broker stub is unreachable
- group refresh returned `not_connected`

Initial checks:

- confirm the property inspector shows `Connected`
- use the `Refresh Groups` button after auth completes
- reconnect Sonos if the inspector shows a stale error
- confirm the broker stub still responds at `http://127.0.0.1:47831/health`

### Stream Deck action presses do nothing

Possible causes:

- plugin is not connected to the broker
- selected group is missing or stale
- the broker command failed and the action showed an alert

Initial checks:

- verify the property inspector shows `Connected`
- confirm a **Default Sonos Group** is selected
- use `Refresh Groups` after auth completes
- if the PI shows a stale group warning, re-select the default or clear a stale per-key override
- reconnect Sonos if the inspector shows a stale error
- confirm the broker stub still responds at `http://127.0.0.1:47831/health`

### Stream Deck action presses do nothing

Possible causes:

- plugin is not connected to the broker
- **no default Sonos group** is selected
- selected group is missing or stale
- the broker command failed and the action showed an alert

Initial checks:

- verify the property inspector has a **Default Sonos Group** selected (or a valid per-key override)
- verify the property inspector still shows `Connected`
- watch for alert triangles on the hardware after a failed command (`invalid_target` usually means no default group)

### Album art does not render

Possible causes:

- the action is not configured to a Sonos group
- no state has been received yet for that target
- the broker did not provide `albumArtUrl`, so the plugin should fall back to generated SVG artwork
- plugin image update logic failed

Initial checks:

- confirm the action is assigned to a group
- confirm state bootstrap completed by checking other live fields like title or progress
- verify fallback image behavior instead of expecting only broker-provided art

### Touch-strip progress is wrong or jumps backward

Possible causes:

- local progress timer not reset on playback status updates
- playback state changed externally but local timer kept running
- track changed without metadata sync being applied first

Initial checks:

- compare last Sonos `positionMillis` with rendered value
- confirm timer pauses during paused or idle states
- confirm timer resets on track changes

This check only applies to Stream Deck Plus encoder testing.

### UI state becomes stale after changes in the Sonos app

Possible causes:

- SSE subscription delivery stopped
- reconnect path did not trigger a full re-sync
- plugin updated only on local button interactions

Initial checks:

- verify the broker stub is still running
- verify active SSE subscriptions by forcing a fresh command and watching for visible action updates
- trigger a fresh state fetch and compare

## Logging Notes

### macOS Locations Observed During Development

- Stream Deck app logs: `~/Library/Logs/ElgatoStreamDeck/StreamDeck.log`
- Stream Deck structured logs: `~/Library/Logs/ElgatoStreamDeck/StreamDeck.json`
- Linked plugin folder: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.sonosstreamdeck.plugin.sdPlugin`

Other installed plugins also keep per-plugin log files under `~/Library/Application Support/com.elgato.StreamDeck/Plugins/<plugin>.sdPlugin/logs/` when Stream Deck creates them. No dedicated SonosStreamDeck plugin log file was present during this validation pass, so the main Stream Deck logs are currently the most reliable starting point.

### Current Debugging Guidance

- keep Stream Deck developer mode enabled with `npx streamdeck dev`
- use `npm run watch` during plugin iteration so rebuilds trigger plugin restarts automatically
- keep `npm run broker:stub` running in a separate terminal and watch its request logs while testing
- when a change does not show up, restart the plugin with `npx streamdeck restart com.sonosstreamdeck.plugin`

### Property Inspector Web Inspector (macOS)

Use this when PI connect, group dropdowns, or save behavior needs debugging.

1. Enable remote debugging for Stream Deck (once per machine):

```bash
defaults write com.elgato.StreamDeck html_remote_debugging_enabled -bool YES
```

Restart the Stream Deck app after changing this setting.

2. Open the Sonos action property inspector in Stream Deck (select a key with a Sonos action).

3. In Chrome, go to [http://localhost:23654/](http://localhost:23654/) and open the PI page for your action.

4. Use the Console and Network tabs to inspect PI `fetch` calls to the broker and `setGlobalSettings` payloads.

Plugin logs (separate from PI):

```text
~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.sonosstreamdeck.plugin.sdPlugin/logs/com.sonosstreamdeck.plugin.0.log
```
