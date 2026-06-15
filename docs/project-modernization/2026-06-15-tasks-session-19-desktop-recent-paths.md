# Tasks — Session 19: desktop recent file-paths

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 4 — differentiators

The in-app recent-files list (session 14, #133) was **URL-only**: browser-picked
local files can't be reopened by path, so they were intentionally never
recorded. On the **desktop** (Electron) shell that limitation doesn't apply —
the main process already knows the file path and can re-read it. This session
makes the drop-zone recents list cover desktop file opens too.

---

## What shipped

### A reopenable `'path'` entry type
- `features/recent-files.js` generalizes `RecentEntry` from URL-only to
  `type: 'url' | 'path'`. `recordRecentFile()` still defaults to `'url'` (so the
  web URL flow and its tests are unchanged) and now also accepts `'path'`.
  Rendered items carry `data-type` for styling/intent.

### Recording desktop opens
- `platform/desktop.js` records a `'path'` recent (and re-renders the list) when
  the main process delivers a file via `onFileOpened` — this covers **Cmd+O**,
  **Finder double-click**, **drag-to-dock**, the **native Open Recent menu**, and
  **session restore**.
- `features/file-loading.js` records a `'path'` recent when a file **dropped onto
  the window** carries a real `file.path` (Electron only; browser `File` objects
  have none, so the web stays URL-only).

### Re-opening by path (pull-style IPC)
- New bridge method `requestOpenPath(filePath)` (`desktop/preload.js`) → a
  `request-open-path` handler in `desktop/main.js` that calls the existing
  `openFileByPath` (which validates the extension and swallows read errors, so a
  stale/moved path is a safe no-op).
- `main.js` routes a recents click through `openRecentEntry`: `'path'` entries go
  to `window.specdown.requestOpenPath`; `'url'` entries still go to `handleUrl`.
- `requestOpenPath` is declared on the desktop bridge type in `globals.d.ts`.

## Verification

- `tests/unit/recentFiles.test.js` (+5): default `url` type, records `path`
  type, items tagged with `data-type`, a `path` click drives the desktop bridge,
  and a `path` click without a bridge doesn't throw.
- `tests/unit/desktop-main.test.js` (+1): the `request-open-path` IPC handler is
  registered and tolerates non-string / empty / missing-file input.
- `npm run build` ✓, `npm run lint` ✓ (0 errors), `npm run typecheck` ✓,
  `npm test` → **385 passed**.

## Manual check (desktop)

Open a few files (Cmd+O / Finder / drag-in) → close them → the drop zone's
**Recent** list now shows those local files → click one and it reopens in a new
tab. URLs continue to reopen as before. Confirm light + dark.
