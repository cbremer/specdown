# Session 47: remove the unsupported diagram link action

Chris identified the diagram toolbar's link button as a release blocker before App Store submission. This isolated change starts at `bb59e16850c9a6394c332ce907ef1997d625d732` and retains iOS/MAS 1.0.1 (229), with shared source version 0.0.229.

## Result and scope

The shared fullscreen diagram toolbar no longer offers **Copy shareable link** beside SVG and PNG. The old action encoded the diagram into a URL using the current page origin/path; the native application does not provide a supported share destination for that URL.

The removal includes the button, its fullscreen import/clone/listener, the now-unused outgoing URL/clipboard helper, and its dedicated success-toast markup and CSS. The print selector and iOS hiding rule no longer reference that removed control. No whole-file CSS or render-path reformat was performed.

Inline diagrams already offer only Expand. Presentation already has navigation, zoom and Close controls. Neither needed a production change. PNG/SVG exporters and their fullscreen handlers remain unchanged; their existing iOS visibility policy is preserved. Incoming bounded `?diagram=` links still open as before. Ordinary document links, code copying, native sharing, diagram geometry, focus, cleanup, native source, signing settings, dependencies and version metadata are unchanged.

## Verification

- Negative control against exact `bb59e16`: the new six-case suite reports **three expected failures** because the old button is present on web, desktop and iOS, with **three passing controls** for SVG/PNG export dispatch and presentation controls.
- Fixed focused checks: **96 tests in six suites pass**, covering all three surfaces, fullscreen close/reopen, retained export dispatch, incoming links, diagram exports, Mermaid processing, presentation and iOS visibility.
- Full CI/coverage gate: **1,292 tests in 74 suites pass**. The count reflects removing obsolete tests for the deleted outgoing helper while retaining incoming-link tests and adding six toolbar regressions.
- Lint and typecheck pass. The production web build passes; its existing large-chunk advisory is informational.
- Independent read-only review and 157 tests across nine relevant suites pass, including fullscreen focus/centering and real export implementations. Final byte-bound review evidence is retained beside the author logs.

Evidence is in canonical `ios/DerivedData/remove-diagram-link-20261101/`: `baseline-negative.log`, `focused.log`, `full-tests.log`, `lint.log`, `typecheck.log`, `build.log` and `candidate-manifest.json`.

This is source and web-build proof. The parent task must integrate this exact change and rebuild/reverify the native 229 artifacts before screenshots, upload or acceptance. The earlier `bb59e16` archive is historical evidence and cannot demonstrate this removal. No signing, UI, native build, install, upload, App Review submission or public release occurred in this worktree.
