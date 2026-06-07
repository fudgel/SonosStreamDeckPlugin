# SonosStreamDeck Handoff: Stream Deck PI + Stub Integration Issues

Date: 2026-04-26  
Environment observed: macOS 15.7.2, Stream Deck 7.4.1, Stream Deck Plus hardware, Node 24, local broker stub on `127.0.0.1:47831`

## Goal

Provide a complete engineering handoff for current action setup/runtime issues:

- action setup appears to connect intermittently
- switching between actions loses apparent group assignment in PI
- hardware presses still show the green warning triangle with exclamation mark

This document captures what is known, what works, what fails, what has already been tried, and what remains to investigate.

## Product/Architecture Context

- Plugin product: `SonosStreamDeck` (`com.sonosstreamdeck.plugin`)
- Plugin runtime: Stream Deck SDK plugin (`src/plugin.ts`)
- Shared runtime/state: `src/core/plugin-core.ts`, `src/core/state-store.ts`, `src/core/settings.ts`
- PI UI: `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.html` + `settings.js`
- Broker client seam: `src/sonos/client.ts`
- Local test broker stub: `scripts/sonos-broker-stub.mjs`

Core design is thin plugin + broker:

- PI should configure global connection and per-action target group
- actions should dispatch commands via `PluginCore.runCommand(...)`
- plugin should refresh state via `fetchState` + SSE

## Action Types in Scope

From `com.sonosstreamdeck.plugin.sdPlugin/manifest.json`:

- `play-pause` (key)
- `mute-toggle` (key)
- `next-track` (key)
- `previous-track` (key)
- `play-mode` (key)
- `album-art` (key, display-oriented)
- `now-playing-encoder` (encoder)

Command mappings are implemented in action classes under `src/actions/` and through `pluginCore.runCommand(...)`.

## Stub Setup and Endpoints

Broker stub file: `scripts/sonos-broker-stub.mjs`  
Default URL: `http://127.0.0.1:47831`

Validated endpoints:

- `GET /health`
- `POST /v1/sonos/auth/start`
- `GET /v1/sonos/connection`
- `GET /v1/sonos/groups`
- `POST /v1/sonos/commands`
- `GET /v1/sonos/state`
- `GET /v1/sonos/events` (SSE)

Important stub behavior:

- base path `/` returns route-not-found (expected)
- auth state transitions authorizing -> connected via stub flow and/or `/mock-sonos-login`

## What Is Confirmed Working

1. **Local build/validate works**
   - `npm run build` passes
   - `npm run validate` passes

2. **Stub is healthy and command/state/SSE routes work**
   - health endpoint returns OK
   - command route increments revision and updates state
   - SSE route emits state events

3. **Plugin is currently linked (not only copied)**
   - active plugin path points to workspace symlink:
     - `~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.sonosstreamdeck.plugin.sdPlugin -> /Users/jim/Codebase/SonosStreamDeckPlugin/com.sonosstreamdeck.plugin.sdPlugin`

4. **PI can reach authorizing state**
   - screenshot evidence showed `Authorizing` with sign-in prompt.

## What Is Not Working Reliably

1. **PI action context switching drops apparent assignment**
   - configure an action/group, switch to another action, switch back
   - PI shows:
     - `Action Target` status `Error`
     - empty group selector
     - `Connect Sonos before loading groups.`

2. **Hardware press warning still occurs**
   - green triangle/exclamation persists on hardware key press
   - likely reflects command path seeing unconfigured target and/or disconnected state at press time.

3. **Popup UX is unreliable/confusing**
   - auto-open sign-in popup not consistently visible
   - manual link required for many attempts.

## Changes Attempted During This Session

These are code-level mitigations already applied in the working tree.

### Plugin-side adjustments

- Removed experimental message identifiers:
  - `streamDeck.settings.useExperimentalMessageIdentifiers = true` removed from `src/core/plugin-core.ts`

- Added PI message/auth debug logging in `src/core/plugin-core.ts` to trace auth path.

- Added connect request fallback via global settings:
  - `connectRequestedAt` added to `GlobalSettings` in `src/core/settings.ts`
  - plugin observes connect request and triggers `startAuthorization()` in `src/core/plugin-core.ts`

- Added extra global settings sync before command dispatch:
  - `await this.#synchronizeGlobalSettings()` at start of `runCommand(...)`

- Changed temporary action titles for unconfigured targets:
  - `Link` -> `No Group` in multiple render paths in `src/core/plugin-core.ts`

