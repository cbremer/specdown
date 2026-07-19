# Session 31 — Print & PDF hardening

**Date:** 2026-07-18
**Branch:** `claude/specdown-evaluation-modernize-ojp54v`
**Trigger:** User report — "printing isn't really working right: sometimes edges
are cut off, and sometimes I only get the screen I'm on, not every page of the
document."

## Diagnosis

Two distinct root causes, both traced to printing the **live app layout**:

1. **One-screen prints (desktop + web).** `performPrint()` fell through to a
   bare `window.print()`. The app shell is a viewport-fixed flex column
   (`body { overflow: hidden }`, 100vh `.app-container`, scrolling
   `.markdown-content` pane), and the `@media print` block reset only the two
   innermost containers — so the print engine saw a one-viewport-tall page and
   clipped everything below the current scroll position.
2. **Cut-off edges / illegible output.** Panzoomed diagram SVGs keep absolute
   positioning, pixel sizes, and transforms in print; wide tables render as
   inner scroll regions (`display: block; overflow-x: auto`) that clip
   columns; dark-theme code colors (`#e6edf3`) and dark-theme mermaid SVGs
   print nearly invisible on white.

iOS was already correct: it builds a standalone printable HTML document
(`buildPrintableDocument`) and prints *that* via the native print controller.

## Fix: one printable document, every surface

`buildPrintableDocument()` (platform/ios-chrome.js) is now the single artifact
all print/PDF paths render:

- **Builder hardened + async.** Strips UI chrome (diagram controls, copy
  buttons, annotation badges/popovers, search highlights), clears panzoom
  sizing/transforms (viewBox-driven natural size, `max-width: 100%`,
  `max-height: 230mm` page cap), and — when the app theme is dark —
  **re-renders every diagram from its `data-mermaid-source` with the light
  mermaid theme** (state flipped with try/finally restore + engine re-init;
  per-diagram fallback to the on-screen clone).
- **iOS** — unchanged contract: native `printDocument` message.
- **Desktop** — prints the same document through the hidden-iframe path in
  the **visible** window. (First shipped as an offscreen-BrowserWindow
  `print-document` IPC — user testing caught that Cmd+P showed nothing: on
  macOS the print dialog is a *sheet attached to its window*, so a hidden
  window has nowhere to show it. Export as PDF worked all along because its
  save dialog attaches to the main window. Follow-up in the same session
  moved desktop printing into the in-window iframe and deleted the
  `print-document` channel.)
- **Desktop Export as PDF** — new `export-pdf` IPC + **File > Export as
  PDF…** (`Cmd+Shift+E`): save dialog → offscreen render →
  `printToPDF({ printBackground, preferCSSPageSize })` → reveal in Finder.
  Surfaced in the command palette, the ⋮ overflow menu, and the shortcuts
  sheet. Renderer side: `exportActivePdf()` in platform/desktop.js.
- **Web** — hidden same-origin iframe hosts the printable document and the
  iframe window is printed (afterprint + 60s-backstop cleanup; single frame,
  no stacking).
- **Fallback** — bare `window.print()` remains only if every path above is
  unavailable, and the `@media print` CSS is now a real safety net: unlocks
  `html/body/.app-container/.content-area/.content-body/.content-main`
  (block, visible overflow, auto height), hides all remaining chrome
  (workspace sidebar, annotation panel, watch chip, overlays, toasts, iOS
  bars), forces light legible text/code colors, and lays wide tables out as
  real tables again.

## Files

- `markdown-viewer/src/platform/ios-chrome.js` — async unified `performPrint`,
  exported async `buildPrintableDocument`, light-theme diagram re-render,
  hidden-iframe path
- `markdown-viewer/src/platform/desktop.js` — `exportActivePdf` + IPC wiring
- `markdown-viewer/src/platform/bridge.js`, `src/types/globals.d.ts`,
  `desktop/preload.js` — `printDocument` / `exportPdf` / `onTriggerExportPdf`
- `desktop/main.js` — `loadPrintableWindow`, `exportPdfFromHtml`,
  `export-pdf` IPC, Export menu item
- `markdown-viewer/styles.css` — hardened fallback `@media print`
- `markdown-viewer/src/features/app-commands.js`, `toolbar-overflow.js`,
  `shortcuts.js` — Export as PDF surfacing
- `tests/unit/printing.test.js` (new, 12 tests), `desktop-main.test.js`
  (print/export main-process coverage), `iosRenderer.test.js` (async print)

## Verification

- `npm test` — 32 suites / 526 tests green (incl. new printing suite)
- `npm run lint`, `npm run typecheck` — clean
