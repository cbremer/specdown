# Current Spec

## Product Overview

- **Name:** Specdown Desktop
- **What it is:** A macOS desktop application for viewing markdown files with interactive Mermaid diagram support. Wraps the existing Specdown web viewer (vanilla JS) in an Electron shell, adding native desktop capabilities.
- **Who it's for:** Developers and technical users who write and review markdown documentation with embedded Mermaid diagrams, and want a dedicated local viewer without running a web server.
- **Problem it solves:** The web version requires serving from a local web server, only handles one file at a time, loses state on reload, and can't integrate with the native file system (Finder, file associations, etc.).
- **Fidelity:** Personal tool / alpha — private internal project, not distributed publicly.

---

## Form Factor & Platform

- Desktop app for macOS (Tahoe or later)
- Single-window, tabbed interface
- Direct download distribution via `.dmg` from GitHub Releases
- No code signing or notarization — internal use only (users bypass Gatekeeper via right-click > Open or `xattr -cr`)

---

## Technology Stack

- **Framework:** Electron (Chromium + Node.js)
- **Frontend:** Existing vanilla JavaScript, HTML, CSS (shared with web version)
- **Libraries (carried over from web version):**
  - Marked.js 11.1.1 — markdown parsing and rendering
  - Mermaid.js 10.6.1 — diagram rendering
  - Panzoom 4.5.1 — interactive zoom/pan for diagrams
  - Highlight.js 11.9.0 — code syntax highlighting
- **New packages for desktop:**
  - `electron` — application runtime
  - `electron-forge` or `electron-builder` — packaging and DMG creation
  - `electron-store` — persistent JSON storage for app state
  - `chokidar` — file system watching
- **No cloud services** — entirely local, no backend, no accounts

---

## Features

### Core Features (1:1 parity with web version)

Everything the existing web version does must work identically in the desktop version:

- GitHub Flavored Markdown rendering via Marked.js
- Interactive Mermaid diagrams with zoom, pan, reset, and fullscreen
- Syntax-highlighted code blocks (JavaScript, Python, Java, Bash, JSON, YAML)
- Light/dark theme toggle (persistent)
- Raw markdown / rendered preview toggle
- Drag-and-drop file loading
- Clean, minimal UI

### New Desktop Features

#### Multi-File Tabs
- Tabbed interface within a single window, maximum 10 tabs
- Each tab maintains independent state: file path, raw markdown content, scroll position, view mode (raw/preview), and panzoom instance states for diagrams
- Tab bar displays filenames; tabs are individually closeable
- Switching tabs preserves and restores per-tab state
- Drag-and-drop multiple files at once to open them in separate tabs
- Only the active tab's diagrams need to be fully rendered (lazy rendering for performance)

#### Native File Open
- `Cmd+O` opens a native macOS file dialog filtered to `.md` / `.markdown` files
- Register as a file handler for `.md` files — double-click a markdown file in Finder to open it in Specdown Desktop
- Drag files from Finder onto the Dock icon to open them
- Appear in the macOS "Open With" context menu for markdown files

#### File Watching (Opt-In)
- Per-file toggle to auto-reload content when the file changes on disk
- Useful when editing markdown in another application and previewing in Specdown Desktop
- Implemented via `chokidar` in the main process, with change notifications sent to the renderer via IPC
- Watching is off by default; user enables it per tab

#### Persistent State
- Remembers the following across sessions via `electron-store`:
  - Open file paths and tab order
  - Last active tab
  - Scroll position per file
  - View mode per file (raw/preview)
  - Window size and position
  - Theme preference (light/dark)
  - Recent files list
  - Favorited files
- State is saved on meaningful changes (tab switch, close, theme change) and on app quit

#### Recent Files & Favorites
- Track recently opened files (accessible via File > Open Recent menu and within the app)
- Users can star/favorite specific files for quick access
- Favorites persist across sessions
- Full sidebar grouping / workspaces deferred to a later iteration

#### Print & PDF Export
- Print the rendered markdown view via Electron's native print dialog
- Export to PDF via `webContents.printToPDF()`
- Accessible via `Cmd+P` and File > Print / Export to PDF menu items

#### Keyboard Shortcuts
- `Cmd+O` — Open file
- `Cmd+W` — Close current tab
- `Cmd+1` through `Cmd+9` — Switch to tab by position
- `Cmd+P` — Print / Export to PDF

#### Native macOS Menus
- **File:** Open, Open Recent, Close Tab, Print, Export to PDF
- **View:** Toggle Theme, Toggle Raw/Preview
- **Window:** standard macOS window management
- **Help:** About Specdown Desktop

---

## Architecture

### Same Repo, Shared Code

The desktop version lives in the same repository as the web version. Desktop-specific code is isolated in a `desktop/` directory. The existing web app (`markdown-viewer/index.html`, `app.js`, `styles.css`, and `vendor/`) is shared between both versions. The web version's GitHub Pages deployment is completely unaffected.

### Repo Layout

```
specdown/
├── markdown-viewer/       ← existing web app (shared with desktop)
│   ├── index.html         ←   Main application page
│   ├── app.js             ←   Core app logic (modified for tab management + IPC)
│   ├── styles.css         ←   Styles (extended for tab bar UI)
│   └── vendor/            ←   Marked, Mermaid, Panzoom, Highlight.js
├── desktop/               ← Electron-specific
│   ├── main.js            ←   Main process (window, menus, file system, persistence)
│   ├── preload.js         ←   Secure IPC bridge
│   └── icons/             ←   App icons
├── tests/                 ← existing web tests + new desktop tests
├── package.json           ← extended with Electron deps + scripts
├── brainstorm.md
├── SPEC.md
└── .github/workflows/
    ├── static.yml         ← existing: deploys web version to GitHub Pages
    └── desktop.yml        ← NEW: builds .dmg, attaches to GitHub Releases
```