- Added broader group refresh trigger on PI appear/request snapshot:
  - `#shouldRefreshGroupsOnInspectorOpen()` in `src/core/plugin-core.ts`

### PI-side adjustments (`settings.js` / `settings.html`)

- Added direct PI fallback auth flow when plugin messaging appears stale:
  - direct calls to `/v1/sonos/auth/start`, `/v1/sonos/connection`, `/v1/sonos/groups`

- Added manual auth link fallback:
  - always render `Open Sonos sign-in page` in `authorizing` if URL can be resolved from base URL + sessionRef

- Added explicit post-auth confirmation action:
  - button in PI: `I completed sign-in`
  - forces connection recheck and group refresh

- Updated group selector handling:
  - immediately update local `state.settings` and re-render before `setSettings(...)`

- Added PI startup resilience:
  - seed `state.settings` from `actionInfo.payload.settings`
  - re-request settings/global settings after socket open with delayed retry.

## Outcomes of Above Changes

- **Partially improved**:
  - PI can reach/reflect connected state in some flows
  - manual sign-in fallback/link introduced
  - setup flow less blocked by popup behavior

- **Still unresolved**:
  - action context switches still sometimes revert PI to disconnected/unassigned target view
  - hardware warning icon still appears despite prior setup in some scenarios.

## Things Tried Operationally (Non-code)

- rebuild + watch loop (`npm run watch`)
- broker stub running (`npm run broker:stub`)
- plugin uninstall/reinstall
- unlink/delete + relink plugin to workspace
- remove and re-add actions
- switch between actions to force PI refresh

## Things Not Yet Tried (Recommended Next)

1. **Strip fallback complexity to isolate root cause**
   - temporarily disable PI direct-fetch fallbacks and keep only one auth path
   - verify if mixed PI/plugin auth paths are causing state divergence.

2. **Per-context PI cache (short-lived)**
   - persist selected action settings by context in `sessionStorage`
   - use only as display fallback until `didReceiveSettings`.

3. **Instrument SDK event traffic explicitly**
   - log all PI inbound/outbound message envelopes with context IDs:
     - `didReceiveSettings`
     - `didReceiveGlobalSettings`
     - `sendToPlugin`
     - `sendToPropertyInspector`
   - correlate action context ID when switching between actions.

4. **Verify Stream Deck PI lifecycle assumptions**
   - ensure PI is not reused across contexts with stale in-memory state.

5. **Single-source auth/session ownership decision**
   - choose plugin-owned auth orchestration only OR PI-owned fallback only.
   - current hybrid likely increases race/staleness risk.

6. **Action-target persistence audit**
   - verify `setSettings` payload is acknowledged per context
   - confirm `didReceiveSettings` returns same target after context switch.

## Known Repro Pattern (Current)

1. Connect Sonos from PI and complete stub sign-in.
2. Refresh groups and select group for action A.
3. Switch to action B.
4. Switch back to action A.
5. PI intermittently shows action A as unassigned/error.
6. Pressing hardware key may show green warning triangle.

## Logs / Diagnostic Locations

- Stream Deck app logs:
  - `~/Library/Logs/ElgatoStreamDeck/StreamDeck.log`
  - `~/Library/Logs/ElgatoStreamDeck/StreamDeck.json`

- Plugin runtime log file (when emitted by Stream Deck install context):
  - `~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.sonosstreamdeck.plugin.sdPlugin/logs/`
  - In this session, log availability changed after relink/reinstall.

- Local broker stub output (request-side checks):
  - terminal running `npm run broker:stub`

## Current Repo State (Potentially Relevant Modified Files)

At time of this handoff, modified files include:

- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.html`
- `com.sonosstreamdeck.plugin.sdPlugin/ui/settings.js`
- `src/core/plugin-core.ts`
- `src/core/settings.ts`
- and other project files already modified in working tree (`README.md`, docs, `src/sonos/client.ts`, stub script, etc.).

Use `git status --short` to inspect exact working tree before committing/cherry-picking.

## External References

- Stream Deck SDK intro/getting started:
  - <https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/>
- Sonos API reference:
  - <https://docs.sonos.com/reference/>

## Suggested Immediate Next Engineer Tasks

1. Reproduce context-switch issue with strict logging around settings/context IDs.
2. Decide one auth orchestration owner (plugin or PI) and remove the other path.
3. Add deterministic PI state model tests/manual checklist for:
   - action switch persistence
   - group assignment retention
   - command success on hardware press after re-entry.
4. After stabilization, remove temporary UX/debug scaffolding (`No Group` temp labels, extra fallback controls if no longer needed).

