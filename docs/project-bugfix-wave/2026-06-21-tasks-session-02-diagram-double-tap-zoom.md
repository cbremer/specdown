# Session 02 — Double-tap on a diagram zoom button zooms the whole page

**Date:** 2026-06-21
**Type:** tasks
**Surfaces:** iOS (WKWebView shell) + mobile web — touch devices.

## Problem

Double-tapping the `+` (zoom-in) button on a diagram *sometimes* zoomed the
entire interface instead of just zooming the diagram.

### Root cause

On touch devices, mobile Safari / WKWebView treats a fast double-tap as the
page's built-in **double-tap-to-zoom** gesture. When the two taps landed on the
zoom button quickly enough, the browser ran its own page-zoom gesture (scaling
the whole UI) instead of — or on top of — firing two button clicks. The viewport
intentionally still allows user scaling (`width=device-width, initial-scale=1.0`,
no `user-scalable=no`), so the gesture was live on every interactive element.

## Fix

CSS-only, in `markdown-viewer/styles.css`: add `touch-action: manipulation` to
`.diagram-controls button` and `.fullscreen-controls button`. `manipulation`
keeps single tap, panning, and pinch-zoom but removes the browser's double-tap
zoom (and the associated ~300 ms click delay) on those controls — so a rapid
double-tap on `+` now just zooms in twice on the diagram. Pinch-to-zoom on the
page at large is untouched (we did not add `user-scalable=no`).

## Gates

- `npm run lint` — 0 errors (pre-existing warnings only)
- `npm test` — 448/448 pass
- `npm run build` — succeeds

## Notes / follow-ups

- Shared-app CSS, so the fix reaches all three surfaces in one change.
- Device confirmation on a real phone is the remaining check (agent can't drive
  the iOS runtime).
