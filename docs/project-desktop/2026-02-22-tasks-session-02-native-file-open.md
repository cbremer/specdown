# Session 2 Tasks: Native File Open + IPC Bridge + Menus

## Current State
- Electron shell working (`desktop/main.js`, `desktop/preload.js`)
- Dev loop functional (`npm run desktop`)
- Multi-file tabs implemented in `markdown-viewer/app.js` and `styles.css`
- Tab bar, tab switching, close, max-10 limit all working
- No IPC communication between main and renderer processes yet
- No native menus — using Electron's default menu

## Goal
Add native file open via `Cmd+O`, wire up the IPC bridge between main and renderer, and add a native macOS File menu. Files opened via the native dialog should appear as new tabs in the renderer.

---

## Tasks

### 1. Add native macOS menus to `desktop/main.js`
**Who:** AI coding agent
- Build a `Menu` template with:
  - **File:** Open (`Cmd+O`), Close Tab (`Cmd+W`), separator, Quit
  - **Edit:** standard Undo/Redo/Cut/Copy/Paste/Select All (macOS expects these)
  - **View:** Toggle Theme, Toggle Raw/Preview (wired later)
  - **Window:** standard macOS window management
- Set the menu via `Menu.setApplicationMenu()`
- `File > Open` triggers a native file dialog (`.md`, `.markdown`)

### 2. Implement native file dialog in `desktop/main.js`
**Who:** AI coding agent
- Use `dialog.showOpenDialog()` with filters for `.md`/`.markdown`
- Read the selected file via `fs.readFileSync()`
- Send file content + filename + path to the renderer via `webContents.send('file-opened', { ... })`
- Handle the macOS `open-file` app event for Finder file associations

### 3. Update `desktop/preload.js` with IPC bridge
**Who:** AI coding agent
- Expose `onFileOpened(callback)` via `contextBridge` — listens for `file-opened` from main
- Expose `requestFileOpen()` — sends a request to main to show the file dialog
- Expose `closeActiveTab()` — notifies renderer to close the current tab
- Expose `isDesktop` flag so renderer can detect Electron environment

### 4. Update `markdown-viewer/app.js` for desktop integration
**Who:** AI coding agent
- Detect desktop mode via `window.specdown.isDesktop`
- On `window.specdown.onFileOpened`, call `createTab()` with the received content
- Store `filePath` on tab objects (needed for future file watching + persistence)
- Wire `Cmd+W` / close-tab menu item to `closeTab()` via IPC

### 5. Add Electron main process tests
**Who:** AI coding agent
- Unit tests for menu template construction
- Unit tests for file reading/validation logic
- Tests for IPC message handling
- Mock Electron APIs (`dialog`, `BrowserWindow`, `Menu`, `ipcMain`)

### 6. Verify existing tests still pass
**Who:** AI coding agent
- Run `npm test` — all existing Jest tests must pass
- Run `npm run test:coverage` — coverage thresholds must still be met
- The `app.js` changes must not break web-only behavior

### 7. Update docs and status tables
**Who:** AI coding agent
- Update implementation status in spec and project README
- Mark Multi-file tabs as Implemented (done in previous session)
- Mark Native file open and Native macOS menus as Implemented

---

## Definition of Done
- `Cmd+O` opens a native macOS file dialog
- Selected file opens in a new tab in the renderer
- macOS `open-file` event handled (Finder file association ready)
- Native File menu with Open, Close Tab, Quit
- All existing `npm test` tests pass
- New Electron main process tests pass
- Docs updated with current implementation status

## What This Unblocks
- Session 3 can add file watching, persistent state, and remaining menus
- Finder file association will work once the app is packaged as a `.dmg`
