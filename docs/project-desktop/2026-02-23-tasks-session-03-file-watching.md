# Session 3 Tasks: File Watching

## Current State
- Electron shell working (`desktop/main.js`, `desktop/preload.js`)
- Dev loop functional (`npm run desktop`)
- Multi-file tabs implemented in `markdown-viewer/app.js` and `styles.css`
- Native file open (`Cmd+O`) and native macOS menus implemented
- IPC bridge in place (`file-opened`, `close-tab` channels)
- No file watching — files are static snapshots once opened

## Goal
Add per-tab file watching so the renderer auto-reloads content when an open file changes on disk. Watching is opt-in per tab via a toggle button in the content header. Implemented via `chokidar` in the main process.

---

## Tasks

### 1. Install chokidar
**Who:** AI coding agent
- `npm install chokidar`
- Add to `dependencies` in `package.json` (runtime dep, not devDep — needed in packaged app)

### 2. Add file watching to `desktop/main.js`
**Who:** AI coding agent
- Require `chokidar`
- Maintain a `Map<filePath, FSWatcher>` for active watchers
- `watchFile(filePath, webContents)` — start watching; on `change`, read and send `file-changed` to renderer
- `unwatchFile(filePath)` — close and remove watcher
- IPC handler `watch-file`: call `watchFile(filePath, event.sender)`
- IPC handler `unwatch-file`: call `unwatchFile(filePath)`
- Use `awaitWriteFinish` to avoid partial-write races
- Export `watchFile`, `unwatchFile`, `watchers` for testing

### 3. Update `desktop/preload.js`
**Who:** AI coding agent
- Expose `watchFile(filePath)` → `ipcRenderer.send('watch-file', filePath)`
- Expose `unwatchFile(filePath)` → `ipcRenderer.send('unwatch-file', filePath)`
- Expose `onFileChanged(callback)` → `ipcRenderer.on('file-changed', ...)`

### 4. Add watch toggle button to `markdown-viewer/index.html`
**Who:** AI coding agent
- Add a `<button id="watch-toggle">` inside `content-header-actions`, hidden by default
- Only shown in desktop mode when the active tab has a `filePath`

### 5. Style the watch toggle in `markdown-viewer/styles.css`
**Who:** AI coding agent
- Match existing button styles (similar to `view-toggle-button`)
- Active/watching state: distinct color (e.g., green accent)
- Small indicator dot on watched tabs in the tab bar

### 6. Update `markdown-viewer/app.js` for file watching
**Who:** AI coding agent
- Add `watching: false` to tab state object in `createTab()`
- Add `watchToggle` DOM element constant
- `updateWatchToggle()` — show/hide and update button state based on active tab
- `toggleWatching()` — toggle `tab.watching`, call `watchFile`/`unwatchFile`, update UI
- Wire `watch-toggle` click to `toggleWatching()` in `setupEventListeners()`
- In `setupDesktopIPC()`: register `onFileChanged` handler → find tab by `filePath`, update `rawMarkdown`, re-render if active
- In `closeTab()`: if tab is watching, call `window.specdown.unwatchFile(tab.filePath)`
- In `switchTab()` and `createTab()`: call `updateWatchToggle()` (desktop mode only)
- Tab bar indicator: show a dot on watched tabs in `renderTabBar()`

### 7. Add tests for file watching
**Who:** AI coding agent
- In `tests/unit/desktop-main.test.js`: add a `describe('file watching')` block
  - `watchFile` starts a chokidar watcher
  - `unwatchFile` closes and removes the watcher
  - Calling `watchFile` twice for the same path only creates one watcher
  - `watch-file` IPC handler calls `watchFile`
  - `unwatch-file` IPC handler calls `unwatchFile`
- Mock chokidar in the test file

### 8. Verify existing tests still pass
**Who:** AI coding agent
- Run `npm test` — all existing Jest tests must pass
- The `app.js` changes must not break web-only behavior

### 9. Update docs and status tables
**Who:** AI coding agent
- Update implementation status in spec (`2026-02-21-spec-desktop-v1.md`)
- Update project README status table
- Mark File Watching as Implemented

---

## Definition of Done
- A watch toggle button appears in the content header for desktop tabs with a file path
- Toggling watch on starts a `chokidar` watcher in the main process
- When the file changes on disk, the tab content reloads automatically
- Toggling watch off stops the watcher
- Closing a watched tab cleans up the watcher
- All existing `npm test` tests pass
- New file watching tests pass
- Docs updated

## What This Unblocks
- Session 4 can add persistent state (remember open files + watch state across launches)
