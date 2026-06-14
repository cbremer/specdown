# Tasks — Session 09: gradual TypeScript rollout (batch 2)

**Date:** 2026-06-14
**Type:** tasks (session-level implementation checklist)
**Phase:** 1 follow-on — gradual TypeScript (`checkJs`)

Continues the per-file `// @ts-check` opt-in started in session 05. A safe,
fully-gated, zero-visual-risk batch — good autonomous work between the
visual-review Phase 2 slices.

---

## Modules opted in (leaf / near-leaf)

| Module | Notes |
|---|---|
| `features/custom-css.js` | typed the lazily-created `<style>` element |
| `features/split-view.js` | typed the `el()` helper param |
| `features/share-links.js` | typed the `openTab` DI callback signature (so 2-arg calls check) |
| `features/view-mode.js` | typed the `renderPreview`/`cleanupPanzoom` DI callbacks; null-guard on `markdown-content` |
| `features/diagram-export.js` | cast the complex-selector `querySelector` to `SVGElement`; null-guards on the 2D context and `toBlob` result |
| `features/minimap.js` | cast `getElementById` to `HTMLCanvasElement`; null-guard on the 2D context |
| `features/theme.js` | typed `THEME_ORDER` as the preference union; `setTheme` narrows the incoming string via `.find` |
| `features/file-loading.js` | typed the `openTab` DI callback + `FileReader` result; cast the file input / url input to `HTMLInputElement` |
| `features/toc.js` | null-guards on `markdown-content`; `HTMLElement` cast for `offsetTop`; typed `activeId` |
| `features/search.js` | typed the match/highlight node arrays; `textContent || ''` for the regex/walker paths; `HTMLInputElement` cast |

That's **13 of ~25 source modules** now type-checked (core/platform, core/state,
core/utils, toast, command-palette, shortcuts from before, plus these ten).

## Patterns established for the DOM-heavy modules

- The shared `const el = (id) => document.getElementById(id)` helper needs its
  param annotated: `const el = (/** @type {string} */ id) => …`.
- `getElementById` returns `HTMLElement | null`; when code uses element-specific
  members (`canvas.width`, `.value`) cast at the call site:
  `/** @type {HTMLCanvasElement | null} */ (document.getElementById('…'))`.
- `getContext('2d')` and `canvas.toBlob(cb)` hand back nullable values — guard
  before use (these are the only "new" runtime guards, and they're unreachable
  for valid inputs, so behavior is unchanged).
- DI callback vars (`openTab`, `renderPreview`, …) need an explicit function-type
  JSDoc so call sites with real arguments are checked rather than inferred as
  `() => void`.

## Verification

- **build ✓, lint ✓, typecheck ✓, 345 tests ✓** — no behavior change (the added
  guards are defensive early-returns on otherwise-throwing null paths).

## Remaining

- Still unchecked: `render-config.js` (marked/mermaid type friction — wants a
  careful pass), `annotations.js`, `repo-browser.js`, `search.js`, `toc.js`,
  `file-loading.js`, `tabs.js`, `theme.js`, `diagrams.js`, `platform/*`, and the
  `main.js` wiring hub. These have more DOM-nullability and external-lib typing
  to work through; they opt in over subsequent batches.
