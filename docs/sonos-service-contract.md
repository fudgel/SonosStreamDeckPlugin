# Sonos Service Contract

## Purpose

This document defines the minimal internal broker/service contract used to support the `SonosStreamDeck` plugin.

This is not a public product API. It exists only to support the Stream Deck plugin runtime.

## Design Goal

Keep the contract small and explicit.

- command writes go over HTTP
- state bootstrap goes over HTTP
- live state updates are intended to use server push
- plugin actions stay thin and typed

## Current Implemented Client Surface

The plugin currently has a typed client seam in `src/sonos/client.ts` with:

- `startAuthorization(...)` implemented
- `fetchConnectionStatus(...)` implemented
- `fetchGroups(...)` implemented
- `sendCommand(...)` implemented
- `fetchState(...)` implemented
- `subscribe(...)` implemented

The repository now also contains a headless internal broker stub at `scripts/sonos-broker-stub.mjs` that implements the contract below using in-memory demo state.

## Authorization Start Endpoint

### Request

`POST /v1/sonos/auth/start`

```json
{
  "sessionRef": "sess_123"
}
```

### Success Response

```json
{
  "ok": true,
  "sessionRef": "sess_123",
  "authorizeUrl": "https://example.com/sonos/authorize"
}
```

## Connection Status Endpoint

### Request

`GET /v1/sonos/connection?sessionRef=sess_123`

### Success Response

```json
{
  "ok": true,
  "connectionStatus": "connected",
  "sessionRef": "sess_123",
  "connectedAccountLabel": "Demo Sonos Account"
}
```

## Group Discovery Endpoint

### Request

`GET /v1/sonos/groups?sessionRef=sess_123`

### Success Response

```json
{
  "ok": true,
  "sessionRef": "sess_123",
  "households": [
    {
      "householdId": "house_1",
      "householdName": "Home",
      "groups": [
        {
          "groupId": "group_1",
          "groupName": "Living Room"
        }
      ]
    }
  ]
}
```

## Command Endpoint

### Request

`POST /v1/sonos/commands`

```json
{
  "requestId": "uuid",
  "sessionRef": "sess_123",
  "target": {
    "householdId": "house_1",
    "groupId": "group_1"
  },
  "command": {
    "type": "playback.toggle"
  }
}
```

### Success Response

HTTP `202` or other successful `2xx` response:

```json
{
  "ok": true,
  "requestId": "uuid",
  "accepted": true
}
```

### Failure Response

```json
{
  "ok": false,
  "code": "invalid_target",
  "message": "Select a Sonos group for this action.",
  "retryable": false
}
```

### Current Command Types

- `playback.toggle`
- `playback.next`
- `playback.previous`
- `group.mute.toggle`
- `playback.mode.cycle`

## State Fetch Endpoint

### Current Request

`GET /v1/sonos/state?sessionRef=sess_123&householdId=house_1&groupId=group_1`

### Current Success Response

```json
{
  "ok": true,
  "target": {
    "householdId": "house_1",
    "groupId": "group_1"
  },
  "revision": 7,
  "state": {
    "playbackStatus": "playing",
    "currentTrackTitle": "Track Title",
    "currentArtistName": "Artist Name",
    "currentTrackId": {
      "serviceId": "204",
      "objectId": "song:1065681770",
      "accountId": "aa_000"
    },
    "currentAlbumName": "Malibu",
    "currentAlbumId": {
      "serviceId": "204",
      "objectId": "album:1065681000",
      "accountId": "aa_000"
    },
    "currentTrackImageUrl": "http://example.com/current-item-art.jpg",
    "currentAlbumImageUrl": "http://example.com/current-album-art.jpg",
    "positionMillis": 42000,
    "durationMillis": 189000,
    "albumArtUrl": "http://example.com/current-item-art.jpg",
    "isMuted": false,
    "playModeLabel": "Repeat Queue",
    "availableActions": {
      "canSkip": true,
      "canSkipBack": true,
      "canPause": true
    }
  }
}
```

### Current Failure Response

```json
{
  "ok": false,
  "code": "not_connected",
  "message": "Sonos is not connected.",
  "retryable": false
}
```

## Event Stream Endpoint

### Artwork Identity Rule

The broker should treat `albumArtUrl` as artwork for the exact current playback item, not as the result of a later text-based album search.

Recommended precedence:

- `currentTrackImageUrl`
- `currentAlbumImageUrl`
- service- or plugin-generated fallback imagery

To keep artwork tied to the right release, cache keys and any proxying logic should use `currentTrackId` first and `currentAlbumId` second when available.

### Current Request

`GET /v1/sonos/events?sessionRef=sess_123&householdId=house_1&groupId=group_1`

### Current Push Transport

Preferred current direction: Server-Sent Events.

Reasoning:

- simpler than WebSocket for one-way state fan-out
- keeps command writes on normal HTTP POST
- small enough for the current plugin architecture

The current broker stub uses SSE.

Current client behavior:

- `subscribe(...)` performs an HTTP probe before creating `EventSource`
- this allows `401`, `404`, and other structured failures to surface as typed errors instead of opaque SSE disconnects
- retryable stream disconnects are handled by the plugin runtime, not by individual action instances

### Current Event Shape

```text
event: state
id: 7
data: {"target":{"householdId":"house_1","groupId":"group_1"},"revision":7,"state":{"playbackStatus":"playing","currentTrackTitle":"Track Title","currentArtistName":"Artist Name","currentTrackId":{"serviceId":"204","objectId":"song:1065681770","accountId":"aa_000"},"currentAlbumName":"Malibu","currentAlbumId":{"serviceId":"204","objectId":"album:1065681000","accountId":"aa_000"},"currentTrackImageUrl":"http://example.com/current-item-art.jpg","currentAlbumImageUrl":"http://example.com/current-album-art.jpg","positionMillis":42000,"durationMillis":189000,"albumArtUrl":"http://example.com/current-item-art.jpg","isMuted":false,"playModeLabel":"Repeat Queue","availableActions":{"canSkip":true,"canSkipBack":true,"canPause":true}}}

```

Events should send full snapshots, not patches.

The current broker stub sends:

- an immediate full snapshot when the SSE connection opens
- `event: state` messages for command-driven state changes
- `: keep-alive` heartbeats every 25 seconds

## Failure Semantics

Current client-side failure codes:

- `not_connected`
- `not_configured`
- `invalid_target`
- `timeout`
- `service_unreachable`
- `service_error`
- `not_implemented`

Current behavior expectations:

- `401` and `403` should be treated as reconnect-needed states
- `408`, `429`, and `5xx` should be treated as retryable failures
- target validation should happen before a request is sent when possible
- reconnect-needed failures should downgrade plugin connection state and clear stale target sync runtimes

## Security Boundary

The plugin should only store non-secret connection metadata.

- service base URL is allowed
- session reference is allowed if it is non-secret broker metadata
- Sonos access tokens and refresh tokens should stay in the service layer

## Non-Goals

- public API versioning beyond what the plugin needs right now
- general-purpose remote-control API for other clients
- separate end-user UI for the broker/service

## Local Stub Defaults

For local development, the internal stub defaults to:

- host: `127.0.0.1`
- port: `47831`
- base URL: `http://127.0.0.1:47831`

Available scripts:

- `npm run broker:stub`
- `npm run broker:stub:watch`