### Process Architecture

```
┌──────────────────────────────────────────────────┐
│                Electron Shell                     │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │          Renderer Process                  │  │
│  │          (Web Frontend)                    │  │
│  │                                            │  │
│  │  ┌─────────────┐  ┌───────────────────┐   │  │
│  │  │  Tab Bar    │  │  Content Area     │   │  │
│  │  │             │  │                   │   │  │
│  │  │  file1.md   │  │  [Rendered MD]    │   │  │
│  │  │  file2.md   │  │  [Diagrams]      │   │  │
│  │  │  file3.md   │  │  [Code blocks]   │   │  │
│  │  └─────────────┘  └───────────────────┘   │  │
│  │                                            │  │
│  │  Shared: Marked + Mermaid + Panzoom +     │  │
│  │  Highlight.js + tab management logic       │  │
│  └──────────────┬─────────────────────────────┘  │
│                 │  IPC (via preload.js)           │
│  ┌──────────────▼─────────────────────────────┐  │
│  │          Main Process                      │  │
│  │          (Node.js)                         │  │
│  │                                            │  │
│  │  - File system read (fs)                  │  │
│  │  - File watching (chokidar)               │  │
│  │  - Persistent storage (electron-store)    │  │
│  │  - Native menus & dialogs                 │  │
│  │  - Window management                      │  │
│  │  - Print / PDF export                     │  │
│  │  - File type associations                 │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### IPC Contract

**Main process → Renderer:**
- Deliver file content when a file is opened (via menu, dialog, Finder, or drag)
- Notify when a watched file changes on disk
- Trigger actions from menu items (toggle theme, toggle view mode, print)

**Renderer → Main process:**
- Request to open a file (triggers native dialog)
- Save app state (open tabs, scroll positions, view modes, etc.)
- Toggle file watching on/off for a specific file path
- Request print or PDF export

### Deployment

| | Web Version | Desktop Version |
|---|---|---|
| **What ships** | Static files (HTML/JS/CSS) | Bundled `.app` inside `.dmg` |
| **Deployed via** | GitHub Pages (`static.yml`) | GitHub Releases (`desktop.yml`) |
| **Triggered by** | Push to main | Tag push or manual workflow dispatch |
| **Users access via** | `cbremer.github.io/specdown` | Download `.dmg` from GitHub Releases |

### Versioning

Web and desktop share a single version number from `package.json`. Can split to independent versioning later if release cadences diverge.

---

## Design Principles

1. **Viewer, not editor** — Specdown Desktop shows markdown. It does not edit it.
2. **Local only** — No accounts, no cloud sync, no sharing features. Files live on the user's disk.
3. **Minimal preferences** — Theme toggle and that's about it. No deep settings panels.
4. **Fast startup** — Should feel faster to open than a browser tab.
5. **Web version unaffected** — Desktop additions must not break the existing GitHub Pages deployment or web functionality.

---

## Scope Boundaries

### In Scope
- All features listed above
- Existing Jest test suite continues passing
- New tests for Electron main process and IPC
- DMG packaging via GitHub Actions
- Shared versioning with web version

### Out of Scope (Deferred)
- Markdown editing
- Sidebar file grouping / workspaces
- Mac App Store distribution
- Code signing / notarization
- Cross-platform support (Windows, Linux)
- Accessibility (VoiceOver, keyboard-only navigation)
- Auto-update mechanism
- Cloud sync or collaboration

---

## Testing Strategy

### Shared Rendering Logic
Existing Jest test suite (unit + integration) continues covering markdown rendering, Mermaid diagram processing, theme toggling, and view mode switching. These tests validate the shared web frontend that both versions use.

### Electron Main Process
Unit tests for file operations, state persistence, and menu construction using Jest with mocked Electron APIs. Covers:
- File reading and validation
- `electron-store` read/write operations
- File watcher setup and teardown
- Menu template generation
- IPC message handling

### IPC Integration
Tests verifying the main ↔ renderer communication pipeline:
- File open request → content delivered → rendered in tab
- State save request → persisted to store → restored on relaunch
- File watch toggle → watcher started/stopped → change notification delivered

### End-to-End
Playwright for Electron for full-app tests:
- Open a file via dialog, verify it renders correctly
- Open multiple files, switch between tabs, verify state preservation
- Close and reopen the app, verify state restoration
- Print / export to PDF
- Theme and view mode toggling

### Manual Test Checklist
- Finder file association (double-click `.md` file opens in Specdown Desktop)
- Drag file from Finder onto Dock icon
- Gatekeeper bypass on first launch
- DMG install and uninstall (drag to Applications / drag to Trash)
- Open Recent menu population

---

## Implementation Status

| Feature | Status |
|---|---|
| Electron shell (`desktop/main.js`, `desktop/preload.js`) | Implemented |
| Dev loop (`npm run desktop`) | Implemented |
| Existing Jest test suite passing | Verified |
| Multi-file tabs | Pending |
| Native file open (`Cmd+O`) | Pending |
| File watching | Pending |
| Persistent state | Pending |
| Recent files & favorites | Pending |
| Print & PDF export | Pending |
| Native macOS menus | Pending |
| DMG packaging (`electron-builder`) | Configured (awaiting macOS build) |

*Last updated: 2026-02-21*
