# Specdown Desktop — Brainstorm

> Planning document. No code yet — just thinking things through.

---

## Where We Are Today

Specdown (v0.0.39) is a browser-based markdown viewer built with vanilla JavaScript. No framework, no build step, no backend. You open it in a browser, drop in a `.md` file, and it renders:

- **GitHub Flavored Markdown** via Marked.js
- **Interactive Mermaid diagrams** with zoom, pan, reset, and fullscreen (via Panzoom)
- **Syntax-highlighted code blocks** via Highlight.js
- **Light/dark theme toggle** persisted in localStorage
- **Raw/preview toggle** to see the source markdown

The entire app is ~1,500 lines across `app.js`, `styles.css`, and `index.html`, plus four vendored libraries (Marked, Mermaid, Panzoom, Highlight.js). It's simple and focused.

### What works well
- Zero setup — no install, no build, no dependencies to manage at runtime
- Clean rendering of markdown + diagrams
- Mermaid interactivity (zoom/pan/fullscreen) is a differentiator
- Light enough to understand and modify in an afternoon

### Current limitations
- **Single file at a time** — loading a new file replaces the old one
- **No persistence** — the loaded markdown is lost on reload (only theme is saved)
- **Requires a web server** — even locally, you need `python3 -m http.server` or similar
- **No native file system access** — relies on drag-and-drop / file picker, can't watch files or open from Finder
- **Browser tab overhead** — competes with everything else in the browser

---

## Why a Desktop App?

The goal isn't to rebuild Specdown as something bigger. It's to make it **easier to use locally** while adding a few things that only make sense outside a browser tab.

**Core motivation:**
- Double-click a `.md` file in Finder and have it open in Specdown
- Keep multiple files open at once
- Remember what you were working on between sessions
- Feel like a real tool, not a webpage

**Non-goals:**
- Editing markdown (this is a viewer, not an editor)
- Cloud sync or collaboration
- Cross-platform from day one (start with Mac, expand later if it makes sense)

---

## Framework Options

Three realistic paths for wrapping a web-based UI in a Mac desktop app. Each lets us reuse the existing HTML/CSS/JS with varying degrees of native integration.

### Option A: Tauri

| | |
|---|---|
| **What it is** | Rust-based framework that wraps your web frontend in the system's native WebView (WKWebView on Mac) |
| **Binary size** | ~5–10 MB |
| **Backend language** | Rust |
| **Frontend** | Any web tech — our existing vanilla JS/HTML/CSS drops right in |
| **Native APIs** | File system, dialogs, menus, tray, notifications, auto-update |
| **Maturity** | v2 is stable, growing ecosystem |

**Pros:**
- Tiny footprint — doesn't bundle a browser engine
- Strong file system APIs (read, write, watch files)
- Native Mac menus and dialogs out of the box
- Good security model (explicit API permissions)
- Active development and community

**Cons:**
- Rust backend has a learning curve if you're not already writing Rust
- WebView rendering can have subtle differences from Chromium (but WKWebView on Mac is solid)
- Smaller plugin/extension ecosystem than Electron

**Best for:** Keeping things lightweight and native-feeling while reusing all existing web code.

---

### Option B: Electron

| | |
|---|---|
| **What it is** | Bundles Chromium + Node.js to run web apps as desktop apps |
| **Binary size** | ~150–200 MB |
| **Backend language** | JavaScript / Node.js |
| **Frontend** | Any web tech — same as above |
| **Native APIs** | Full Node.js access plus Electron APIs for windows, menus, dialogs, tray, etc. |
| **Maturity** | Battle-tested (VS Code, Slack, Discord, Notion) |

**Pros:**
- Everything is JavaScript — no new language to learn
- Chromium rendering guarantees pixel-perfect consistency with current browser behavior
- Massive ecosystem, tons of documentation and examples
- Electron Forge / Electron Builder make packaging straightforward
- Node.js gives full file system access, child processes, etc.

**Cons:**
- Large binary size for what is fundamentally a simple viewer
- Higher memory footprint (~100+ MB baseline)
- Chromium updates can introduce breaking changes
- Feels like overkill for an app this focused

**Best for:** Fastest path to a working desktop app if we prioritize developer velocity and don't mind the size.

---

### Option C: Swift + WKWebView

| | |
|---|---|
| **What it is** | A native macOS app (SwiftUI or AppKit) that embeds WKWebView to render the web frontend |
| **Binary size** | ~2–5 MB |
| **Backend language** | Swift |
| **Frontend** | Our existing web code loaded into WKWebView, with Swift ↔ JS bridging |
| **Native APIs** | Full macOS SDK — menus, windows, file system, Spotlight, Quick Look, etc. |
| **Maturity** | As mature as macOS itself |

