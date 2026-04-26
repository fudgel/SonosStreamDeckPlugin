# Contributing

Thanks for contributing to `SonosStreamDeck`.

This repository is currently an early public milestone: the Stream Deck plugin is wired end to end against a local Sonos broker stub, while the production Sonos integration is still a later phase.

## Before You Start

- read [README.md](./README.md) for the current local development workflow
- read [docs/00_HOME.md](./docs/00_HOME.md) for the project brain and authority model
- check [docs/implementation-status.md](./docs/implementation-status.md) so proposed work matches the current milestone and next-step priorities

## Development Setup

Requirements:

- Node.js 24+
- npm
- Stream Deck 7.1+
- Stream Deck hardware for full testing, or Stream Deck Mobile for basic keypad testing
- Stream Deck Plus if your change affects the encoder action or touch strip

Install dependencies:

```bash
npm install
```

Enable Stream Deck developer mode:

```bash
npx streamdeck dev
```

Link the plugin into Stream Deck:

```bash
npx streamdeck link com.sonosstreamdeck.plugin.sdPlugin
```

Start the local broker stub in a separate terminal:

```bash
npm run broker:stub
```

Build once:

```bash
npm run build
```

Or build continuously during development:

```bash
npm run watch
```

## Validation Expectations

Before opening a pull request, run:

```bash
npm run build
npm run validate
```

Also do the smallest relevant manual test in Stream Deck for your change.

Examples:

- keypad action changes: verify key title, image, and command behavior
- property inspector changes: verify settings persistence, auth flow, and group selection
- state/runtime changes: verify stub-backed state bootstrap and live updates
- encoder changes: verify the Now Playing encoder on Stream Deck Plus hardware

## Documentation Expectations

The `docs/` folder is the project brain.

If your change affects architecture, behavior, supported workflows, or current status, update the relevant docs in the same pull request.

Common files:

- [docs/architecture.md](./docs/architecture.md)
- [docs/implementation-status.md](./docs/implementation-status.md)
- [docs/sonos-service-contract.md](./docs/sonos-service-contract.md)
- [docs/troubleshooting.md](./docs/troubleshooting.md)
- [docs/worklog/](./docs/worklog/)

Prefer updating an existing doc over creating a new overlapping note.

## Scope Guidelines

- keep changes focused on the current request or issue
- prefer the smallest correct change over broader refactors
- do not add speculative abstractions or configuration
- when behavior is intentionally stub-backed today, do not silently present it as production-ready

## Issues And Discussions

- use Issues for concrete bugs, implementation tasks, or specific feature work
- use Discussions for architecture questions, roadmap ideas, and broader design feedback

## Pull Requests

A good pull request for this repo usually includes:

- a clear summary of what changed
- any user-visible or tester-visible impact
- the validation steps you ran
- doc updates when the change affects the Sonos Brain
