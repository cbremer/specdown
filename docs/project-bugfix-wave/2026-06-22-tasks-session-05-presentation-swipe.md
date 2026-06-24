# Session 05 — Swipe navigation in presentation mode

**Date:** 2026-06-22
**Type:** tasks
**Surface:** touch devices (iOS + mobile web; harmless elsewhere).

## What

In diagram presentation mode you could change slides only with the on-screen
‹ / › buttons or a keyboard. On a phone the natural gesture is a swipe, so this
adds **left-swipe → next, right-swipe → previous**.

## Implementation (`markdown-viewer/src/features/presentation.js`)

- `touchstart`/`touchend` listeners on the presentation **stage** (passive, so
  panzoom panning still works). They live on the overlay's stage and are
  discarded with the overlay on exit — no manual teardown.
- A gesture counts as a slide swipe only when:
  - it's **single-finger** (a second finger is a pinch → left to panzoom),
  - the slide is **not zoomed in** (`getScale() <= 1.05`; when zoomed, the
    gesture is a pan that panzoom owns), and
  - it's **clearly horizontal** (`|dx| >= 60px` and `|dx| > 1.5·|dy|`), so
    vertical flicks don't trigger it.

## Tests / gates

- Added 3 tests (left/right swipe changes the slide; vertical drag ignored;
  sub-threshold swipe ignored). `npm test` → **463 pass**.
- lint 0 errors, typecheck clean, build green.

## Notes

- jsdom has no `Touch`/`TouchEvent` constructors, so the tests fake the
  `touches`/`changedTouches` the handlers read.
- Pairs with the iPhone Present entry point (bugfix-wave session 04): launch from
  the action sheet, then swipe through.
