# Session 01 — Diagram controls overlap the diagram on phones

**Date:** 2026-06-21
**Type:** tasks
**Surfaces:** iOS (WKWebView shell) + mobile web — both phone-width layouts.

## Problem

On a phone, the Mermaid diagram control cluster (zoom −/+, zoom slider, reset,
SVG, PNG, share, fullscreen) floated **over** the top-right of the diagram and
covered a large part of it — the user reported it on iOS and suspected mobile
web too. Confirmed: it affects both.

### Root cause

`.diagram-controls` is `position: absolute; top: 10px; right: 10px` so it floats
over the `.diagram-wrapper` (a fixed `height: 500px` box). That's fine on a wide
screen, but on a phone the cluster is wide (the zoom slider + eight ~44px
touch-sized buttons) and the existing `@media (max-width: 768px)` rule let it
`flex-wrap`, turning the overlay into a tall multi-row block that obscured the
diagram content beneath it. Because the breakpoint is width-based, it hit the
iOS WKWebView shell and mobile Safari/Chrome identically.

## Fix

CSS-only, in the existing `@media (max-width: 768px)` block of
`markdown-viewer/styles.css`:

- Take `.diagram-controls` out of the absolute overlay (`position: static`,
  clear `top`/`right`) so it sits in normal flow as a toolbar **above** the
  diagram. The controls already precede `.diagram-wrapper` in the DOM
  (`createDiagramContainer` appends controls then wrapper), so static stacking
  puts them on top without any DOM/JS change.
- Square off the floating-chip look on the bar (no radius/shadow, a
  `border-bottom` divider, secondary background) so it reads as a toolbar.
- Constrain the zoom slider (`flex: 1 1 120px`, full-width range) so it doesn't
  blow the toolbar width out on narrow screens.

No change to fullscreen controls' overlay behavior (the fullscreen surface has
room and a dedicated layout).

## Gates

- `npm run lint` — 0 errors (pre-existing warnings only)
- `npm run typecheck` — clean
- `npm test` — 448/448 pass
- `npm run build` — succeeds

## Notes / follow-ups

- This is shared-app CSS, so the single change reaches all three surfaces; no
  iOS action-sheet wiring was needed because the controls are in-document, not a
  toolbar button.
- Verified by reading the render path + CSS; a device/browser visual check on a
  real phone is the remaining confirmation (agent can't drive the iOS runtime).
