# Session 32 — File info panel (on-disk location & metadata)

**Date:** 2026-08-14
**Type:** tasks
**Status:** ✅ implemented

## Problem

When viewing a document there was no way to see *where* the file actually lives
on disk. This matters most on the desktop app: agents (and some editors) stash
markdown files in hidden or unexpected directories, and the viewer never told
you the absolute path. Users also wanted the basic filesystem facts — size,
creation date, last-modified date, and owner.

## What shipped

A **File info** action that opens a small accessible modal describing the active
document. Reachable from all three surfacing points, per the "one shared app,
per-surface surfacing" rule:

- **Desktop/web toolbar:** the "⋮" overflow menu (`File info`, offered whenever a
  document is open).
- **iPhone:** the iOS action sheet (`File Info` button) — the desktop toolbar is
  hidden on the phone layout, so the control is duplicated here.
- **Command palette** (⌘/Ctrl+K): `Show file info`.

The sheet joins the Escape close-priority chain (above the shortcuts sheet).

### Fields

- **Name** — the filename.
- **Location** — the headline field:
  - Desktop file-backed tab → the **absolute path** (monospace, selectable),
    plus a **Copy path** button.
  - URL tab → the **source URL**.
  - Browser File (web) → a note that the browser can't reveal the path, pointing
    at the desktop app.
- **Size / Created / Modified / Owner** — from disk on desktop; on the web
  surface the browser `File` object's `size` and `lastModified` are shown where
  available.

### How the data flows

- **Desktop:** a new request/response IPC channel `get-file-metadata`
  (`ipcMain.handle` / `ipcRenderer.invoke`) returns
  `{ filePath, size, birthtimeMs, mtimeMs, owner }` from `fs.statSync`. Owner is
  best-effort: Node has no portable uid→username lookup, so the current user is
  named via `os.userInfo()`, other users show `uid N`, and Windows (uid −1)
  shows nothing. Failures return `null` (no throw across IPC) → the sheet shows
  "Unavailable". Exposed on the bridge as `getFileMetadata` and reached via
  `bridgeGetFileMetadata` (the portability seam).
- **Web/URL:** `createTab` gained an optional `sourceMeta`
  (`{ url?, size?, lastModified? }`, typed on `state.Tab`); `handleFile` and
  `handleUrl` thread it through so pathless tabs can still show what a browser
  exposes.

The metadata fetch is async: the path renders immediately and the disk-backed
fields fill in when the fetch resolves. A per-open token guards against a slow
fetch writing into a sheet that was already closed or reopened.

## Files

- `markdown-viewer/src/features/file-info.js` — **new** modal module.
- `markdown-viewer/src/features/toolbar-overflow.js` — `File info` entry.
- `markdown-viewer/src/platform/ios-wiring.js` + `index.html` — iOS sheet button.
- `markdown-viewer/src/features/app-commands.js` — palette command.
- `markdown-viewer/src/features/keyboard.js` — Escape chain.
- `markdown-viewer/src/features/tabs.js`, `src/core/state.js`,
  `src/features/file-loading.js`, `src/main.js` — `sourceMeta` threading.
- `markdown-viewer/src/platform/bridge.js`, `src/types/globals.d.ts` — bridge
  contract for `getFileMetadata`.
- `desktop/main.js`, `desktop/preload.js` — `get-file-metadata` IPC +
  `buildFileMetadata` / `resolveOwnerName`.
- `markdown-viewer/styles.css` — `.file-info-*` styles (modeled on the shortcuts
  sheet).
- `tests/unit/fileInfo.test.js` — **new** (14 tests); `tests/unit/desktop-main.test.js`
  — `buildFileMetadata` / `resolveOwnerName` coverage + `ipcMain.handle` mock.

## Verification

`npm test` (all suites), `npm run lint`, `npm run typecheck`, and `npm run build`
all clean.
