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
| `features/diagrams.js` | mermaid render + panzoom + fullscreen engine |
| `features/tabs.js` | tab create/switch/close + tab bar + drop-zone reset (DI: renderMarkdown + desktop watch/session) |
| `platform/desktop.js` | Electron file-watch + watch toggle + IPC + session (imports tabs; DI: renderMarkdown) |

`src/main.js`: **2,814 → 588 lines.** What remains is the genuine entry: the
import graph, DOM-handle constants, `init()` DI wiring, `setupEventListeners`
(the event-wiring hub), the drag/drop handlers, and `renderMarkdown` (the
render core the feature modules call back into).

## Patterns / gotchas (for future extractions)

- **Coupled features take render-core/tabs callbacks via a `configureX({...})`
  init hook**, wired lazily in `init()` (e.g. `() => renderMarkdown(...)`) so
  the dep resolves at call time (matters for tests that swap the global).
- **Eval-harness global-collision rule:** because the harness concatenates all
  modules at global scope, a module-level `let`/`const` whose name matches a
  main.js global silently shadows it. Hit twice:
  - a local `state` in `initializePanzoom` (renamed `instanceState`);
  - a DI var `createTab` in share-links/file-loading (renamed `openTab`);
  - a render DI var that would be `renderDoc` in both tabs.js and desktop.js —
    desktop.js's is named `reloadDoc` so the two modules don't share one global.
  Rule: never name a module-top `let`/`const` after a main.js global **or after
  another module's same-named DI var**.
- **Breaking the tabs ↔ desktop cycle:** tabs and desktop call into each other
  (tabs → watch/session; desktop → createTab/closeTab). To avoid a circular
  import (which the depth-first harness can't order), the dependency is made
  one-way: `desktop.js` imports `tabs.js` directly, while `tabs.js` receives the
  desktop callbacks via `configureTabs` DI. main.js wires both in `init()`.
- The Vite build is the guard for cross-module **state reassignment** (Rollup
  errors on reassigning an imported binding); the 297 tests guard behavior.

## Remaining / next

- The internal split is **done**: every cohesive unit is now a module and
  `main.js` is the 588-line entry (wiring hub + render core). No file is wildly
  oversized; `setupEventListeners` is the one dense block left and it's
  inherently the entry's job, so further splitting is low-value.
- After the split: lazy-load the Mermaid engine, then gradual TypeScript
  (`checkJs`).

## How this was delivered overnight

One branch with **atomic, individually-green commits** (each a single module
extraction) so each commit is a safe merge/revert point; one consolidated PR for
review. (Separate same-base PRs would conflict on main.js's import block.)
