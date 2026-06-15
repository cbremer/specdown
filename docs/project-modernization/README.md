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
| 2026-06-14 | [tasks-session-09-typescript-batch2](2026-06-14-tasks-session-09-typescript-batch2.md) | Gradual TypeScript batch 2: `// @ts-check` opt-in for 15 more modules (custom-css, split-view, share-links, view-mode, diagram-export, minimap, theme, file-loading, toc, search, annotations, repo-browser, render-config, tabs, highlight) — 21/~25 checked; no behavior change |
| 2026-06-15 | [tasks-session-10-typescript-complete](2026-06-15-tasks-session-10-typescript-complete.md) | Gradual TypeScript **complete**: final 4 modules (desktop, ios-chrome, diagrams, main) — **25/25 checked**, `checkJs: true` flipped on globally; no behavior change |
| 2026-06-15 | [tasks-session-11-phase2-design-tokens](2026-06-15-tasks-session-11-phase2-design-tokens.md) | Phase 2 slice 4: design-token system (radius/spacing/motion/type scales + semantic status palette, value-preserving) + global `:focus-visible` focus rings + toolbar overflow "⋮" menu |
| 2026-06-15 | [spec-macos-signing](2026-06-15-spec-macos-signing.md) | Phase 3: macOS code-signing + notarization — the fix for the desktop "damaged"/Gatekeeper error. Wires hardened runtime + entitlements + a signed/notarized (or unsigned-fallback) `build-macos` workflow path; **needs 5 Apple secrets from the user** (setup guide in the doc) |
| 2026-06-15 | [tasks-session-12-pwa](2026-06-15-tasks-session-12-pwa.md) | Phase 3: PWA — installable + offline web app (manifest + icons + a conservative web-only service worker: network-first navigation, SWR assets, cross-origin never cached); +5 tests |
| 2026-06-15 | [tasks-session-13-presentation-mode](2026-06-15-tasks-session-13-presentation-mode.md) | Phase 4: diagram presentation mode — full-screen step-through of a document’s Mermaid diagrams (prev/next, counter, keyboard nav), surfaced via a "Present diagrams" palette command; +6 tests |
| 2026-06-15 | [tasks-session-14-recent-files](2026-06-15-tasks-session-14-recent-files.md) | Phase 4: recent files — remembers recently-opened URLs (localStorage), one-click re-open list on the drop zone with a Clear button; +9 tests |
| 2026-06-15 | [tasks-session-15-code-copy](2026-06-15-tasks-session-15-code-copy.md) | UX polish: hover "Copy" button on rendered code blocks (clipboard + execCommand fallback, "Copied" flash, excluded from print); +4 tests |
| 2026-06-15 | [tasks-session-16-presentation-enhancements](2026-06-15-tasks-session-16-presentation-enhancements.md) | Phase 4: presentation mode enhancements — pan/zoom inside a slide (Panzoom: −/⤢/+ buttons, wheel, +/-/0 keys) + a discoverable "Present" toolbar button (overflow-aware); +4 tests |
| 2026-06-15 | [tasks-session-17-session-restore](2026-06-15-tasks-session-17-session-restore.md) | Phase 4: session restore — reopen the last-opened document on launch (web only, URL re-fetch; skipped in native shells / when a diagram link opened something); +4 tests |
| 2026-06-14 | [handoff-next-wave](2026-06-14-handoff-next-wave.md) | **Resume point** — aggregated status, the remaining Phase 3/4 options, and the project gotchas. Start here after a break. |

> **Resuming after a break?** Read **[handoff-next-wave](2026-06-14-handoff-next-wave.md)** first — it's the durable index of what's done, what's next, and the gotchas.

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

**Phase 1 (Architecture) and Phase 2 (Design system & UX) are both complete.**
Phase 1 finished with the gradual-TypeScript migration (sessions 05/09/10):
**25/25 modules** type-checked over JSDoc and `checkJs: true` global. Phase 2
shipped four slices: (1) accessible toasts + a11y pass; (2) auto/system theme +
reduced-motion; (3) command palette (Cmd/Ctrl+K) + shortcut sheet (`?`); (4) the
design-token system (radius/spacing/motion/type scales + semantic status
palette) + `:focus-visible` focus rings + the toolbar overflow "⋮" menu.

**Next is Phase 3 (distribution) and Phase 4 (differentiators)** — see the
[handoff brief](2026-06-14-handoff-next-wave.md) §6 for the breakdown. The
headline Phase 3 item, macOS **signing/notarization** (the desktop "damaged"
Gatekeeper fix), is gated on Apple Developer membership + CI secrets; the
Windows (`.exe`) and Linux (AppImage) release lanes already exist in
`.github/workflows/desktop.yml`.

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
