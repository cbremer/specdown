# Tasks — Session 14: Phase 4 (recent files)

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 4 — differentiators (web persistence)

Remembers recently-opened documents and offers one-click re-open from the
empty-state drop zone. Persisted across sessions in localStorage.

---

## What shipped

- **`markdown-viewer/src/features/recent-files.js`** (`// @ts-check`):
  - storage model — `recordRecentFile()` (most-recent-first, de-duplicated by
    ref, capped at 8), `getRecentFiles()`, `clearRecentFiles()`; persisted under
    `specdown-recent-files`;
  - rendering — `renderRecentFiles()` fills a drop-zone list (clickable items
    showing the filename, the full URL as `title`), hiding the section when
    empty; `configureRecentFiles({ onSelect })` decouples the re-open action.
- **`index.html`** — a `#recent-files-section` in the drop zone (a "recent"
  header + Clear button + list), hidden until there are recents.
- **`main.js`** — wires `onSelect` to `handleUrl(entry.ref)`, renders on init,
  and hooks the Clear button.
- **`file-loading.js`** — records the URL + re-renders after a successful URL
  open (this also covers GitHub repo-browser picks, which go through `handleUrl`).
- **CSS** — `.recent-files-*` built on the design tokens.

## Scope decision

**URLs only.** Browser-picked local files can't be reopened by path (the File
System Access security model), so they're intentionally not recorded — only
things the app can actually re-fetch (URLs, including GitHub raw links). Desktop
file-path re-open would need a new pull-style IPC method (`requestOpenPath`) in
the Electron main process; that's a separate, desktop-only follow-up.

## Verification

- `tests/unit/recentFiles.test.js` (+9): order, de-dup/move-to-top, cap at 8,
  ignore-without-ref, localStorage persistence, clear; drop-zone rendering
  (hidden when empty, one clickable item per recent, `onSelect` invoked with the
  entry on click).
- `npm run build` ✓, `npm run lint` ✓, `npm run typecheck` ✓, `npm test` →
  **371 passed**.

## Manual check (visual)

Open a couple of markdown URLs → close them (or reload) → the drop zone shows a
**recent** list; click one to re-open; the Clear button empties it. Confirm in
light + dark.

## Possible follow-ups

- Desktop: re-openable recent **file paths** via a new `requestOpenPath` IPC.
- Session restore (reopen the last document(s) on launch).
- Surface recents in the command palette too.
