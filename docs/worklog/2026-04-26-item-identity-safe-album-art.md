# Worklog: 2026-04-26 Item Identity Safe Album Art

## Session Goal

Make the broker contract and plugin state model explicit about item identity so album art can stay tied to the exact currently playing Sonos item rather than relying on title or album-name lookup.

## Updated

- `src/sonos/client.ts`
- `scripts/sonos-broker-stub.mjs`
- `docs/architecture.md`
- `docs/implementation-status.md`
- `docs/sonos-api-notes.md`
- `docs/sonos-service-contract.md`

## Implemented

- added `currentTrackId` to the Sonos group state shape
- added `currentAlbumName` and `currentAlbumId` to the Sonos group state shape
- added `currentTrackImageUrl` and `currentAlbumImageUrl` to the Sonos group state shape
- kept `albumArtUrl` as the current display field while documenting that it should be treated as artwork for the exact current item
- updated the broker stub to emit demo track and album identities alongside artwork URLs

## Decision

- artwork should be sourced from Sonos playback metadata, not from a later text-based album search
- preferred art precedence is current track image, then current album image, then a generated fallback
- future cache keys and proxy logic should use current track identity first so alternate releases like studio albums and greatest-hits albums do not get mixed up
