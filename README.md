# SpecDown

Read the specs, plans and diagrams your AI workflow produces. SpecDown gives
your Markdown a clean reading view, with formatted tables, highlighted code and
**interactive Mermaid diagrams** right in the document. Read technical specs,
design docs, READMEs and notes with clean typography, and zoom, pan or expand
diagrams for a closer look.

One shared viewer runs in the **browser**, as a **desktop app** (macOS / Windows /
Linux), and as an **iOS / iPadOS** app.

- 🌐 **Web** — runs on GitHub Pages, installable as a PWA
- 🖥️ **Desktop downloads** — Electron app, signed & notarized on macOS
- 📱 **iOS / iPadOS** — [free on the App Store](https://apps.apple.com/app/specdown/id6822086808)

---

## Features

### Markdown
- GitHub Flavored Markdown features, including tables, task lists and blockquotes
- Syntax highlighting for code blocks, with a hover **Copy** button
- Clean, readable typography in light and dark themes
- **Raw / preview toggle** and a side-by-side **split view**
- **Table of contents** sidebar with scroll-spy
- **Find in document** (`Cmd/Ctrl + F`)
- **Print / Save as PDF** (`Cmd/Ctrl + P`) — prints the full document as a clean,
  paginated layout (diagrams re-rendered light for paper); the desktop app also
  has **File > Export as PDF…** (`Cmd/Ctrl + Shift + E`) for one-step PDF files
- **Notes (web and desktop)** — double-click a document block to attach a note;
  export and import notes as JSON. Imports are limited to 2 MiB. Notes are saved
  in local app or browser storage; native iOS does not expose annotation tools

### Interactive Mermaid diagrams
- Per-diagram **zoom, pan, reset, and fullscreen** controls
- **Mouse-wheel zoom** and **click-drag pan** with a pointer; touch controls on iOS
- **Web and desktop:** minimap in fullscreen and diagram export as **SVG** or **PNG**
- **Presentation mode** — step through a document's diagrams full-screen
- Diagrams re-theme automatically with light/dark

### Getting documents in
- **Drag & drop** or **browse** for `.md` / `.markdown` files on web and desktop;
  use **Files**, **iCloud Drive** or a compatible app on iPhone and iPad
- **Open from URL** using a public HTTPS link to a Markdown file. Links requiring
  sign-in or blocked by the host may not open; download the file and open it locally
- **Bookmarks** — save frequently used files with **Bookmark** (`Cmd/Ctrl + D`), then recall them from the header’s **Bookmarks** list. Search, rename, remove, or **Locate file** when a desktop file moves. Desktop files and URLs reopen their current source; browser/iOS files without a reusable path retain a clearly labeled **saved copy**, with **Replace copy** to update it. Bookmarks stay separate from recents and are stored on this device (clearing app/browser data removes them).
- **Recent files (web and desktop)** for reopening documents; **session restore**
  reopens your last document on the web
- **Workspace (folder) mode (desktop and supported browsers)** — use **Open Folder**
  or drop a folder in a compatible browser, browse its Markdown in a sidebar, and
  follow relative `.md` links. **Close Folder** closes the folder browser
  while keeping open document tabs. **Workspace files** hides or shows the sidebar
  without closing the folder. Folder mode is unavailable in native iOS
- **Live reload** (desktop) — file-backed documents refresh automatically when
  they change on disk. The **Live** chip next to the filename shows the state
  (click to pause / resume); **Reload from disk** (⋮ menu or command palette)
  re-reads the file on demand

### Navigation & UX
- **Command palette** (`Cmd/Ctrl + K`) with fuzzy search for available commands
- **Keyboard shortcut sheet** (`?`)
- Auto / light / dark theme that follows your OS, plus reduced-motion support
- Accessible: skip link, ARIA roles, keyboard navigation

---

## Use it

### Web
The hosted app lives at **<https://specdown.mosaicpando.com>**. Open it, drop in a
Markdown file (or open one from a public HTTPS URL), and go. Use your browser's
**Install** option to add it as a PWA. Offline use depends on the app resources
your browser has saved; online documents and remote images still need a connection.

### Desktop downloads (macOS / Windows / Linux)
Download the latest installer from the **[Releases page](https://github.com/cbremer/specdown/releases)**:

| Platform | Artifact | Notes |
|---|---|---|
| macOS | `Specdown-Desktop-<version>-universal.dmg` | **Signed & notarized**; universal (Intel + Apple Silicon) |
| Windows | `Specdown-Desktop-Setup-<version>.exe` | NSIS installer |
| Linux | `Specdown-Desktop-<version>.AppImage` | mark executable, then run |

**Testing coverage:** Windows and Linux builds have received less testing than
macOS builds. Please [report platform-specific issues on GitHub](https://github.com/cbremer/specdown/issues).

On macOS, open the DMG, drag **Specdown Desktop** to Applications, and launch.
The direct-download macOS release uses Developer ID signing and Apple notarization.

The **Mac App Store edition is being prepared separately**. Its sandboxed build
uses system file access and Apple-delivered updates. It is a separate distribution
channel from the existing desktop download; a local build or TestFlight build is
not a public Mac App Store release. See the [App Store preparation docs](docs/project-appstore/README.md).

### iOS / iPadOS
SpecDown 1.0 is available free for iPhone and iPad on the
**[App Store](https://apps.apple.com/app/specdown/id6822086808)**. Requires iOS or
iPadOS 16.0 or later.

For development from a new checkout, build the shared viewer and generate the
Xcode project:

```bash
npm ci
npm run build                       # build the shared web bundle
brew install xcodegen               # one-time, if you don't have it
cd ios && xcodegen generate         # generate the Xcode project
open SpecDown.xcodeproj
# In Xcode: select SpecDown Dev, your device and your signing team, then Run (⌘R)
```

For an existing local setup, open this checkout's `ios/SpecDown.xcodeproj` and
preserve its signing settings. `ios/project.yml` is the tracked project source;
the generated Xcode project is ignored by Git.

Use **SpecDown Dev** for ordinary local development. **SpecDown Beta** has a
separate TestFlight identity. Both can coexist with production **SpecDown** and
keep separate app data. The production scheme uses the App Store identity, so
running it on a device can replace the installed production copy. Follow the
[development-channel contract](docs/project-appstore/2026-10-31-spec-ios-development-channels.md)
for identity and signing setup. Final release acceptance uses the exact
production-ID TestFlight build.

CI validates simulator builds on every change. The iOS release-validation
workflow also checks the Release configuration without signing in to Apple.
Device archives, uploads and Store submissions are separate release steps.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + D` | Bookmark the current file |
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + F` | Find in document (`Enter` / `Shift+Enter` next / previous match) |
| `Cmd/Ctrl + P` | Print / Save as PDF |
| `Cmd/Ctrl + Shift + E` | Export as PDF (desktop app) |
| `?` | Keyboard shortcut sheet |
| `← →` | Previous / next diagram (presentation mode) |
| `+` (or `=`) / `-` / `0` | Zoom in / out / fit (presentation & fullscreen) |
| Mouse wheel over a diagram | Zoom |
| Drag a diagram | Pan |
| `Esc` | Exit fullscreen / close overlays |

---

## Development

The viewer is a **Vite + ES-module** app. All three surfaces load the same build
output from `markdown-viewer/dist/`, so there's one codebase to work on.

**Requirements:** Node.js **22.22.0+** (see `engines` in `package.json`).

```bash
npm ci                 # install the committed dependency graph (runs postinstall)

npm run dev -- --host 127.0.0.1 # local-only Vite server — port 5179
npm run build          # production build → markdown-viewer/dist/
npm run preview        # serve the production build locally

npm run desktop        # build the web app, then launch Electron
npm run desktop:build  # build the web app + a desktop installer (in dist/)
```

### Quality checks
```bash
npm test               # Jest unit + integration suite
npm run lint           # ESLint (flat config) — must be clean
npm run typecheck      # tsc --noEmit (checkJs over JSDoc) — must be clean
npm run test:watchers  # real synthetic-file watcher checks for desktop validation
npm run format:check   # Prettier check; format only files you change
```

### Architecture
- **`markdown-viewer/`** — the shared web app. `src/main.js` is the entry/wiring hub;
  cohesive features live under `src/core/`, `src/features/`, and `src/platform/`.
  Heavy deps (Mermaid) are lazy-loaded; the code is type-checked with TypeScript's
  `checkJs` over JSDoc.
- **`desktop/`** — the Electron shell (`main.js` + `preload.js`). The renderer talks to
  it through a single typed bridge: `window.specdown` (see `markdown-viewer/src/platform/bridge.js`).
- **`ios/`** — the iOS/iPadOS Swift + WKWebView shell (an XcodeGen project).
- **`tests/`** — Jest suite (unit + integration).
- **`scripts/`** — version sync, static copy, changelog generation.

### Local development and privacy

Use the loopback-only development command above; the default Vite configuration
listens on all network interfaces. Serve the viewer through Vite or its built
directory rather than serving the repository root, which may contain ignored
private files. Review repository scripts before installing dependencies or
running commands from an unfamiliar checkout.

Local files are read on your device. Opening online documents or remote images
contacts their hosts; web and direct-download editions also check GitHub for
releases. Browser/app data, exported notes and diagnostics can contain document
text, URLs or local paths. Review them before sharing. See the
[privacy policy source](markdown-viewer/public/privacy.html),
[security guidance](SECURITY.md) and [documentation audit](docs/project-security/README.md).

### Releasing
Merges to `main` run the web quality gates and deploy the verified build to
GitHub Pages. The version workflow opens a separate patch-version PR; after
review and merge, it creates an immutable tag and a draft GitHub Release.

Desktop release builds are dispatched for an exact tag. Unsigned preview builds
produce downloadable workflow artifacts only. Signing and publication require a
protected `desktop-release` environment with independent approval. The release
becomes public after all platform artifacts are ready. Apple Store uploads and
submissions remain separate from web and direct-download releases.

Don't push version tags by hand — let the reviewed version workflow create them.

---

## Documentation

Project history, specs, and design docs live under **`docs/`** (start at
[`docs/README.md`](docs/README.md)):

- `docs/project-desktop/` — the Electron desktop project
- `docs/project-ios/` — the iOS/iPadOS shell
- `docs/project-appstore/` — Store release preparation and platform-specific proof
- `docs/project-url/` — URL opening / GitHub repo browsing
- `docs/project-modernization/` — the cross-platform modernization roadmap (the most
  recent and comprehensive)

---

## Tech stack

Bundled by Vite as ES modules (pinned in `package-lock.json`, no runtime CDN):

- **[Marked](https://marked.js.org)** — markdown parsing
- **[Mermaid](https://mermaid.js.org)** — diagram rendering
- **[@panzoom/panzoom](https://github.com/timmywil/panzoom)** — pan/zoom
- **[Highlight.js](https://highlightjs.org)** — code syntax highlighting
- **[DOMPurify](https://github.com/cure53/DOMPurify)** — HTML/SVG sanitization

Desktop packaging via **Electron** + **electron-builder**.

## License

MIT. Bundled libraries retain their own licenses (Marked, Mermaid, Panzoom — MIT;
Highlight.js — BSD-3-Clause; DOMPurify — Apache-2.0 / MPL-2.0).