**Pros:**
- Smallest possible footprint
- Best native Mac integration (Dock, menu bar, Spotlight, file associations, universal binary)
- Can distribute via Mac App Store or direct download with notarization
- No extra runtime — uses the system WebView
- SwiftUI makes basic window/tab management surprisingly simple

**Cons:**
- Mac-only (no path to Windows/Linux without a separate codebase or switching frameworks)
- Requires Swift/Xcode knowledge
- JS ↔ Swift bridge (`WKScriptMessageHandler`) adds complexity for native features
- More manual work for auto-updates (Sparkle framework or roll your own)

**Best for:** The most "Mac-native" result with the smallest binary, if we're committed to Mac-only.

---

### Framework Comparison

| Criteria | Tauri | Electron | Swift + WKWebView |
|---|---|---|---|
| Binary size | ~5–10 MB | ~150–200 MB | ~2–5 MB |
| Memory usage | Low | High | Lowest |
| Reuse existing JS | Yes, directly | Yes, directly | Yes, via WKWebView |
| File system access | Rust APIs | Node.js APIs | Swift APIs |
| Native menus/dialogs | Yes | Yes | Yes (best) |
| Auto-update | Built-in | Built-in | Manual (Sparkle) |
| Learning curve | Rust (moderate) | JS (low) | Swift (moderate) |
| Cross-platform later | Yes (Win/Linux) | Yes (Win/Linux) | No |
| Mac App Store | Possible | Possible | Easiest |
| Community/ecosystem | Growing | Largest | Apple ecosystem |

---

## Features to Carry Over (1:1 Parity)

Everything the web version does today should work identically in the desktop version:

- [ ] Markdown rendering (GFM via Marked.js)
- [ ] Mermaid diagram rendering with interactive zoom/pan/reset/fullscreen
- [ ] Syntax highlighting for code blocks
- [ ] Light/dark theme toggle
- [ ] Raw/preview mode toggle
- [ ] Drag-and-drop file loading
- [ ] Clean, minimal UI

---

## New Features for Desktop

### 1. Multi-File Support

Open multiple markdown files at once instead of one-at-a-time.

**How it could work:**
- **Tabbed interface** — each file gets a tab, like a browser or code editor
- Tabs show filename, can be closed individually
- Switching tabs preserves scroll position and view mode (raw/preview) per file
- Drag-and-drop multiple files at once to open them all
- Open from Finder via file association (double-click `.md` → opens in Specdown)

**State per tab:**
- File path
- Raw markdown content
- Scroll position
- View mode (raw/preview)
- Panzoom instance states for diagrams

**Open questions:**
- Limit on number of open tabs? Or just let it grow?
- Tab overflow behavior — scrollable tab bar? Dropdown?

---

### 2. File Grouping / Workspaces

Group related files together for quick access.

**Possible approaches:**

**A. Simple sidebar with groups**
```
┌──────────┬─────────────────────────────────┐
│ Groups   │                                 │
│          │   [Rendered Markdown Content]   │
│ ▼ Project│                                 │
│   spec.md│                                 │
│   api.md │                                 │
│   arch.md│                                 │
│          │                                 │
│ ▼ Notes  │                                 │
│   todo.md│                                 │
│   ideas  │                                 │
│          │                                 │
│ [+ Group]│                                 │
└──────────┴─────────────────────────────────┘
```

- User creates named groups
- Drag files into groups
- Click a file to open it in a tab
- Groups persist between sessions

**B. Workspace files**
- A `.specdown-workspace` file (JSON) that lists file paths and groups
- Open a workspace to restore all files and groups
- Can share workspace files with collaborators

**C. Recent files + favorites**
- Simpler: just track recently opened files and let users star/favorite specific ones
- No explicit grouping, but still gives quick access

**Recommendation:** Start with **C (recent + favorites)** as the MVP, evolve toward **A (sidebar groups)** if it proves useful. B is nice but adds complexity early.

---

### 3. Persistent Storage

Today, only the theme preference survives a page reload. The desktop version should remember more.

**What to persist:**
- Open files (paths + tab order)
- Last active tab
- Scroll positions per file
- View mode per file (raw/preview)
- Window size and position
- Theme preference
- Recent files list
- File groups / favorites
- Sidebar collapsed/expanded state

**Storage options by framework:**

| Data | Tauri | Electron | Swift |
|---|---|---|---|
| App preferences | `tauri-plugin-store` (JSON) | `electron-store` (JSON) | `UserDefaults` |
| File references | Store file paths | Store file paths | Bookmarks (sandbox-safe) |
| Window state | Tauri window APIs | `electron-window-state` | `NSWindow` restoration |

