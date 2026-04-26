# ADR-001: Use A Thin Stream Deck Plugin With A Sonos Service Layer

## Status

Accepted

## Context

The project needs to integrate two systems with different runtime expectations.

- Stream Deck plugins are designed to run locally using the official Elgato SDK.
- Sonos OAuth and event subscriptions expect public HTTPS endpoints and server-side token handling.

A purely local plugin would need to work around Sonos auth and callback constraints in a way that is harder to keep compliant and cross-platform.

## Decision

Use a split architecture:

- a thin local Stream Deck plugin for hardware UX and configuration
- a Sonos service layer for auth, token refresh, subscriptions, and normalized state

## Consequences

### Positive

- cleaner separation of concerns
- safer handling of Sonos client secrets
- better fit for Sonos callback requirements
- easier to keep plugin implementation cross-platform
- shared normalized state for all Stream Deck actions

### Negative

- introduces a second deployable component
- requires a connection protocol between the plugin and service
- adds a small amount of operational complexity

## Follow-Up

- define the plugin-to-service communication model
- decide how auth completion is handed back into the plugin
- document local development workflow for both components
