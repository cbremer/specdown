# Session 02 — Starfield toggle on every surface

**Date:** 2026-08-22
**Branch:** `cursor/web-sharing-showcase-1116`

## Goal

Named visual themes for the empty-state drop zone, starting with Default and
Starfield. The catalog is one list (`visualThemeCatalog`) so future looks
are an entry + a CSS block. Web showcase defaults to Starfield; desktop and
iOS default to the compact card.

## Tasks

- [x] Visual theme catalog in `features/starfield.js` (`default`, `starfield`)
- [x] Persist `localStorage.visualTheme`; migrate legacy `starfield` 0/1
- [x] Header Theme button + dropdown (all surfaces)
- [x] Desktop Appearance → Theme radio submenu
- [x] iOS action-sheet row cycles `Theme: Default` / `Theme: Starfield`
- [x] CSS keyed on `[data-visual-theme="<id>"]`
- [x] Tests for defaults, persist, desktop opt-in, web opt-out
- [x] `npm test`, `npm run lint`, `npm run typecheck`

## Notes

- Showcase chrome (hero, pillars, live Mermaid) is still web-only.
- Reduced motion still skips the RAF stars; CSS nebula remains.
- Document view stays an opaque reading surface — the sky is the empty state.
