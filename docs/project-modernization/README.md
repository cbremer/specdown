# Project: Cross-Platform Modernization

A product, UX, and engineering modernization effort spanning all three
SpecDown surfaces (web, desktop, iOS/iPadOS). Kicked off with a full
three-lens evaluation of the app at v0.0.82 and a phased roadmap.

## Timeline

| Date | Doc | Summary |
|---|---|---|
| 2026-06-13 | [brainstorm-modernization-evaluation](2026-06-13-brainstorm-modernization-evaluation.md) | PM/UX/engineering evaluation of v0.0.82, north-star vision, phased roadmap (Phases 0–4) |

## Current Status

**Evaluation complete; awaiting decisions on open questions** (iOS
investment, Apple Developer membership for signing, Electron vs Tauri spike)
before Phase 0 work begins.

Phase summary:

- **Phase 0** — hygiene: fix dead external links on desktop, fix iOS CI
  `|| true`, lockfile, lint, CSP, docs reconciliation
- **Phase 1** — architecture: Vite + ES modules, split the `app.js`
  monolith, lazy-load heavy deps, gradual TypeScript
- **Phase 2** — design system & UX: tokens, SVG icons, command palette,
  accessibility pass
- **Phase 3** — distribution: signing/notarization, Windows/Linux lanes,
  PWA, TestFlight, Electron-vs-Tauri spike
- **Phase 4** — differentiators: workspace mode, diagram presentation mode,
  annotations 2.0, web persistence

## Naming Conventions

Files follow the repo-wide pattern `YYYY-MM-DD-<type>-<detail>.md` with
types `brainstorm`, `spec`, and `tasks` (see [docs/README.md](../README.md)).
The next session in this project should add a tasks file, e.g.
`2026-06-XX-tasks-session-01-phase0-hygiene.md`, and update the timeline
table above.
