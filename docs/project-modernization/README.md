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
| 2026-06-14 | [tasks-session-03-phase1-module-split](2026-06-14-tasks-session-03-phase1-module-split.md) | Phase 1 slice 2: internal split of the ~2,800-line `src/main.js` into `core/`/`features/`/`platform/` modules (main.js → 588 lines), pure refactor, 297 tests green |
| 2026-06-14 | [tasks-session-04-phase1-bundle-deps](2026-06-14-tasks-session-04-phase1-bundle-deps.md) | Phase 1 slice 3: heavy-dep loading — lazy-load Mermaid (~2 MB deferred, PR #119) + trim highlight.js to a curated language set (app-shell entry 1.07 MB → 261 kB) |
| 2026-06-14 | [tasks-session-05-phase1-typescript](2026-06-14-tasks-session-05-phase1-typescript.md) | Phase 1 slice 4: gradual TypeScript foundation — `checkJs` toolchain, per-file `// @ts-check` opt-in (leaf modules), native-bridge `globals.d.ts`, `typecheck` enforced in CI |
| 2026-06-14 | [tasks-session-06-phase2-toasts-a11y](2026-06-14-tasks-session-06-phase2-toasts-a11y.md) | Phase 2 slice 1: accessible toast system replaces all `alert()` calls + accessibility pass (skip link, aria-labels on icon-only controls, decorative-icon hiding, reduced-motion); +22 tests |
| 2026-06-14 | [tasks-session-07-phase2-theme-motion](2026-06-14-tasks-session-07-phase2-theme-motion.md) | Phase 2 slice 2: auto/system theme (3-way light→dark→auto cycle, `prefers-color-scheme` with live OS updates) + global reduced-motion; +5 tests |
| 2026-06-14 | [tasks-session-08-phase2-command-palette](2026-06-14-tasks-session-08-phase2-command-palette.md) | Phase 2 slice 3: command palette (Cmd/Ctrl+K, fuzzy filter, keyboard nav, ARIA combobox/listbox) + keyboard shortcut sheet (`?`); +21 tests |
| 2026-06-14 | [tasks-session-09-typescript-batch2](2026-06-14-tasks-session-09-typescript-batch2.md) | Gradual TypeScript batch 2: `// @ts-check` opt-in for 10 more modules — custom-css, split-view, share-links, view-mode, diagram-export, minimap, theme, file-loading, toc, search (13/~25 checked); no behavior change |

## Current Status

**Phase 0 implemented and merged** (PR #92). **Phase 1 slice 1 (Vite + ESM build
foundation) implemented** — see the session 02 tasks doc. The shared viewer is
now a Vite + ES-module build; `vendor/` is deleted and all three surfaces load
`markdown-viewer/dist/`. App logic remains in one module (`src/main.js`) this
slice; lint + 297 tests are green and the web build is verified headlessly.
**Desktop (Electron) and iOS load `file://` and need a manual smoke-test on the
branch before merge** (see the session 02 verification checklist).

The `src/main.js` monolith has since been **split** into
core/features/platform modules (session 03, main.js → 588 lines), and the
**heavy-dependency loading** work is substantially done (session 04): Mermaid
is lazy-loaded (~2 MB deferred until a diagram renders, PR #119) and
highlight.js is trimmed to a curated language set (app-shell entry 1.07 MB →
261 kB). The **gradual-TypeScript foundation** is now in place too (session 05):
a `checkJs` toolchain with per-file `// @ts-check` opt-in, a native-bridge
`globals.d.ts`, and a `typecheck` gate enforced in CI — the first leaf modules
are checked and the rest opt in incrementally. **Phase 1 (Architecture) is
functionally complete.**

**Phase 2 (Design system & UX) is underway**, sliced into reviewable PRs:
(1) **toasts + accessibility** — done (session 06): an accessible toast system
replaces every `alert()`, plus a skip link, `aria-label`s on icon-only controls,
decorative-icon hiding, and reduced-motion; (2) **auto/system theme + motion** —
done (session 07): a 3-way light→dark→auto cycle that follows the OS via
`prefers-color-scheme` (with live updates) and a global reduced-motion reset;
(3) **command palette + shortcut sheet** — done (session 08): a Cmd/Ctrl+K
fuzzy-filtered, keyboard-navigable command palette (ARIA combobox/listbox) and a
`?` keyboard-shortcut sheet. Remaining: toolbar consolidation/overflow and the
broader design-token overhaul (spacing/radius/typography scales + retiring stray
hard-coded hexes) — both want a visual-review pass.

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
