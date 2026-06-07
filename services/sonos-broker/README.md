# Sonos production broker

HTTP service implementing the plugin contract in `docs/sonos-service-contract.md` against the Sonos Control API.

The Stream Deck plugin stays thin: it calls this broker at `/v1/sonos/*`. OAuth tokens and Sonos client secrets live **only** in this service.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `SONOS_CLIENT_ID` | Loop 09+ | Sonos developer app client id |
| `SONOS_CLIENT_SECRET` | Loop 09+ | Sonos developer app client secret |
| `SONOS_REDIRECT_URI` | Loop 09+ | Public **HTTPS** OAuth redirect URI registered with Sonos |
| `BROKER_PUBLIC_BASE_URL` | Recommended | Public HTTPS base URL for OAuth callbacks and Sonos subscription webhooks |
| `SONOS_BROKER_PROD_HOST` | Optional | Bind host (default `127.0.0.1`) |
| `SONOS_BROKER_PROD_PORT` | Optional | Listen port (default `47832`) |

Loop 08 runs without Sonos credentials: routes exist and return contract-shaped `not_configured` / `not_connected` errors until later loops wire the Control API.

## Run from repo root

```bash
npm run broker:prod:start    # background on http://127.0.0.1:47832
npm run broker:prod:status
npm run broker:prod:stop
npm run broker:prod          # foreground
```

Offline stub (CI / no Sonos): `npm run broker:stub` on port `47831`.

## Verify

```bash
bash ralph/verify/08-production-broker-scaffold.sh
```

## Sonos constraints

See `docs/sonos-api-notes.md`:

- OAuth redirect and event subscription callbacks must be public HTTPS
- Token exchange and refresh are server-side only
