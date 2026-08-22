# Session 02 — Starfield toggle on every surface

**Date:** 2026-08-22
**Branch:** `cursor/web-sharing-showcase-1116`

## Goal

Named visual **Theme**s for the empty-state drop zone, starting with Default
and Starfield. The catalog is one list (`visualThemeCatalog` in
`core/visual-theme-catalog.js`) so a future look is an entry + a CSS block.
Web showcase defaults to Starfield; desktop and iOS default to the compact
card. Light/dark/auto stays on the moon button.

## Tasks

- [x] Visual theme catalog (`default`, `starfield`) in `core/visual-theme-catalog.js`
- [x] Persist `localStorage.visualTheme`; migrate legacy `starfield` 0/1
- [x] Header Theme button + dropdown (all surfaces); visible "Theme" label
- [x] Desktop Appearance → Theme radio submenu rebuilt from the renderer catalog
- [x] iOS action-sheet row cycles `Theme: <label>` from the same catalog
- [x] CSS keyed on `[data-visual-theme="<id>"]`
- [x] Tests for defaults, persist, desktop opt-in, catalog rebuild, web opt-out
- [x] `npm test`, `npm run lint`, `npm run typecheck`

## Adding a theme

1. Append `{ id, label, icon }` to `visualThemeCatalog`
2. Add a `[data-visual-theme="<id>"]` block in `markdown-viewer/styles.css`

Header, iOS sheet, and desktop Appearance → Theme pick the new row up from
the catalog (desktop via `visual-theme-catalog` IPC when the renderer starts).

## Notes

- Showcase chrome (hero, pillars, live Mermaid) is still web-only.
- Reduced motion still skips the RAF stars; CSS nebula remains.
- Document view stays an opaque reading surface — the sky is the empty state.
