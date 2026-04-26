---
name: consulting-sonos-brain
description: "Checks the Sonos Brain project docs and reconciles them with code when asked to confirm architecture, verify feature fit, or validate implementation details against the repository knowledge base. Use when prompts mention the Sonos Brain or ask to confirm a solution against project docs."
---

# Consulting Sonos Brain

Uses the repository's Sonos Brain docs as the first stop for architecture and implementation verification.

Use this skill when the user asks things like:

- "use the Sonos Brain to confirm the solution architecture"
- "verify with Sonos Brain the dimming functionality of the play button"
- "check the Sonos Brain before implementing this"
- "is this approach aligned with the Sonos Brain?"

## What Counts As The Sonos Brain

Treat the project-local `docs/` folder as the Sonos Brain. Start with the smallest relevant set of files:

- `docs/00_HOME.md` for the top-level authority model and doc map
- `docs/architecture.md` for system shape and product boundary
- `docs/implementation-status.md` for what is already built versus still pending
- `docs/sonos-service-contract.md` for plugin-to-broker behavior and failure semantics
- `docs/decisions/` ADRs for durable decisions
- `docs/worklog/` entries when the question is about recent implementation details or milestone history

The code remains the source of truth. If the Sonos Brain and the code differ, trust the code and call out that the Brain needs an update.

## Workflow

1. Identify the exact claim to verify.
2. Read `docs/00_HOME.md` plus the smallest set of relevant Sonos Brain files.
3. If the docs fully answer the question, respond from the docs with file references.
4. If the docs are incomplete or possibly stale, inspect the relevant code paths and reconcile the answer against implementation.
5. State one of these outcomes clearly:
   - confirmed by the Sonos Brain
   - not supported by the Sonos Brain
   - partially supported, but implementation differs
6. If the docs are stale, update the relevant Sonos Brain files as part of the work unless the user asked for analysis only.

## Expected Output Shape

Keep answers short and decisive.

- Start with the conclusion.
- Cite the relevant Brain docs with file references.
- If needed, cite the implementation files that confirm or contradict the docs.
- End with the practical implication: proceed, adjust the design, or update the Brain.

## Verification Heuristics

Use these checks when validating a proposal or feature:

- Product boundary: does it keep the Stream Deck plugin as the user-facing product?
- Architecture fit: does it preserve the thin-plugin plus broker/service split?
- Settings boundary: does global configuration stay in global settings and per-action target state stay in action settings?
- Runtime fit: does shared target state stay in `PluginCore` and `SonosStateStore` rather than action-local singletons?
- Contract fit: does the change align with `docs/sonos-service-contract.md` and current broker failure semantics?
- Status fit: is the feature already implemented, explicitly pending, or out of current scope per `docs/implementation-status.md`?

## When The User Mentions A Specific Feature

Map the feature to the likely Sonos Brain sources before reading broadly.

- Architecture or layering questions: `docs/architecture.md`, ADRs
- "Is this already built?": `docs/implementation-status.md`, recent worklog entries
- Broker/API behavior: `docs/sonos-service-contract.md`
- Recent implementation details: `docs/worklog/`
- UI and settings flow: `docs/architecture.md`, `docs/implementation-status.md`, then UI/plugin code if needed

## Examples

User: "Use the Sonos Brain to confirm the solution architecture for real album art."

Approach:

- Read `docs/architecture.md` and `docs/implementation-status.md`.
- Confirm whether real album art belongs in the plugin, broker, or both.
- Inspect code only if the docs do not resolve the current implementation state.

User: "Verify with Sonos Brain the dimming functionality of the play button."

Approach:

- Read `docs/implementation-status.md` for capability-aware rendering status.
- Read `docs/architecture.md` for control principles.
- Inspect the render path in `src/core/plugin-core.ts` if the docs imply the feature is pending or ambiguous.
- Report whether dimming is aligned, already implemented, or still a next step.

## Important Rules

- Do not treat the Sonos Brain as a substitute for code when implementation accuracy matters.
- Do not read the entire `docs/` tree by default; stay targeted.
- When the Brain is outdated, fix the docs if the task involves making or validating a change.
- Prefer existing Brain files over inventing new notes unless the knowledge is genuinely durable.
