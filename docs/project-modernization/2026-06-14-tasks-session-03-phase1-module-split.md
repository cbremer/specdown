# Tasks — Session 03: Phase 1 (Architecture — internal module split)

**Date:** 2026-06-13 → 2026-06-14
**Type:** tasks (session-level implementation checklist)
**Phase:** 1 — Architecture (the internal `src/main.js` split)
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §6

Phase 1 slice 1 (Vite + ESM foundation, the major dep upgrades, and the
platform runtime fixes) shipped earlier. This session is the **internal split**
of the ~2,800-line `src/main.js` into `core/` / `features/` / `platform/`
modules — the roadmap's "no source file > 500 lines" goal.

Everything here is a **pure refactor** (no behavior change); the gate is
`npm run build` + `npm run lint` + the **297 Jest tests**, green at every commit.

---

## Enabling work

- **Multi-module test harness** (`tests/helpers/loadApp.js`): inlines the
  relative-import module graph (depth-first, deps before importers; strips
  `import`/`export`; handles multi-line imports; evals at global scope) so the
  suite keeps working unchanged as the entry splits.
- **`core/state.js`** — a shared mutable `state` object. ESM forbids reassigning
  an imported binding but allows mutating an imported object's fields, so all
  shared mutable state (`currentTheme`, `currentViewMode`, `currentRawMarkdown`,
  `tabs`, `activeTabId`, `nextTabId`, `tocVisible`, `tocEntries`,
  `tocScrollSpyScheduled`, `splitViewActive`, `iosLayoutMode`,
  `currentPanzoomInstances`) lives here.
- **`core/platform.js`** — `isDesktop` / `isIOSNative` constants.

## Modules extracted

| Module | Notes |
|---|---|
| `core/utils.js` | escapeHtml, normalizeMarkdownUrl, getSvgNaturalDimensions |
| `core/render-config.js` | configureMarked / configureMermaid / getMermaidConfig + FONT_FAMILY |
| `features/diagram-export.js` | downloadDiagramSvg/Png |
| `features/search.js` | in-document search (private state) |
| `features/annotations.js` | localStorage annotations (private state) |
| `features/repo-browser.js` | GitHub repo browser (DI: clearError/showError/onSelectFile) |
| `features/minimap.js` | fullscreen diagram minimap |
| `features/custom-css.js` | desktop user stylesheet |
| `features/toc.js` | table of contents (imports state + ios-chrome) |
| `features/split-view.js` | preview + raw split |
| `features/theme.js` | light/dark (DI: reRenderDiagrams) |
| `features/view-mode.js` | preview/raw toggle (DI: renderMarkdown, cleanupPanzoom) |
| `features/share-links.js` | diagram deep links (DI: createTab → `openTab`) |
| `features/file-loading.js` | local file + URL loading (DI: createTab → `openTab`) |
| `platform/ios-chrome.js` | iOS action bar / sheets / native print bridge |
| `features/diagrams.js` | (in progress) mermaid render + panzoom + fullscreen engine |

`src/main.js`: **2,814 → ~1,540 lines** and falling.

## Patterns / gotchas (for future extractions)

- **Coupled features take render-core/tabs callbacks via a `configureX({...})`
  init hook**, wired lazily in `init()` (e.g. `() => renderMarkdown(...)`) so
  the dep resolves at call time (matters for tests that swap the global).
- **Eval-harness global-collision rule:** because the harness concatenates all
  modules at global scope, a module-level `let`/`const` whose name matches a
  main.js global silently shadows it. Hit twice:
  - a local `state` in `initializePanzoom` (renamed `instanceState`);
  - a DI var `createTab` in share-links/file-loading (renamed `openTab`).
  Rule: never name a module-top `let`/`const` after a main.js global.
- The Vite build is the guard for cross-module **state reassignment** (Rollup
  errors on reassigning an imported binding); the 297 tests guard behavior.

## Remaining (the interwoven core)

- `features/diagrams.js` (mermaid render / panzoom / fullscreen) — being
  extracted; it's import-only (no callbacks into main), so it moves cleanly.
- **Tab management** (`createTab`/`switchTab`/`closeTab`/`renderTabBar`/…) and
  **Desktop IPC** (`setupDesktopIPC` + file-watch) are tightly intertwined with
  each other and with `renderMarkdown`; these need a careful, deliberate pass
  (likely a `features/tabs.js` + `platform/desktop.js` with DI). `renderMarkdown`
  + `revealHtmlComments` + the `setupEventListeners` wiring hub remain the
  natural core of `main.js`.
- After the split: lazy-load the Mermaid engine, then gradual TypeScript
  (`checkJs`).

## How this was delivered overnight

One branch with **atomic, individually-green commits** (each a single module
extraction) so each commit is a safe merge/revert point; one consolidated PR for
review. (Separate same-base PRs would conflict on main.js's import block.)
