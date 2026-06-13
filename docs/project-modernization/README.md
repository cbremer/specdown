# Project: Cross-Platform Modernization

A product, UX, and engineering modernization effort spanning all three
SpecDown surfaces (web, desktop, iOS/iPadOS). Kicked off with a full
three-lens evaluation of the app at v0.0.82 and a phased roadmap.

## Timeline

| Date | Doc | Summary |
|---|---|---|
| 2026-06-13 | [brainstorm-modernization-evaluation](2026-06-13-brainstorm-modernization-evaluation.md) | PM/UX/engineering evaluation of v0.0.82, north-star vision, phased roadmap (Phases 0–4) |
| 2026-06-13 | [tasks-session-01-phase0-hygiene](2026-06-13-tasks-session-01-phase0-hygiene.md) | Phase 0 implementation: desktop external-link fix, iOS CI honesty, lockfile + ESLint/Prettier + CI lane + Dependabot + CSP, docs reconciliation |
| 2026-06-13 | [tasks-session-02-phase1-vite-foundation](2026-06-13-tasks-session-02-phase1-vite-foundation.md) | Phase 1 slice 1: Vite + ES-module build foundation, real npm deps replace `vendor/`, all surfaces load `dist/`, harness migrated, sync-version regression fixed |

## Current Status

**Phase 0 implemented and merged** (PR #92). **Phase 1 slice 1 (Vite + ESM build
foundation) implemented** — see the session 02 tasks doc. The shared viewer is
now a Vite + ES-module build; `vendor/` is deleted and all three surfaces load
`markdown-viewer/dist/`. App logic remains in one module (`src/main.js`) this
slice; lint + 297 tests are green and the web build is verified headlessly.
**Desktop (Electron) and iOS load `file://` and need a manual smoke-test on the
branch before merge** (see the session 02 verification checklist).

Remaining Phase 1 work (next slices): split `src/main.js` into
core/features/platform modules (no file > 500 lines), lazy-load the Mermaid
engine, begin gradual TypeScript.

The open questions below (iOS investment, Apple Developer membership for
signing, Electron vs Tauri spike) still gate **Phases 2–4**, not Phase 1.

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
