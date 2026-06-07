# SonosStreamDeck Production Milestone — Ralph Loops (Phase 2)

Run loops **08 → 14** in order after the [stub milestone](./IMPLEMENTATION_PLAN.md) (loops 01–07) is complete.

**Goal:** Replace stub-backed broker behavior with a real Sonos Control API broker while keeping the plugin contract in `docs/sonos-service-contract.md` unchanged.

## Prerequisites

- Stub milestone green: `bash ralph/verify/run-all.sh`
- Sonos developer credentials (client id, client secret, redirect URI with public HTTPS)
- Hosted or tunneled HTTPS callback URL for Sonos OAuth and event subscriptions (see `docs/sonos-api-notes.md`)

## Phase overview

| Loop | Scope | Verify |
|------|-------|--------|
| 08 | Production broker scaffold | `verify/08-production-broker-scaffold.sh` |
| 09 | Sonos OAuth + sessions | `verify/09-sonos-oauth.sh` |
| 10 | Groups + state bootstrap | `verify/10-sonos-discovery-state.sh` |
| 11 | Command writes | `verify/11-sonos-commands.sh` |
| 12 | Subscriptions → SSE | `verify/12-sonos-subscriptions-sse.sh` |
| 13 | Stub dev-only path | `verify/13-stub-dev-only.sh` |
| 14 | Production milestone E2E | `verify/14-production-milestone-e2e.sh` |

## Loop checklist

### Foundation

- [x] **Loop 08 — Production broker scaffold** — new broker service implements `/health` + `/v1/sonos/*` route skeleton; env-based config; stub unchanged for CI
- [ ] **Loop 09 — Sonos OAuth + sessions** — real authorize URL, token exchange, refresh, sessionRef persistence; no secrets in plugin bundle

### Sonos API integration

- [ ] **Loop 10 — Groups + state bootstrap** — `GET /v1/sonos/groups` and `GET /v1/sonos/state` backed by Sonos Control API; normalized to contract + item identity fields
- [ ] **Loop 11 — Command writes** — all five plugin command types map to Sonos group playback/volume APIs
- [ ] **Loop 12 — Subscriptions → SSE** — Sonos HTTPS callbacks ingested by broker; broker fans out `event: state` SSE to plugin clients

### Cutover

- [ ] **Loop 13 — Stub dev-only** — production broker is the documented default; stub retained only for offline dev/CI (`npm run broker:stub`); PI/README no longer imply stub is the product path
- [ ] **Loop 14 — Production milestone E2E** — hardware checklist against real household; `run-all-production.sh` green; `implementation-status.md` updated

## Current loop

Loop 09 — Sonos OAuth + sessions

## Progress log

| Date | Loop | Notes |
|------|------|-------|
| 2026-06-07 | — | Production Ralph loops defined after stub milestone (`a90ba78`). |
| 2026-06-07 | 08 | `services/sonos-broker/` scaffold on port 47832; contract routes + `broker:prod:*` scripts. |

## Non-goals (this milestone)

- Rewriting plugin actions or PI transport (keep `fetch` + `setGlobalSettings` + `HttpSonosClient`)
- Changing the `/v1/sonos/*` contract shape seen by the plugin
- Marketplace packaging or Sonos partner certification

## Agent entry prompt (Loop 08)

```
Study ralph/IMPLEMENTATION_PLAN-production.md, ralph/AGENTS.md, docs/architecture.md,
docs/sonos-service-contract.md, and docs/sonos-api-notes.md.
Implement Loop 08 only — production broker scaffold.

Run: bash ralph/verify/08-production-broker-scaffold.sh
Output <promise>PRODUCTION_BROKER_SCAFFOLD_COMPLETE</promise> when verify exits 0.
```
