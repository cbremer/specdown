# Brainstorm / Spike: Electron vs. Tauri for the SpecDown Desktop Shell

**Date:** 2026-06-15
**Type:** brainstorm (framework comparison / pre-decision spike)
**Phase:** 3 — distribution

**TL;DR — recommendation:** **Stay on Electron for now.** The headline Phase 3
problem (the macOS "damaged"/Gatekeeper error) is already solved by
signing+notarization, which removes the main reason we'd reach for a rewrite.
Tauri's real wins (tiny bundles, lower memory) are nice-to-haves here, not pain
points, and the migration cost is dominated by a **three-engine WebView risk**
that this Mermaid-heavy, `unsafe-eval`-dependent app is unusually exposed to.
Keep the **`window.specdown` bridge** small and documented (it already is) so a
future port stays a weekend-sized shell swap rather than an app rewrite, and
**revisit Tauri only if** a concrete trigger fires (see §7).

---

## 1. Why this spike

The modernization roadmap listed an "Electron-vs-Tauri spike" under Phase 3.
The motivating worry was the desktop distribution headache (unsigned arm64 DMGs
getting quarantined as "damaged"). Now that the signing/notarization pipeline is
in place, this spike re-frames the question honestly: *is there still a reason to
switch?* and *if we ever did, what would it actually cost?*

This is a decision document, not a plan to migrate. No code changes.

## 2. What the desktop shell actually does today

The Electron shell is small and well-contained — that's good news for any future
port, and it's the concrete checklist a Tauri version would have to satisfy.

**Process/runtime (`desktop/main.js`, ~770 lines):**
- Loads the shared Vite build (`markdown-viewer/dist/index.html`) in a
  `BrowserWindow`.
- **File watching** via `chokidar` — watches the *parent directory* (not the
  file) to survive editors' atomic-save rename dance, shares one watcher per
  directory, and has a `SPECDOWN_WATCH_POLLING` escape hatch for network mounts.
- **Native menus** (`Menu.buildFromTemplate`): Open, Open Folder, Open Recent,
  Close Tab, Print, Find, custom-CSS theme, log-file diagnostics.
- **Dialogs**: file open (multi-select) and directory open (workspace mode).
- **Workspace scan**: recursive markdown walk with depth/count caps + ignore list.
- **OS integration**: `app.addRecentDocument`, `shell.openExternal` /
  `openPath` / `showItemInFolder`, `globalShortcut` (Cmd+Shift+M), the macOS
  `open-file` event (Finder double-click / drag-to-dock).
- **Security**: `will-navigate` + `setWindowOpenHandler` keep the main frame on
  `file:` and route external links to the system browser.
- **Persistence**: a tiny hand-rolled atomic-write JSON store in `userData`
  (recent files, window bounds, session tabs, custom-CSS path) — deliberately
  *no* native dependency.
- **Logging** to a user-accessible file for packaged-build debugging.

**Bridge (`desktop/preload.js`, `contextBridge`):** the renderer's *entire*
contract with the shell is **15 methods on `window.specdown`**, typed in
`markdown-viewer/src/types/globals.d.ts`:

```
isDesktop, requestFileOpen, requestOpenPath, requestOpenFolder,
requestOpenRelative, onWorkspaceOpened, onFileOpened, onCloseTab,
watchFile, unwatchFile, onFileChanged, saveSession,
onTriggerPrint, onTriggerSearch, onApplyCustomCss
```

**Build (`electron-builder`):** DMG (signed+notarized), NSIS `.exe`, Linux
AppImage, wired into `.github/workflows/desktop.yml`.

**Dependencies that are Node/Electron-specific:** `electron`, `electron-builder`,
`chokidar`. Everything else (marked, mermaid, panzoom, highlight.js, DOMPurify)
is renderer code shared with the web and iOS surfaces and is **engine-agnostic in
principle** — the caveat is §5.

## 3. The honest comparison

| Dimension | Electron (today) | Tauri 2.x (hypothetical) |
|---|---|---|
| **Renderer engine** | Bundled Chromium — identical on every OS | **System WebView**: WKWebView (macOS), WebView2/Chromium (Windows), WebKitGTK (Linux) |
| **Shell language** | JavaScript (Node) | Rust (+ JS API on the front end) |
| **Installer size** | ~80–110 MB (bundles Chromium + Node) | ~3–10 MB (no engine bundled) |
| **Idle memory** | Higher (full Chromium per app) | Lower (shares the OS WebView) |
| **File watching** | `chokidar` (mature, our atomic-save logic already tuned) | `tauri-plugin-fs`/`notify` — re-implement the parent-dir + polling logic in Rust |
| **Native menus / dialogs / tray** | First-class, already built | First-class in Tauri 2 (menu API stabilized) — re-author in Rust |
| **macOS signing/notarization** | ✅ done (this phase) | Supported, but **re-do** the electron-builder→Tauri bundler wiring |
| **Auto-update** | `electron-updater` (not yet wired) | `tauri-plugin-updater` (not yet wired) — roughly equal effort either way |
| **Mobile** | No (separate native iOS shell) | Tauri 2 targets iOS/Android — *potential* future unification with our WKWebView iOS shell |
| **Ecosystem / hiring** | Huge, JS-native, AI-assistants fluent | Smaller; Rust raises the bar for a solo + AI-assisted project |
| **Security posture** | Good (contextIsolation, no nodeIntegration, CSP) | Good-to-better (Rust core, capability allowlist) — but we already have a tight surface |

