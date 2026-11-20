# SpecDown

Read the specs, plans and diagrams your AI workflow produces. SpecDown gives
your Markdown a clean reading view, with formatted tables, highlighted code and
**interactive Mermaid diagrams** right in the document. Read technical specs,
design docs, READMEs and notes with clean typography, and zoom, pan or expand
diagrams for a closer look.

SpecDown has four app platforms: **Mac desktop (direct download), Mac App Store, iPadOS, and iOS**. They share a viewer that is also available on the web and in Windows and Linux desktop downloads.

- 🌐 **Web** — runs on GitHub Pages, installable as a PWA
- 🖥️ **Desktop downloads** — Electron app, signed & notarized on macOS
- 🍎 **Mac App Store** — [available free for Mac](https://apps.apple.com/app/specdown/id6822086808?mt=12), with updates delivered by Apple
- 📱 **iOS / iPadOS** — [free on the App Store](https://apps.apple.com/app/specdown/id6822086808)

---

## App names, build channels and versions

Choose the platform first, then **Dev** for local development, **Beta** for tester distribution, or **Prod** for public distribution. The app names below are the ones to look for in Finder or on the device.

**Beta means delivery through TestFlight** for iPhone, iPad and the Mac App Store edition. iPhone and iPad share one upload. The Mac App Store edition has a separate macOS upload. Testers install the build in TestFlight once it is available to their group. The direct-download Mac edition uses a separate Beta package installed on the Mac.

| App platform | Dev | Beta | Prod |
| --- | --- | --- | --- |
| Mac desktop (direct download) | **SpecDown Dev** | **SpecDown Desktop Beta**, local test package | **Specdown Desktop**, delivered through GitHub Releases |
| Mac App Store | **SpecDown Store Dev**, locally signed and installed | **SpecDown Store Beta**, separate TestFlight identity | **SpecDown**, delivered through the Mac App Store |
| iPadOS | **SpecDown Dev** on iPad | **SpecDown Beta** on iPad | **SpecDown** on iPad |
| iOS | **SpecDown Dev** on iPhone | **SpecDown Beta** on iPhone | **SpecDown** on iPhone |

### Build and install locations

| Platform | Where it is built | Where to run it |
| --- | --- | --- |
| Mac desktop | Dev uses `electron-builder.dev.js` and produces `dist/development-edit-save/mac-arm64/SpecDown Dev.app`. Beta uses `electron-builder.beta.js` → `dist/direct-beta/`. Prod uses `package.json` and writes installers in `dist/`. | Launch the exact Dev bundle, or install the Prod app from its DMG into `/Applications/Specdown Desktop.app`. |
| Mac App Store | Dev uses `electron-builder.mas-dev-channel.js` → `dist-mas/development/`. Beta uses `electron-builder.mas-beta.js` → `dist-mas/beta/`. Prod uses `electron-builder.mas.js` → `dist-mas/`. | The local Dev installation is `~/Applications/SpecDown Store Dev.app`. TestFlight installs Beta. The Mac App Store installs Prod. |
| iPadOS | In `ios/SpecDown.xcodeproj`, select the Dev, Beta or Prod scheme from the table above and an iPad destination. | Install Dev on a paired iPad. Install Beta through TestFlight and Prod through the App Store. Verify iPad layout and file picking on iPad. |
| iOS | In the same Xcode project, select the matching scheme and an iPhone destination. | Install Dev on a paired iPhone. Install Beta through TestFlight and Prod through the App Store. Verify iPhone layout and file picking on iPhone. |

iPadOS and iOS share the Swift target and a device binary supporting both families. A simulator build is a separate product. Xcode writes these under the chosen DerivedData directory in `Build/Products/<configuration>-iphoneos/` or `<configuration>-iphonesimulator/`. The [iOS build guide](ios/README.md#development-channels) lists the run and archive configurations.

For this branch, `scripts/build-edit-save-dev.sh` builds direct Mac Dev and the mobile Dev simulator app. To build **Mac App Store Dev** for an Apple Silicon Mac with the existing matching development signing identity and `SPECDOWN_MAS_DEV_CHANNEL_PROFILE` set:

```sh
npm run build
node scripts/build-mas-native.js
npx --no-install electron-builder --config electron-builder.mas-dev-channel.js --mac mas-dev --arm64 --publish never
```

This produces `dist-mas/development/mas-dev-arm64/SpecDown Store Dev.app`. Set the intended Apple version and build explicitly when refreshing a numbered Dev build, e.g. append `-c.extraMetadata.version=1.0.4 -c.buildVersion=251`. The similarly named `npm run desktop:mas-dev` uses development signing with the **Prod** Store identity.

### How to identify your copy

The direct Mac app uses the npm version in `package.json` and can reuse the same version for local builds. Its Dev ID is `com.specdown.desktop.dev`, its Beta ID is `com.specdown.desktop.beta` and its Prod ID is `com.specdown.desktop`. Mac App Store, iPadOS and iOS use `com.mosaicpando.specdown.dev` (Dev), `com.mosaicpando.specdown.beta` (Beta) and `com.mosaicpando.specdown` (Prod). Their About screens report a marketing version and a build number. For example, **Mac App Store · Dev · 1.0.4 (252)** identifies a specific platform and channel.

On Mac, Command-click a running app’s Dock icon to reveal that exact copy in Finder. Open its `Contents/Info.plist` to check `CFBundleIdentifier`, `CFBundleShortVersionString` and `CFBundleVersion`. On iPhone or iPad, open About on the specific device. A build on disk, a build installed on a device and a build available to testers are separate facts.

**Document-import Dev builds verified November 18, 2026.** The direct Mac Dev package reports **0.0.234**. Mac App Store Dev **1.0.4 (252)** was installed on Mac and verified through its sandboxed Save panel. iOS Dev **1.0.4 (251)** was installed on iPhone. Physical iPadOS installation and OCR acceptance are open. These are local Dev checkpoints. [iOS and direct Mac OCR results](docs/project-document-import/2026-11-18-tasks-session-07-pdf-ocr-dev.md) · [Mac App Store Dev results](docs/project-document-import/2026-11-18-tasks-session-08-mac-store-dev.md)

**Design.** Every surface (web, desktop, Mac App Store, iPhone and iPad) uses the C+ brand moments design: a brand bar that fills as you read, read ticks in Contents, a quieter toolbar, a brand drop moment and About, and the SpecDown diagram style on the bundled samples. [Spec](docs/project-design-system/2026-11-19-spec-brand-moments-cplus.md)

### Standard home for retained builds

Open **`~/Builds/SpecDown`** in Finder to find a completed local build from any worktree. Pick the platform, then the channel. Each build folder contains the runnable app or archive, its matching packaging outputs, and a `manifest.json`. For example, the Mac App Store Dev builds are in `~/Builds/SpecDown/mac-store/dev/`.

| Platform folder | Contents |
| --- | --- |
| `mac-direct/` | Direct-download Mac apps and installers |
| `mac-store/` | Sandboxed Mac App Store apps and installer packages |
| `ios/` | iPhone device builds, simulator builds and Xcode archives |
| `ipados/` | iPad builds. A relative link points to the same retained package when it supports both device families. |

Channel folders are `dev/`, `beta/` and `prod/`. They are created as builds arrive. The app's bundle identifier determines its channel. The folder name includes the version, build number, source revision, product kind, architecture and a checksum prefix. This distinguishes simulator from device even when both are arm64. Matching repeats reuse a verified record. Different package bytes get a separate record. The manifest gives the full SHA-256 for each product, using a tree checksum for directory bundles.

**Building locally**

- **Mac desktop and Mac App Store.** The existing electron-builder commands above automatically retain the completed local Mac app and matching installer artifacts after packaging. Worktrees keep their normal scratch outputs in `dist/` or `dist-mas/`. Hosted CI keeps its workflow artifact handling.
- **iPadOS and iOS.** Run `scripts/build-mobile.sh <dev|beta|prod> <device|simulator|archive>`. For example, `scripts/build-mobile.sh dev device MARKETING_VERSION=1.0.4 CURRENT_PROJECT_VERSION=251` builds, signs and retains a device app using the existing Xcode configuration. The `archive` option retains the entire `.xcarchive`, including available dSYMs. The combined `scripts/build-edit-save-dev.sh` command retains both direct Mac Dev and the mobile Dev simulator app.
- **An existing build, including one made in Xcode.** Run `python3 scripts/retain-build.py --revision <build-commit> "/path/to/SpecDown.app"` or pass an `.xcarchive`. Add `--extra "/path/to/file"` for a corresponding installer, exported IPA or verified symbols. Use `--revision unknown` when the original revision is unavailable. Build scripts record the checkout revision and whether it had uncommitted changes.
- **Installation and backup.** Run or install the retained copy separately. Keep normal records of the devices tested. Include this folder in backups, especially distributed archives and symbols. [Apple archive guidance](https://developer.apple.com/documentation/xcode/building-your-app-to-include-debugging-information)

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
- **Notes (web and desktop)** — double-click a document block to attach a note.
  Collections follow the accepted source; unrelated same-name files do not share
  notes. A new browser file selection requires explicit reconnect to an existing
  collection. Native iOS does not expose annotation tools.
- **Unassigned notes and recovery** (command palette) — preserve legacy notes,
  preview selected occurrences, explicitly associate or reconnect a collection,
  and undo while keeping newer edits. Private `.sdr` backups preserve raw data;
  portable JSON exchange is separately labeled and deliberately redacted/lossy.
  Restore never grants file access. Keep the original backup and reselect the
  saved file to verify it; unsupported capacity fails without truncation.

### Interactive Mermaid diagrams
- Per-diagram **zoom, pan, reset, and fullscreen** controls
- **Mouse-wheel zoom** and **click-drag pan** with a pointer; touch controls on iOS
- **SVG / PNG diagram files** on web and desktop; the iOS 1.0.2 candidate adds
  native **Save to Files / Share**. Fullscreen keeps the minimap on web/desktop.
  There is no hosted diagram-link sharing.
- **Presentation mode** — step through a document's diagrams full-screen
- Diagrams re-theme automatically with light/dark

### Getting documents in

**Word, PDF and quick edits.** In the upcoming iPhone, iPad and Mac App Store release, choose **Open File** to open a Word document (`.docx`) or a PDF. SpecDown converts the text to Markdown on your device. For PDF pages with little selectable text, it tries English text recognition (OCR) and flags pages that still need attention. Choose **Edit** to correct the text or add a heading, then save a separate `.md` file. Your original Word document or PDF stays intact. You can also edit and save writable Markdown files directly.

These imports are also available in both Mac Dev and Beta editions and the mobile Dev and Beta apps. [Upcoming Store release notes and screenshots](app-store/release-assets/1.0.5-257/)

Microsoft MarkItDown successfully converted a sample Word document and a text PDF in an earlier offline Python experiment. Its use was limited to that evaluation. [MarkItDown experiment and results](docs/project-document-import/2026-11-18-spec-edit-save-dev-acceptance.md#markitdown-experiment)

- **Drag & drop** or **browse** for `.md` / `.markdown` files on web and desktop;
  use **Files**, **iCloud Drive** or a compatible app on iPhone and iPad
- **Open from URL** using a public HTTPS link to a Markdown file. Links requiring
  sign-in or blocked by the host may not open; download the file and open it locally
- **Bookmarks** — save frequently used files with **Bookmark** (`Cmd/Ctrl + D`), then recall them from the header’s **Bookmarks** list. Search, rename, remove, or **Locate file** when a desktop file moves. Desktop files and URLs reopen their current source; browser/iOS files without a reusable path retain a clearly labeled **saved copy**, with **Replace copy** to choose a new revision or a different document explicitly. Bookmarks stay separate from recents and are stored on this device (clearing app/browser data removes them).
- **Recent files** — web/desktop reopening and, in the iOS 1.0.2 candidate,
  accepted Files documents retained through provider bookmarks with Retry/Locate
  recovery. A new picker selection stays distinct; a filename never grants access.
- **Local images on iOS 1.0.2** — choose **Allow Local Images…** and explicitly
  select the containing folder. Permission belongs to the current document view;
  raster images are bounded and traversal/symlink escapes are refused.
- **Public GitHub repositories** — paste a repository or `/tree/<branch>/<folder>`
  URL to choose a Markdown file without signing in. Listing limits and unavailable
  or rate-limited repositories show guidance; private repositories are unsupported.
- **Desktop session restore** keeps supported prior tabs when permissions remain
  usable. On the web, choose **Open Recent** explicitly to reopen history entries.
  Source identity does not grant file access.
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
- **Native icon choices** — eight approved artworks including Light; selections
  persist. Desktop choices affect the running Dock/window, while Finder and
  installed shortcuts keep their shipped artwork. Channel defaults remain distinct.
- **Keyboard shortcut sheet** (`?`)
- Auto / light / dark theme that follows your OS, plus reduced-motion support
- Starfield is the initial visual theme on every platform. Choose Basic, Aurora
  or Blueprint instead; your selection is remembered.
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

### Mac App Store

SpecDown is available free on the
**[Mac App Store](https://apps.apple.com/app/specdown/id6822086808?mt=12)**.
The sandboxed edition uses system file pickers to grant access to documents and
folders. Apple delivers its updates through the App Store. The direct desktop
download remains available through GitHub Releases. See the
[App Store release records](docs/project-appstore/README.md) for version status.

### iOS / iPadOS
SpecDown is available free for iPhone and iPad on the
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
