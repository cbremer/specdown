# Session 04 — Surface presentation mode on iPhone

**Date:** 2026-06-22
**Type:** tasks
**Surface:** iOS (WKWebView) + mobile web — phone-width layouts.

## Problem

Diagram **presentation mode** (`presentation.js` — full-screen step-through of a
document's Mermaid diagrams) was **unreachable on iPhone**. Its only entry point,
the `#present-button`, lives in `.content-header-actions`, which is hidden at
phone width (and on the iOS native shell, except iPad). It was never wired into
the iPhone bottom **action sheet** — the same per-surface surfacing gap called
out in CLAUDE.md ("a new toolbar control must also be wired into the iOS action
sheet to be reachable on iPhone"). So iPad/desktop could present, iPhone could
not. (Once open, the overlay's on-screen ‹ / › nav already works by touch.)

## Fix

- **`markdown-viewer/index.html`** — added a `#ios-present-button`
  ("Present Diagrams") to `.ios-sheet-actions`, hidden by default (like the
  desktop Present button).
- **`markdown-viewer/src/main.js`** —
  - query the button; on click, `closeIOSActionSheet()` then `startPresentation()`
    (same handler the desktop button uses);
  - toggle its visibility alongside the desktop Present button in the render
    path, so it appears **only when the document has presentable diagrams**
    (`hasPresentableDiagrams()`).

No change to presentation mode itself — just the iPhone entry point. iPad keeps
using the toolbar button (the action sheet isn't shown there), so there's no
duplication.

## Tests / gates

- Added a test: with diagrams present, clicking `#ios-present-button` opens the
  presentation overlay. `npm test` → **461 pass**.
- lint 0 errors, typecheck clean, build green.