## 4. Migration cost, component by component

If we *did* port (estimates assume AI-assisted, solo developer):

- **Bridge shim — small.** Re-expose the same 15 `window.specdown` methods over
  `@tauri-apps/api` `invoke`/`event`. Because the renderer only knows the bridge
  (not Electron), the app code barely changes. This is the cheap part and the
  reason the seam matters.
- **File watching — medium.** Re-implement the parent-directory watch, the
  atomic-save `add`-after-rename handling, the per-directory sharing, and the
  polling fallback on top of `notify`/`tauri-plugin-fs`. This is the subtlest
  existing logic and the easiest to regress.
- **Menus + dialogs + OS integration — medium.** Rewrite menu construction,
  open-file/open-directory dialogs, recent-documents, `open-external`,
  `show-in-folder`, global shortcut, and the macOS file-open event in Rust.
- **Persistence + logging — small.** The JSON store and log file are trivial in
  Rust (or via `tauri-plugin-store`).
- **Build/CI/signing — medium.** New bundler config, re-wire the three
  release lanes, re-apply the signing/notarization secrets (the *certs* carry
  over; the *wiring* does not). Add a Rust toolchain to CI.
- **Cross-engine QA — large and recurring (see §5).**

**Net:** the shell port is "a few focused days" of mostly-mechanical work. The
risk and the ongoing tax both live in QA, not in the port.

## 5. The real risk: three WebView engines instead of one

This is the crux, and it's worse for *this* app than for a typical Tauri
candidate:

- SpecDown renders **Mermaid** (which needs **`script-src 'unsafe-eval'`**),
  **Panzoom**, **highlight.js**, **DOMPurify**, SVG `foreignObject` handling, and
  a non-trivial ES-module bundle. Today all three OSes run the *same* Chromium,
  so "works on my machine" generalizes.
- Under Tauri the same bundle runs on **WKWebView**, **WebView2 (Chromium)**, and
  **WebKitGTK**. WebView2 ≈ Chromium (low risk). WKWebView we *partly* de-risk
  because the **iOS** surface already runs WebKit — but macOS WKWebView ≠ iOS
  WKWebView in every detail. **WebKitGTK on Linux is the wildcard**: version
  skew across distros, historically weaker/slower on heavy SVG + JS, and the
  most likely place Mermaid or panzoom subtly breaks.
- We'd be trading a **one-engine** support matrix for a **three-engine** one,
  permanently — every Mermaid upgrade, every CSS feature, every `unsafe-eval`
  assumption now needs checking three ways. For a markdown+diagram viewer whose
  whole value is faithful rendering, that's the expensive part, and it never goes
  away.

## 6. Recommendation

**Stay on Electron.** Rationale:

1. **The pain that justified the spike is gone.** Signing/notarization fixed the
   distribution blocker; bundle size and memory are not user complaints for a
   developer-tool markdown viewer.
2. **The cost is concentrated in exactly our weak spot** — faithful rendering of
   Mermaid/SVG across three engines — not in the (cheap) shell port.
3. **Chromium-everywhere is a feature** for a rendering-fidelity app run by a
   solo maintainer.

But treat portability as a first-class architectural property *now*, cheaply:

- **Keep the `window.specdown` bridge as the only shell coupling.** It already
  is — 15 methods, fully typed in `globals.d.ts`. Resist letting renderer code
  reach for Electron APIs directly. This single discipline is what keeps a future
  swap a shell rewrite, not an app rewrite.
- When we add desktop features (auto-update, deep-links, etc.), add them *as
  bridge methods*, so the contract — not the implementation — is what the app
  depends on.

## 7. Triggers to revisit (when switching would pay off)

Re-open this decision if any of these become true:

- **Mobile unification:** we want one codebase for iOS/Android *and* desktop —
  Tauri 2's mobile support could retire the separate native iOS shell. This is
  the most plausible future reason.
- **Bundle/memory becomes a real complaint** from actual users (e.g. distribution
  size or RAM on low-end machines) rather than a theoretical concern.
- **Electron maintenance burden spikes** (Chromium CVE churn, breaking major
  upgrades) past the cost of a Rust shell.
- **We drop or de-risk the heavy renderer assumptions** (e.g. Mermaid stops
  needing `unsafe-eval`, or we pre-render diagrams), which would shrink the
  three-engine QA tax that dominates the con column.

## 8. Optional follow-up (not scheduled)

If we want to *prove* the seam rather than just assert it, a future timeboxed
(~1 day) experiment could stand up a throwaway Tauri shell that implements just
`requestFileOpen` + `onFileOpened` and loads `dist/`, then smoke-tests a
Mermaid-heavy doc on macOS and Linux. That would convert the §5 risk from
"asserted" to "measured" before any real commitment. Explicitly **out of scope**
for now.
