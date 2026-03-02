# Session 4 — 15 Product Ideas Implementation

**Date:** 2026-03-02
**Branch:** `claude/specdown-product-ideas-W0E4J`

---

## Goal

Implement all 15 product improvement ideas brainstormed in a single overnight session. Features span both the shared web viewer and the Electron desktop app.

---

## Features Implemented

### Web Viewer (shared — both web and desktop)

- [x] **F4 — Expanded syntax highlighting**: Added 16 new Highlight.js languages (TypeScript, Rust, Go, SQL, Ruby, PHP, Kotlin, Swift, Scala, CSS, XML/HTML, Dockerfile, Makefile, Shell, PowerShell, Lua). Language files copied to `vendor/languages/`; script tags added to `index.html`.

- [x] **F8 — Print / PDF export**: Added "Print" button to content header. Wires to `window.print()`. Keyboard shortcut `Cmd/Ctrl+P` also triggers print when a document is open. CSS print styles already existed (hide UI chrome, clean pagination). Also wired to desktop native menu `File > Print`.

- [x] **F1 — Mermaid diagram export (SVG + PNG)**: Added SVG and PNG download buttons to each diagram's control strip, and also to the fullscreen controls. SVG is serialized directly; PNG uses a Canvas 2× render for retina quality. Both use `URL.createObjectURL` + `<a download>`.

- [x] **F3 — In-document search (`Cmd/Ctrl+F`)**: Full search bar that slides in below the content header. Text-node walker wraps matches in `<mark>` elements with highlight styling. Navigate forward/back with ↑/↓ buttons or Enter/Shift+Enter. Current match shown in accent orange; all others in yellow. ESC or × closes. Real-time as you type.

- [x] **F2 — Table of contents sidebar**: "Contents" toggle button shows/hides a left sidebar. Headings H1–H4 parsed after every render; each gets an auto-generated `id`. Clicking a TOC entry smooth-scrolls to the heading. Scroll-spy highlights the active heading as you read.

- [x] **F10 — Shareable diagram deep links**: "🔗" button on each diagram encodes the Mermaid source as Base64 and writes `?diagram=<encoded>` to the clipboard. On load, `checkForDiagramLink()` reads that query param and opens the diagram in a synthetic tab. Toast notification confirms copy.

- [x] **F5 — Side-by-side split view**: "Split" toggle button shows raw markdown and the rendered preview in a 50/50 horizontal layout. The raw pane syncs whenever a new document is rendered or the active tab changes. On mobile, the layout stacks vertically instead.

- [x] **F13 — Diagram minimap in fullscreen**: A 160px thumbnail of the current diagram is rendered into a `<canvas>` in the bottom-left corner of fullscreen mode. A blue viewport rect tracks your current pan position. Updates on every `panzoomchange` event.

- [x] **F11 — GitHub repo file browser**: Entering a bare GitHub repo URL (`https://github.com/<owner>/<repo>`) into the URL input triggers a GitHub Search API call for all `.md` files in the repo. Results appear in a filterable modal. Clicking a file opens it as a new tab.

- [x] **F12 — Annotation mode**: "Annotate" toggle puts the viewer in annotation mode. Double-clicking any paragraph, heading, or list item opens a `prompt()` to enter a sticky note. Notes are saved to `localStorage` keyed by filename. Annotated elements show a small ✎ badge; clicking it pops an inline tooltip with the note text. Annotations persist across sessions.

- [x] **F14 — Custom CSS themes (web)**: Added `applyCustomCss(cssContent)` which injects/replaces a `<style id="custom-theme">` in the document head. The CSS variable architecture (`--bg-primary`, `--text-primary`, etc.) makes it trivial to override the entire look with ~10 variable redefinitions.

---

### Desktop App (Electron)

- [x] **F6 — Persistent session restore**: Uses `electron-store` (already a dependency). On quit: tab file paths are written to `session.tabs`. On next launch: files are re-opened in order after `did-finish-load`. Window dimensions are also persisted and restored.

- [x] **F7 — Recent files menu**: `File > Open Recent` submenu lists up to 15 recently-opened files by basename. Clicking re-opens the file. `File > Open Recent > Clear Recent Files` wipes the list. Menu rebuilds whenever the list changes.

- [x] **F9 — Global keyboard shortcut**: `Cmd/Ctrl+Shift+M` registered as a system-wide shortcut. Brings SpecDown to front (restoring from minimize) and opens the file picker. Unregistered on `will-quit`.

- [x] **F14 — Custom CSS themes (desktop)**: `Appearance > Load Custom CSS Theme...` opens a file picker for `.css` files. Content is read and sent to the renderer via `apply-custom-css` IPC. The CSS file path is saved in `electron-store`; the theme is restored on next launch. `Appearance > Clear Custom Theme` removes it.

- [x] **F8 — Native Print menu**: `File > Print...` sends `trigger-print` IPC to the renderer, which calls `window.print()`.

- [x] **F3 — Native Find menu**: `Edit > Find...` sends `trigger-search` IPC to the renderer, which opens the search bar.

---

### CI / Infrastructure

- [x] **F15 — Windows + Linux CI**: Extended `desktop.yml` to build on three platforms:
  - `macos-latest` → `.dmg`
  - `windows-latest` → NSIS `.exe` installer
  - `ubuntu-latest` → `.AppImage`

  All three upload to the same GitHub Release. Updated `package.json` build config with `win.target: nsis`, `linux.target: AppImage`. CI runs in parallel — no sequential dependency between platforms.

---

## Files Modified

| File | Change |
|---|---|
| `markdown-viewer/index.html` | New buttons (TOC, Split, Annotate, Print), search bar, content-body layout, TOC sidebar, split raw pane, repo browser modal, share toast, minimap elements |
| `markdown-viewer/app.js` | All 15 feature implementations + DOM wiring (~800 lines added) |
| `markdown-viewer/styles.css` | Styles for all new features (~400 lines added) |
| `markdown-viewer/vendor/languages/` | 16 new Highlight.js language bundles copied |
| `desktop/main.js` | electron-store session, recent files, global shortcut, custom CSS, print/search IPC, Windows/Linux menu items |
| `desktop/preload.js` | New IPC channels: `saveSession`, `onTriggerPrint`, `onTriggerSearch`, `onApplyCustomCss` |
| `package.json` | `win` + `linux` build targets; `desktop:build` no longer hardcoded to `--mac dmg` |
| `.github/workflows/desktop.yml` | Three parallel build jobs (macOS, Windows, Linux) |

---

## Tests

All 141 pre-existing tests pass unchanged. New features are integrated into the shared `app.js` in a way that falls back gracefully when DOM elements are absent (e.g. in test environments).

---

## Notes

- The GitHub repo file browser uses the GitHub Search API (unauthenticated, 10 req/min). For private repos or heavy use, a token would be needed.
- Annotation data is stored in `localStorage` under the key `specdown-annotations`. Clearing browser data clears annotations.
- The minimap renders via a hidden `<canvas>` using an SVG → Image → Canvas pipeline; it may be blank momentarily on very first open while the image loads.
- Windows NSIS build is unsigned; users may need to bypass SmartScreen on first launch (same situation as the current macOS unsigned DMG).
