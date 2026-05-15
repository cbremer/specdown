# Session 02 — iPadOS Adaptive Shell

**Goal:** Add an iPad-friendly native shell on top of the existing iOS app without rewriting the shared viewer.

**Date:** 2026-05-15

---

## Checklist

### 1. Planning / Spec

- [x] Update the working plan for iPadOS scope
- [x] Write a new `project-ios` spec revision for the adaptive iPad shell
- [x] Update the project timeline and status docs

### 2. Native Shell

- [x] Detect regular-width iPad layouts in `ContentView.swift`
- [x] Use `NavigationSplitView` for iPad regular-width presentation
- [x] Keep the existing full-screen viewer path for iPhone / compact layouts
- [x] Expose native sidebar actions for file open and bundled samples
- [x] Surface recent file names in the iPad sidebar

### 3. Bridge / Shared Viewer

- [x] Add a Swift → JS layout-mode call for `phone` vs `pad`
- [x] Hide the bottom iPhone action bar in iPad mode
- [x] Restore the shared viewer's content-header actions in iPad mode
- [x] Preserve existing iPhone behavior and current JS bridge flows

### 4. Validation

- [x] Run the repo Jest suite
- [x] Regenerate the Xcode project
- [x] Run the simulator build via `xcodebuild`

---

## Definition of Done

The app presents a native split layout on iPad regular-width layouts, preserves the current iPhone shell, and still builds/tests cleanly.
