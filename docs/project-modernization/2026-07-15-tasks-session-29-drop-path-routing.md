# Tasks — Session 29: Desktop Drag-and-Drop Loses File Paths (Bug Fix)

**Date:** 2026-07-15
**Scope:** Owner-reported bug: opening a file via File → Open gives correct
live-reload status ("Live"/"Paused" chip, Reload from disk), but dragging a
folder (or file) into the Mac app opens content with **no** disk monitoring
and no Reload from disk.

## Root cause (two stacked problems)

1. **Dropped folders never reached the main process.** They were scanned in
   the renderer via the web FileSystem-entries API — content-only handles,
   no absolute paths — so every tab opened with `filePath: null`, the exact
   condition that hides the Live chip and disables disk actions. Only the
   "Open folder…" picker used the main-process scan (which returns real
   paths), which is why the picker worked.
2. **Dropped files silently lost their paths on the Electron 40 → 43 bump.**
   The web fallback relied on Electron's legacy `File.path` property, which
   Electron removed in v32+. The sanctioned replacement is
   `webUtils.getPathForFile`, callable only from the preload.

## Fix: route desktop drops by absolute path

- **Preload**: `getPathForFile(file)` (via `webUtils`) and
  `openDroppedPath(absPath)` (IPC `open-dropped-path`).
- **Main process**: `open-dropped-path` stats the path — a markdown **file**
  opens through `openFileByPath` (file-backed tab → live reload, Reload from
  disk, OS + in-app recents); a **directory** is registered in
  `workspaceRoots` (relative-link containment) and scanned with the desktop
  `scanWorkspace`, arriving as a real path-backed workspace.
- **Renderer** (`drag-drop.js`): when the desktop bridge is present, resolve
  every dropped item's absolute path and route it over the new channel; only
  when no path resolves does the drop fall through to the web reader
  (all-or-nothing per drop, so nothing is opened twice).
- Bridge (`bridgeGetPathForFile`, `bridgeOpenDroppedPath`) + `globals.d.ts`
  extended; the web/iOS surfaces are untouched (null-guarded seam).

Bonus fixes falling out of the routing: dropped files now appear in recents
(the renderer-side recording was dead once `File.path` vanished), and dropped
folders get workspace-root containment + relative-`.md`-link navigation,
matching picker-opened folders exactly.

## Verification

`npm test` — **503 passing** (+6: main-process routing ×3 incl. traversal of
nonexistent/non-string paths, renderer routing ×3 incl. web fallback).
Lint 0/0 (enforced), typecheck clean, build green.
