# Tasks — Session 20: workspace (folder) mode

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 4 — differentiators

The largest remaining Phase 4 feature: open a **folder** and browse its markdown
files from an in-app sidebar, with working **relative links** between documents.
This slice is **desktop (Electron) first** — the main process owns full
filesystem access, so it's where folder-browsing makes the most sense; the
web/iOS surfaces get it in a later slice.

---

## What shipped

### Main process (`desktop/main.js`)
- `scanWorkspace(root)` — recursive markdown scan returning `{ path, relPath,
  name }` entries, sorted by relative path. Bounded by depth (8), file count
  (2000), and an ignore list (`node_modules`, `.git`, `dist`, `build`, hidden
  dirs, …) so a big repo can't hang the process or flood the renderer.
- `showOpenFolderDialog()` — native `openDirectory` picker → scan → sends
  `workspace-opened { root, files }` to the renderer.
- `openRelativeFromFile(fromPath, href)` — resolves a clicked relative link
  against the source document's directory (strips `#`/`?`, percent-decodes) and
  opens it via the existing extension-validated `openFileByPath`.
- IPC: `request-open-folder`, `request-open-relative`. Native **File → Open
  Folder…** menu item (`Cmd/Ctrl+Shift+O`).

### Bridge (`desktop/preload.js`, `globals.d.ts`)
- `requestOpenFolder()`, `requestOpenRelative(fromPath, href)`,
  `onWorkspaceOpened(cb)`; `SpecdownWorkspace` / `SpecdownWorkspaceFile` types.

### Renderer (`features/workspace.js`, new)
- A workspace **sidebar** (mirrors the TOC sidebar) listing every file by
  relative path; clicking one opens it via `requestOpenPath`. The active file is
  highlighted (refreshed from `renderMarkdown`).
- Opening a folder **auto-opens** the first file (preferring a top-level
  `README`) so the content area — which hosts the sidebar — becomes visible.
- A header **Files** toggle (desktop-only, shown when a workspace is loaded) and
  a drop-zone **Open Folder** button (desktop-only).
- **Relative-link navigation**: a delegated click handler on the rendered
  content intercepts relative `.md`/`.markdown` links and routes them through
  `requestOpenRelative`; external/anchor/protocol/non-markdown links are left
  untouched. The Open Folder button `stopPropagation`s so it doesn't trip the
  drop-zone's click-to-browse.
- Command palette: **Open folder…** (desktop-only).

## Verification

- `tests/unit/workspace.test.js` (new, +9): Open Folder button visibility +
  click (and that it doesn't also trigger file-open), sidebar render/auto-open,
  README preference, click-to-open, empty-folder hide, toggle, and relative-link
  routing (incl. ignoring external/anchor/non-md links).
- `tests/unit/desktop-main.test.js` (+4): `scanWorkspace` recursion/sort +
  ignore-dirs; `request-open-folder`/`request-open-relative` registration and
  malformed-payload safety.
- `npm run build` ✓, `npm run lint` ✓ (0 errors), `npm run typecheck` ✓,
  `npm test` → **408 passed**.

## Manual check (desktop)

File → Open Folder… (or the drop-zone button / `Cmd/Ctrl+Shift+O`) → pick a docs
folder → the first doc opens and a **Files** sidebar lists the folder's markdown
→ click around; click a relative `.md` link inside a doc and it follows to that
file. Toggle the sidebar with the **Files** button. Confirm light + dark.

## Follow-ups

- Web folder support via the File System Access API (`showDirectoryPicker`).
- Tree (nested) presentation instead of a flat relative-path list; collapse/expand.