**Key consideration:** If distributing via Mac App Store (sandboxed), file access requires security-scoped bookmarks to re-open files across sessions. Tauri and Electron handle this differently than native Swift.

---

### 4. Native File System Integration

Things that are only possible (or much better) as a desktop app:

- **Open from Finder** — register as a handler for `.md` files
- **File watching** — auto-reload when the file changes on disk (useful when editing in another app)
- **Open with...** — appear in the macOS "Open With" menu for markdown files
- **Recents menu** — integrate with macOS File > Open Recent
- **Drag from Finder** — drag a file from Finder directly onto the app or its Dock icon

---

## Architecture Sketch

Regardless of framework choice, the architecture follows a similar pattern:

```
┌─────────────────────────────────────────────┐
│              Desktop Shell                   │
│  (Tauri / Electron / Swift)                 │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │           Web Frontend              │    │
│  │                                     │    │
│  │  ┌──────────┐  ┌────────────────┐  │    │
│  │  │ Tab Bar  │  │ Content Area   │  │    │
│  │  │          │  │                │  │    │
│  │  │ file1.md │  │ [Rendered MD]  │  │    │
│  │  │ file2.md │  │ [Diagrams]    │  │    │
│  │  │ file3.md │  │ [Code blocks] │  │    │
│  │  └──────────┘  └────────────────┘  │    │
│  │                                     │    │
│  │  Existing: Marked + Mermaid +      │    │
│  │  Panzoom + Highlight.js            │    │
│  └──────────┬──────────────────────────┘    │
│             │ Bridge (IPC / JS Bridge)      │
│  ┌──────────▼──────────────────────────┐    │
│  │        Native Backend               │    │
│  │                                     │    │
│  │  - File system read/watch          │    │
│  │  - Window management               │    │
│  │  - Persistent storage              │    │
│  │  - Native menus & dialogs          │    │
│  │  - File associations               │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**What stays in the web layer:**
- All markdown/Mermaid rendering (the hard-won diagram interactivity)
- Theme management (CSS variables still work great)
- View toggle logic
- UI layout and styling

**What moves to the native layer:**
- File reading (replace FileReader API with native FS access)
- File watching (new)
- Persistent state management
- Window/tab lifecycle
- Menu bar integration
- File type associations

**Bridge responsibilities (IPC):**
- `native → web`: "Here's the content of file X", "File X changed on disk", "User clicked Open Recent > file.md"
- `web → native`: "User wants to open a file", "Save this state", "What files are in group Y?"

---

## What Stays Simple

A few guiding principles to avoid scope creep:

1. **Viewer, not editor** — Specdown shows markdown. It doesn't edit it. Opening the file in your editor of choice stays one click away.
2. **No project management** — Groups/workspaces are for quick access, not for managing a project. No git integration, no task tracking, no build systems.
3. **Local only** — No accounts, no cloud sync, no sharing features. Files live on your disk.
4. **Minimal preferences** — Theme (light/dark) and maybe font size. No deep settings panels.
5. **Fast startup** — Should open faster than a browser tab, not slower.

---

## Open Questions

- **Which framework?** Need to weigh binary size, dev velocity, and whether cross-platform matters soon.
- **Tab model or window model?** Multiple tabs in one window (like a browser) or separate windows per file (like Preview.app)? Or both?
- **File watching scope** — Watch all open files? Only the active tab? Configurable?
- **How to handle large files?** The web version loads everything into memory. Is there a practical size limit we should handle?
- **Distribution** — Mac App Store, direct download (.dmg), Homebrew cask, or all three?
- **Auto-updates** — Important for direct distribution. Less important for App Store.
- **Keyboard shortcuts** — What's the minimal set? `Cmd+O` (open), `Cmd+W` (close tab), `Cmd+T` (new tab?), `Cmd+1-9` (switch tabs)?
- **Should the app name change?** "Specdown" vs "Specdown Desktop" vs something else?

---

## Possible MVP Scope

If we were to build a first version, the smallest useful thing might be:

1. Pick a framework (probably Tauri or Electron for speed)
2. Wrap existing web code as-is in a desktop window
3. Add native file open dialog (`Cmd+O`)
4. Add tabbed interface for multiple open files
5. Persist open tabs + theme between sessions
6. Register as a `.md` file handler on macOS

That gets us from "web page you have to serve" to "real Mac app that opens markdown files" with minimal new code. Everything else (grouping, file watching, sidebar) can come later.

---

*Last updated: 2026-02-20*
