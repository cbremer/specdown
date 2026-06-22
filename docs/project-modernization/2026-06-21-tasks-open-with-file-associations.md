# Tasks — "Open in SpecDown" / file associations (web + desktop + iOS)

**Date:** 2026-06-21
**Type:** tasks
**Roadmap item:** §4 of the [retrospective](2026-06-19-retrospective-handoff.md) —
"Open in SpecDown" from the OS share sheet / Open-With.

Lets a `.md`/`.markdown` file in another app be opened straight into SpecDown,
on all three surfaces. Each surface routes the opened file into the existing
single load path.

## Web (installed PWA)

- **`markdown-viewer/public/manifest.webmanifest`** — added `file_handlers`
  declaring `text/markdown` → `.md`/`.markdown`, `action: "./"`. This is what
  makes an installed PWA an "Open with" target on Chromium desktop.
- **`markdown-viewer/src/features/pwa.js`** — `registerFileHandlerLaunchConsumer(onFile)`
  uses the File Handling API (`window.launchQueue.setConsumer`) to receive the
  launched file handle(s), resolve each to a `File`, and hand it to `onFile`.
  Web-only + capability-gated (same guards as the service worker).
- **`markdown-viewer/src/main.js`** — wires the consumer to the existing
  `handleFile`, so a launched file opens in a tab like any drag/drop/browse.

## Desktop (Electron / macOS)

- **`package.json`** — added electron-builder `fileAssociations` for `md` +
  `markdown` (role Viewer, `text/markdown`). On macOS this generates the
  `CFBundleDocumentTypes` so double-click / "Open With → SpecDown" works; the
  existing `app.on('open-file')` handler in `desktop/main.js` already delivers
  the file to the renderer.

## iOS / iPadOS

- **`ios/project.yml`** — declared `CFBundleDocumentTypes` (Viewer, rank
  Alternate) + an imported `net.daringfireball.markdown` UTI (extensions
  md/markdown, mime text/markdown) + `LSSupportsOpeningDocumentsInPlace`, so
  SpecDown appears in the share sheet / "Open With…" and can open files in place
  from the Files app.
- **`ios/SpecDown/WebBridge.swift`** — extracted the document picker's read
  logic into a reusable `openDocument(at:)` (security-scoped read → `loadFile`).
- **`ios/SpecDown/ContentView.swift`** — `.onOpenURL { bridge.openDocument(at:) }`
  handles externally-opened URLs.

## Tests / gates

- Added 4 unit tests (launchQueue consumer no-op / forwarding / empty-launch;
  manifest `file_handlers` shape). `npm test` → **452 pass**.
- `lint` 0 errors, `typecheck` clean, `build` succeeds.

## Verification gaps (need a human/device)

- **PWA**: requires installing the PWA and an OS "Open with" — `launchQueue` is
  Chromium-desktop only (no Safari/Firefox). Logic is unit-tested.
- **Desktop**: file association registration is verifiable only from a packaged
  install (double-click / Open With).
- **iOS**: the share-sheet / open-in-place flow needs a device build; CI's
  simulator build confirms the Swift compiles but not the runtime open.
