# Tasks — Drag a folder onto the web app to open a workspace

**Date:** 2026-06-21
**Type:** tasks
**Roadmap item:** §4 of the [retrospective](2026-06-19-retrospective-handoff.md) —
"Workspace polish … drag-a-folder-to-open on the web."

## What

On the web, dropping a **folder** onto the app now opens it as a workspace
(folder sidebar + relative-link navigation), matching the existing "Open Folder"
button. Dropping **files** still opens them as tabs, exactly as before.

## Implementation

- **`markdown-viewer/src/features/workspace.js`**
  - `tryOpenDroppedFolder(dataTransfer)` — uses the File System Access
    drag-and-drop entry point (`DataTransferItem.getAsFileSystemHandle`,
    Chromium). The handle promises are captured **synchronously** in the sync
    portion of the async function (drop items are invalidated after the event
    tick), then a directory handle is resolved, scanned with the existing
    `scanDirectoryHandle` (same ignore-list/limits as the picker), and adopted
    via `applyWorkspace`. Resolves `true` when a folder was handled.
  - `isFolderDragDropSupported()` — exported capability check so callers keep a
    synchronous file-drop path on browsers without the API.
- **`markdown-viewer/src/main.js`** — both the drop-zone and document-level drop
  handlers now: if folder drag-drop is supported, try the folder path first and
  fall back to file opens if it wasn't a folder; otherwise open files
  synchronously (unchanged behavior on non-Chromium browsers — preserves the
  existing synchronous drop contract the tests rely on).

## Tests / gates

- +3 unit tests (open dropped folder; a dropped file is not treated as a folder;
  empty/no-items drop returns false). `npm test` → **451 pass**.
- lint 0 errors, typecheck clean, build succeeds.

## Scope notes / not done

The retro's workspace bullet also lists **persist/reopen the last workspace** and
**search across a folder**. Those are deferred:
- *Persist/reopen* on the web means storing a `FileSystemDirectoryHandle` in
  IndexedDB and re-requesting permission on launch (a permission-prompt UX
  decision); on desktop it means persisting the root path + re-scan via the
  bridge. Worth a dedicated session.
- *Folder-wide search* is a new search surface across files — also its own
  session.
