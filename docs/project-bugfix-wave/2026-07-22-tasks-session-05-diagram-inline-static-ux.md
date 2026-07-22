# Tasks — Session 05: Static Inline Diagrams, Explore on Demand

**Date:** 2026-07-22
**Decision doc:**
[`2026-07-22-brainstorm-diagram-inline-static-ux.md`](2026-07-22-brainstorm-diagram-inline-static-ux.md)

## Checklist

- [x] `markdown-viewer/src/features/diagrams.js`
  - [x] Delete `initializePanzoom` (inline Panzoom, wheel/dblclick handlers,
        8-button toolbar wiring) and `cleanupPanzoomInstances`
  - [x] `createDiagramContainer`: single `.diagram-expand` button; new
        `prepareInlineDiagramSvg` sets intrinsic pixel width/height from the
        viewBox and clears mermaid's inline `max-width` style (viewBox kept —
        export/minimap/fullscreen/print rely on it)
  - [x] New `initializeInlineDiagram`: expand-button click → `openFullscreen`;
        wrapper click → fullscreen only when `diagram-scaled` or coarse
        pointer; listeners bound once per container (`data-inline-wired`
        guard survives theme re-renders)
  - [x] New `markDiagramScaledState` + debounced window-resize recompute;
        `clientWidth === 0` (pre-layout/jsdom) leaves state untouched
  - [x] `reRenderMermaidDiagrams` routes through the same prepare/init path
- [x] Fullscreen overlay gains the share button
      (`markdown-viewer/index.html` + `setupFullscreenControls`)
- [x] Caller cleanup: `main.js`, `tabs.js`, `view-mode.js` drop the
      `cleanupPanzoom` plumbing; `core/state.js` drops
      `currentPanzoomInstances`
- [x] `markdown-viewer/styles.css`
  - [x] `.diagram-container` de-carded (no border/background/shadow/overflow)
  - [x] `.diagram-wrapper`: fixed 500px height removed; SVG capped at
        `max-width: 100%` / `max-height: 70vh`, centered
  - [x] `.diagram-expand`: hover/focus-visible reveal; always visible when
        `.diagram-scaled` or `(pointer: coarse)`; `prefers-reduced-motion`
        respected; `touch-action: manipulation` kept
  - [x] Mobile media query: static toolbar-row rules deleted
  - [x] Print fallback + `.ios-native` selectors updated to `.diagram-expand`;
        print overrides the 70vh cap
- [x] `src/platform/ios-chrome.js`: `buildPrintableDocument` strips
      `.diagram-expand`
- [x] Tests
  - [x] `tests/integration/mermaid.test.js`: inline-panzoom suites replaced
        with inline-affordance + `markDiagramScaledState` suites; fullscreen
        share covered; generation-guard tests keep DOM-only assertions
  - [x] `tests/integration/markdown.test.js`, `tests/unit/printing.test.js`,
        `tests/unit/presentation.test.js` fixtures updated to the new DOM
- [x] `npm test` (530 passing), `npm run lint`, `npm run typecheck`,
      `npm run build` all clean

## Manual verification notes

- Small diagram: natural size, no chrome until hover; wheel scrolls the page.
- Oversized diagram: capped, `zoom-in` cursor, always-visible expand button,
  click-anywhere opens fullscreen.
- Fullscreen: zoom/slider/reset/minimap/export/share/Esc/`+ - 0` unchanged.
- Theme toggle, `?diagram=` share links, and print (light re-render from dark)
  verified against the unchanged `data-mermaid-source` path.
