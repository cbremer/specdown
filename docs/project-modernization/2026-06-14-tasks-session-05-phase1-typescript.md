# Tasks — Session 05: Phase 1 (gradual TypeScript via checkJs)

**Date:** 2026-06-14
**Type:** tasks (session-level implementation checklist)
**Phase:** 1 — Architecture (the "gradual TypeScript" roadmap item)
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §6

The final Phase 1 item. The viewer stays **plain ESM JavaScript** — no `.ts`
rewrite — and gains type-checking via TypeScript's `checkJs` over JSDoc. The
adoption is **gradual**: type-checking is opt-in per module, leaf modules first,
so the gate stays green while coverage grows session over session.

---

## Toolchain established

- **`typescript` devDependency** (5.x) — `tsc` runs as a checker only.
- **`tsconfig.json`** — `allowJs`, `strict`, `skipLibCheck`, `noEmit`,
  `moduleResolution: bundler` (matches Vite), `lib: ES2022 + DOM`, `types: []`
  (no Node globals — the viewer is browser-only). **`checkJs: false`**, so
  unannotated modules are parsed for import resolution but not yet checked.
- **`// @ts-check` opt-in:** a module is type-checked once it carries the pragma
  at the top. This is the gradual lever — add the pragma + JSDoc one module at a
  time without ever red-lighting the gate.
- **`npm run typecheck`** = `tsc --noEmit`. Wired into **CI** (`ci.yml`) as a
  step between Lint and Test, so it's enforced on every PR.
- **`markdown-viewer/src/types/globals.d.ts`** — ambient declarations for the
  native-bridge globals the shells inject (`window.specdown` desktop bridge,
  `window.webkit` iOS message handlers, `window.iosNative`, and the app-set
  callbacks `loadFileContent` / `setTheme` / `setIOSLayoutMode`, plus the
  `globalThis.mermaid` test mock). Doubles as the canonical web ↔ native
  bridge contract.

## Modules checked this session (leaf-first)

| Module | Notes |
|---|---|
| `core/platform.js` | `isDesktop` / `isIOSNative` — needed the bridge globals d.ts |
| `core/state.js` | added `@typedef` for `Tab`, `TocEntry`, `AppState`; typed the exported `state` so future checked modules can assign `state.tabs` / `state.activeTabId` without `never[]` friction |
| `core/utils.js` | pure helpers; surfaced + fixed two real strict-null gaps in `revealHtmlComments` (`node.nodeValue` / `node.parentNode` possibly null) |

`npm run typecheck` ✓, `npm run build` ✓, `npm run lint` ✓, `npm test` →
**297 passed**.

## Patterns / gotchas

- **Type the shared `state` early.** Empty array literals (`tabs: []`) infer as
  `never[]`, so the first checked module that does `state.tabs.push(tab)` or
  `state.activeTabId = id` would error. Giving `state` an explicit `AppState`
  JSDoc type now unblocks every future module that touches it.
- **Don't let `prettier --write` touch existing files.** The repo isn't
  Prettier-clean (format:check fails on ~67 pre-existing files and is *not* a CI
  gate), so running `--write` reflows unrelated lines and bloats the diff. Keep
  edits in each file's existing style; only new files (the d.ts) are formatted.
- **`strict` is on**, but only bites opted-in files. DOM-heavy modules (lots of
  `getElementById` → `T | null`) will need null guards as they opt in — expect
  that to be the bulk of future annotation work.

## Remaining / next (future sessions)

- Opt in the rest of `core/` and the `features/`/`platform/` modules one at a
  time, leaf-first (next natural picks: `core/render-config.js`,
  `features/diagram-export.js`, `features/custom-css.js`).
- The DOM-heavy modules (`features/diagrams.js`, `platform/*`, the `main.js`
  wiring hub) come last — they need the most null-guarding.
- Optional later: flip `checkJs: true` once every module carries the pragma, and
  drop the per-file pragmas.

## Phase 1 status

With this slice, **Phase 1 (Architecture) is functionally complete**: Vite + ESM
foundation, the `src/main.js` module split, lazy-loaded Mermaid, trimmed
highlight.js, and the gradual-TypeScript foundation are all in. Remaining TS
coverage is incremental and rides the enforced `typecheck` gate. Next up is
**Phase 2** (design system / accessibility / WCAG).
