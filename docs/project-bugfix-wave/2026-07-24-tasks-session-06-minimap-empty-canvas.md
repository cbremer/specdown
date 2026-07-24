# Session 06 — Fullscreen minimap renders an empty box

**Date:** 2026-07-24
**Type:** tasks
**Surfaces:** web + desktop (the minimap is hidden on iOS native).

## Problem

In the fullscreen diagram overlay, the **minimap** (the small overview in the
lower-left, with an accent-bordered viewport rectangle) showed an empty box — the
scaled-down diagram never appeared, only the blue viewport outline.

### Root cause

`updateMinimap()` (`markdown-viewer/src/features/minimap.js`) rasterizes the
diagram SVG by serializing it, loading the string into an `Image`, and drawing
that image onto the minimap `<canvas>`.

By the time it runs, panzoom has already stamped an inline
`transform: scale(...) translate(...)` (plus `transform-origin`) onto the live
SVG — it is the same element panzoom drives. That transform was serialized into
the rasterized string, and the **outermost `<svg>`'s CSS transform is honored
when an SVG is rendered as an image**, so the whole diagram was scaled/translated
outside the viewBox and the canvas drew nothing. The `.minimap-viewport`
rectangle still positioned itself, so the result was an empty accent-bordered
box.

Reproduced in headless Chromium with a real Mermaid SVG:

- clean SVG → ~10,800 non-blank canvas pixels
- SVG carrying panzoom's inline transform → **0** non-blank pixels
- clone with the transform stripped + explicit width/height → back to ~10,800

A secondary contributor: Mermaid emits `width="100%"` and a `max-width` style, so
the `Image` gets a 300px default intrinsic size; pinning explicit natural
dimensions makes the raster reliable.

## Fix

In `updateMinimap()`, serialize a **clean clone** instead of the live element:

- deep-clone the SVG (never mutate the panzoom target),
- clear inline `transform`, `transform-origin`, and `max-width`,
- set explicit `width`/`height` from the natural dimensions already computed
  from the viewBox.

## Tests

Added `tests/unit/diagramMinimap.test.js` — a regression guard that captures the
node handed to the serializer and asserts the transform is stripped, explicit
width/height are set, and the live SVG is left untouched (plus the no-dimensions
hide path).

## Gates

- `npm test` — 535/535 pass
- `npm run lint` — clean (`--max-warnings=0`)
- `npm run typecheck` — clean

## Notes / follow-ups

- Shared-app fix; reaches web + desktop. The minimap is intentionally hidden on
  iOS native (`.ios-native .fullscreen-minimap { display: none }`), so no iOS
  surfacing needed.
