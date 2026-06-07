# Loop 08 — Production broker scaffold

## Objective

Add a **real Sonos broker service** alongside the existing stub. The plugin keeps calling the same `/v1/sonos/*` contract; only the broker implementation changes.

## Target layout

```
services/sonos-broker/
  package.json
  README.md          # env vars, HTTPS callback requirements
  src/server.mjs     # HTTP server, route dispatch
  src/config.mjs     # SONOS_* + BROKER_* from env
  src/contract.mjs   # shared response helpers matching sonos-service-contract.md
```

Recommended npm scripts at repo root:

- `broker:prod` — start production broker (foreground)
- `broker:prod:start` / `broker:prod:stop` — optional lifecycle wrapper mirroring `scripts/broker-stub.mjs`

## Modules (create or extend)

- `services/sonos-broker/` — new production broker (do **not** delete `scripts/sonos-broker-stub.mjs`)
- `package.json` — wire prod broker scripts
- `docs/sonos-service-contract.md` — note prod vs stub brokers if needed
- `ralph/helpers/ensure-production-broker.sh` — start prod broker for verify when configured

## Loop 08 behavior

Routes exist and return structured contract errors until later loops wire Sonos API:

| Route | Loop 08 minimum |
|-------|-----------------|
| `GET /health` | `{ ok: true, service: "sonos-broker" }` |
| `POST /v1/sonos/auth/start` | `not_configured` when Sonos env missing; otherwise skeleton OK |
| `GET /v1/sonos/connection` | session lookup skeleton |
| `GET /v1/sonos/groups` | `not_connected` or `not_configured` |
| `POST /v1/sonos/commands` | `not_connected` |
| `GET /v1/sonos/state` | `not_connected` |
| `GET /v1/sonos/events` | SSE handshake or `not_connected` |

CORS headers must match stub behavior so PI `fetch` still works.

## Success criteria

1. `bash ralph/verify/08-production-broker-scaffold.sh` exits 0
2. `npm run smoke` still passes (stub path unchanged)
3. Production broker starts on a distinct port (default `47832`) without conflicting with stub `47831`

## Out of scope

- Real Sonos OAuth (Loop 09)
- Removing or breaking the stub (Loop 13)
- Plugin code changes unless required for a new default port constant in docs only

## Agent prompt

```
Study ralph/IMPLEMENTATION_PLAN-production.md, ralph/AGENTS.md, docs/architecture.md,
and docs/sonos-service-contract.md.
Implement Loop 08 only — production broker scaffold at services/sonos-broker/.

Keep scripts/sonos-broker-stub.mjs for CI. Add npm scripts to run the prod broker.
Implement /health and /v1/sonos/* route skeleton with contract-shaped errors.

Run: bash ralph/verify/08-production-broker-scaffold.sh
Output <promise>PRODUCTION_BROKER_SCAFFOLD_COMPLETE</promise> when verify exits 0.
```
