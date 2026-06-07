# Loop 09 — Sonos OAuth + sessions

## Objective

Wire production broker auth to **real Sonos OAuth 2.0** (authorization code flow). Tokens and client secret stay server-side only.

## Reference

- `docs/sonos-api-notes.md` — OAuth constraints, 24h access tokens, refresh tokens
- Sonos Control API auth docs: https://docs.sonos.com/reference/

## Modules

- `services/sonos-broker/src/auth.mjs` — authorize URL, callback handler, token exchange, refresh
- `services/sonos-broker/src/sessions.mjs` — persist sessions by `sessionRef` (file-backed OK for dev)
- `services/sonos-broker/src/server.mjs` — `/v1/sonos/auth/start`, `/v1/sonos/connection`, OAuth callback route

## Required env

- `SONOS_CLIENT_ID`
- `SONOS_CLIENT_SECRET`
- `SONOS_REDIRECT_URI` (public HTTPS)
- Optional: `SONOS_AUTH_CALLBACK_PATH` for broker-mounted callback

## Success criteria

1. `bash ralph/verify/09-sonos-oauth.sh` exits 0
2. `POST /v1/sonos/auth/start` returns a real Sonos `authorizeUrl` when env is set
3. After callback, `GET /v1/sonos/connection?sessionRef=…` returns `connectionStatus: connected`
4. Plugin PI flow unchanged: PI sets `serviceBaseUrl` → prod broker URL, auth via existing paths

## Out of scope

- Group discovery (Loop 10)
- Sonos event subscription callbacks (Loop 12)

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN-production.md and docs/sonos-api-notes.md.
Implement Loop 09 only — Sonos OAuth in services/sonos-broker/.

Run: bash ralph/verify/09-sonos-oauth.sh
Output <promise>SONOS_OAUTH_COMPLETE</promise> when verify exits 0.
```
