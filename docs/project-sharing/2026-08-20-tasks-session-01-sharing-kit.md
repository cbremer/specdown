# Session 01 — Sharing kit + web showcase

**Date:** 2026-08-20
**Branch:** `cursor/web-sharing-showcase-1116`

## Goal

Ship a LinkedIn-ready product story: copy kit under `docs/project-sharing/`, a
web-only GitHub Pages showcase empty state, Open Graph unfurl tags, and tests.
Desktop and iOS keep the compact drop-zone. The web viewer stays fully usable.

## Tasks

- [x] Add `docs/project-sharing/` (README, homepage spec, feature copy, article
      outlines, sharing playbook) and index it from `docs/README.md`
- [x] Web-only empty-state showcase: hero, live Mermaid, pillars, desktop
      download, Try diagram showcase (bundled sample via fetch)
- [x] Gate landing so Electron/iOS screenshots stay the simple drop-zone
- [x] Click-to-browse ignores new interactive nodes (links, diagram, pillars)
- [x] Open Graph / Twitter meta + 1200×630 `og-image.png`
- [x] Tests for web-only gating, drop-zone click targets, showcase sample on web
- [x] `npm test`, `npm run lint`, `npm run typecheck` green

## Notes

- Sample buttons on iOS still go through `openBundledSample` on the native
  bridge. Web fetches `./samples/diagram-showcase.md` from the Vite `dist/`
  copy (see `scripts/copy-static.js`).
- Landing Mermaid does not run when the host has no layout box, so Jest init
  does not pull in the engine and race `mermaid.test.js`.
