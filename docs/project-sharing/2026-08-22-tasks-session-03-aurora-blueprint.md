# Session 03 — Aurora and Blueprint themes

**Date:** 2026-08-22
**Branch:** `cursor/empty-state-themes-1116`

## Goal

Prove the Theme catalog scales: two new empty-state looks, CSS-only, no new
canvas engines. Aurora was the placeholder id already used in desktop menu
tests; Blueprint is the spec-sheet counterpart.

## Tasks

- [x] Append `aurora` and `blueprint` to `visualThemeCatalog`
- [x] Waves / grid icons in `core/icons.js`
- [x] `[data-visual-theme="aurora"]` and `[data-visual-theme="blueprint"]` CSS
      (dark + light, reduced motion)
- [x] Header / iOS cycle / desktop Appearance pick them up from the catalog
- [x] Tests for catalog ids, menu rows, and a full iOS cycle
- [x] `npm test`, `npm run lint`, `npm run typecheck`

## Notes

- Web default is still Starfield. These are opt-in from the Theme picker.
- Starfield canvas stays mounted only for Starfield; Aurora/Blueprint do not
  start a RAF loop.
