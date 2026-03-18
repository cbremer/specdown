# Session 01 — iOS Project Setup

**Goal:** Create the Xcode project and get the existing `markdown-viewer/` rendering correctly in a WKWebView on iOS simulator. No file picking yet — just confirm the web layer works on iOS before building native features.

**Date:** 2026-03-16
**Branch:** `claude/<short-description>-<session-id>`

---

## Checklist

### 1. Xcode Project

- [ ] Create `ios/` directory in repo root
- [ ] Create new Xcode project: **SpecDown**, targeting iOS 16+, SwiftUI lifecycle, Swift language, universal (iPhone + iPad)
- [ ] Save project as `ios/SpecDown.xcodeproj`
- [ ] Remove template boilerplate (delete `ContentView` default content, `Item` model if generated)
- [ ] Set bundle identifier: `com.cbremer.specdown` (or confirm correct one)
- [ ] Set display name: `Specdown`

### 2. Bundle the Web Assets

- [ ] Add `markdown-viewer/` directory to the Xcode project as a folder reference (blue folder icon, not yellow group)
  - This preserves directory structure and makes files accessible via `Bundle.main.url(forResource:)`
- [ ] Verify all assets are included in the app bundle target (index.html, app.js, styles.css, vendor files)
- [ ] Confirm `markdown-viewer/index.html` is reachable at runtime

### 3. WKWebView Integration

- [ ] Create `WebView.swift` — a `UIViewRepresentable` that wraps `WKWebView`
- [ ] Load `markdown-viewer/index.html` using `webView.loadFileURL(_:allowingReadAccessTo:)` with read access to the entire `markdown-viewer/` bundle directory (needed so relative JS/CSS paths resolve)
- [ ] Set `webView.scrollView.contentInsetAdjustmentBehavior = .never` (prevents double safe-area padding)
- [ ] Disable `webView.scrollView.bounces` on the outer scroll (optional — prevents the rubbery web feel on iOS)
- [ ] Create `ContentView.swift` — SwiftUI view embedding `WebView` full-screen

### 4. JS ↔ Swift Bridge (skeleton)

- [ ] Create `WebBridge.swift` — implements `WKScriptMessageHandler`
- [ ] Register message handler `"specdown"` on `WKWebView.configuration.userContentController`
- [ ] Inject `window.iosAPI = true` via `WKUserScript` at document start (so `app.js` can detect iOS context)
- [ ] Log incoming JS messages to console (no handling yet — just confirm the channel works)

### 5. System Appearance (Light/Dark)

- [ ] Create `AppearanceObserver.swift` — observes `UITraitCollection.userInterfaceStyle`
- [ ] On launch: evaluate JS to set initial theme (`dark` or `light`) matching system
- [ ] On change: re-evaluate JS when system appearance changes (use `onChange(of: colorScheme)` in SwiftUI)
- [ ] JS call: `window.setTheme('dark')` or `window.setTheme('light')` — confirm `app.js` exposes this or add it

### 6. Touch Target CSS Override

- [ ] Inject a `WKUserScript` that adds a `<style>` block setting `.btn { min-height: 44px; }` for all toolbar buttons
- [ ] Verify buttons are tappable at comfortable size on iPhone simulator

### 7. Simulator Validation

- [ ] App launches on iPhone 15 simulator (iOS 17) without errors
- [ ] App launches on iPad Pro 13" simulator (iOS 17) without errors
- [ ] Markdown renders — load a hardcoded test `.md` file embedded in the bundle
- [ ] Mermaid diagram renders — confirm a flowchart or sequence diagram appears
- [ ] Pinch-to-zoom on a diagram — does Panzoom respond to touch events? Document result
- [ ] Syntax highlighting renders for a code block
- [ ] Light/dark toggle follows simulator appearance setting

### 8. CI Workflow

- [ ] Create `.github/workflows/ios.yml`
- [ ] Trigger: push to main, PRs
- [ ] Runner: `macos-latest`
- [ ] Steps:
  - `xcodebuild -project ios/SpecDown.xcodeproj -scheme SpecDown -destination 'platform=iOS Simulator,name=iPhone 15' build`
  - No code signing required for a build check (`CODE_SIGNING_ALLOWED=NO`)
- [ ] Confirm workflow passes on CI

### 9. Documentation

- [ ] Update `docs/project-ios/README.md` timeline table with this session
- [ ] Note Panzoom touch validation result in open questions section of spec

---

## What's NOT in This Session

- File picker (`UIDocumentPickerViewController`) — Session 2
- Share Sheet target — Session 2
- Recent files — Session 3
- iPad sidebar — Session 4
- TestFlight upload — after code signing is configured (separate task)

---

## Definition of Done

All simulator validation checks pass. CI workflow builds successfully. A hardcoded markdown file with a Mermaid diagram renders correctly on both iPhone and iPad simulator, with the theme matching system appearance.
