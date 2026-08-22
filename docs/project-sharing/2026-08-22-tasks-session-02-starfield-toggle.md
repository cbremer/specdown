# Session 02 — Starfield toggle on every surface

**Date:** 2026-08-22
**Branch:** `cursor/web-sharing-showcase-1116`

## Goal

Let people turn the nebula + starfield on (or off) on web, desktop, and iOS.
The web showcase stays the product homepage; native empty states stay the
compact dashed card until the user opts in.

## Tasks

- [x] Extract the sky into `features/starfield.js` (unique `starfield*` names)
- [x] Persist `localStorage.starfield` (`1` / `0`); default on for web, off
      for Electron and iOS
- [x] Header sparkles toggle next to theme (reachable on iPhone empty state)
- [x] Desktop Appearance menu checkbox (`Starfield Background`)
- [x] iOS action-sheet row (`Turn Starfield On/Off`)
- [x] Scope nebula/canvas CSS to `[data-starfield="on"]` so native shells
      without the toggle stay the compact card
- [x] Tests for defaults, persist, desktop opt-in, web opt-out
- [x] `npm test`, `npm run lint`, `npm run typecheck`

## Notes

- Showcase chrome (hero, pillars, live Mermaid) is still web-only.
- Reduced motion still skips the RAF stars; CSS nebula remains.
- Document view stays an opaque reading surface — the sky is the empty state.
