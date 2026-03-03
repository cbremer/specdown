# Session 5 — Verification Checklist (Last 2 Days)

**Date:** 2026-03-03
**Goal:** Track what shipped in the last 48 hours and verify completeness.

---

## Scope

This checklist covers work merged/committed between **2026-03-02 and 2026-03-03**.

---

## What Was Built in the Last 2 Days

### A) Product features (Session 4)

From the Session 4 implementation and tests, these shipped:

- [ ] F1 — In-document search (`Cmd/Ctrl+F`, next/prev, match count)
- [ ] F2 — Table of contents sidebar (headings index + jump)
- [ ] F3 — Native Find menu integration (`Edit > Find`)
- [ ] F4 — Expanded syntax highlighting language support
- [ ] F5 — Side-by-side split view (raw markdown + rendered preview)
- [ ] F6 — Persistent session restore (tabs + window size)
- [ ] F7 — Recent files menu (`File > Open Recent`)
- [ ] F8 — Native print integration (`File > Print`, `Cmd+P`)
- [ ] F9 — Global shortcut (`Cmd/Ctrl+Shift+M`)
- [ ] F10 — Mermaid export (SVG + PNG)
- [ ] F11 — GitHub repo markdown browser
- [ ] F12 — Annotation mode with persisted notes
- [ ] F13 — Diagram minimap in fullscreen
- [ ] F14 — Custom CSS themes (web + desktop)
- [ ] F15 — Windows/Linux desktop CI packaging

### B) Test coverage added

- [ ] Unit tests added for search, TOC, split view, diagram export, diagram share links, annotations, GitHub repo browser, and custom CSS
- [ ] Full Jest suite remains green after feature additions

### C) Release pipeline/workflow hardening

- [ ] Version bump workflow updated to handle branch protection correctly
- [ ] Workflow authentication switched to `ADMIN_PAT` for protected operations
- [ ] Downstream workflow triggering adjusted to use `--ref main`
- [ ] End-to-end version bump → release/deploy flow confirmed by test trigger + subsequent version bumps (`v0.0.59`, `v0.0.60`)

---

### Excluded / out-of-scope requirements

- [x] Removed game controller requirement from this checklist (it belongs to a different project, not SpecDown).

---

## Remaining Features to Build

### Desktop project

- [x] No remaining features in the current Desktop Session 1–4 scope (marked complete in project status).

### URL project

- [ ] Inline reviewer comments (Google Docs-style) were explicitly scoped out of URL Session 1 and remain unimplemented.

### iOS/iPad project

- [ ] Project is still in brainstorming phase (no code yet)
- [ ] Write `spec-ios-v1`
- [ ] Execute Session 1 implementation tasks (project setup)

---

## Suggested Verification Pass (Recommended Order)

- [ ] Verify web viewer features (F1, F2, F4, F5, F10, F11, F12, F13, F14)
- [ ] Verify desktop-native integrations (F3, F6, F7, F8, F9, desktop half of F14)
- [ ] Verify CI/release behavior (F15 + version bump/release pipeline)
- [ ] Close checklist items above as each is manually confirmed
