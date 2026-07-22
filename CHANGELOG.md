# Changelog

<!-- Released versions are prepended below automatically on each release by
     scripts/generate-changelog.js (wired into .github/workflows/version-bump.yml).
     Use Conventional-Commit subjects (feat:, fix:, docs: …) to get grouped
     sections; otherwise commits are listed as a flat bullet list. -->

## v0.0.171 — 2026-07-22

- render inline as static content, move interactivity to fullscreen

## v0.0.170 — 2026-07-19

- fix desktop Cmd+P showing no dialog — print from the visible window, not a hidden one

## v0.0.169 — 2026-07-18

- render one standalone printable document on every surface + desktop Export as PDF

## v0.0.168 — 2026-07-18

- make diagram-showcase the primary diagram sample
- add diagram-showcase.md — one of every Mermaid diagram type

## v0.0.167 — 2026-07-18

### Bug Fixes

- presentation mode presented the reset icon instead of the diagram

## v0.0.166 — 2026-07-18

### Bug Fixes

- route desktop drag-and-drop by absolute path (live reload for drops)

## v0.0.165 — 2026-07-15

### Documentation

- docs/tests: address Copilot review on #184 (stale comments, test reload hygiene)

### Tests

- desktop overflow variant runs in its own describe (single init per test)

## v0.0.164 — 2026-07-15

### CI

- file a macos-release-failure issue when the macOS release lane fails

### Other Changes

- live-reload chip beside the filename + manual Reload from disk

## v0.0.163 — 2026-07-15

### Bug Fixes

- space-free electron-builder artifact names so auto-update downloads work
- one dialog per failed update check + friendly still-packaging message

### Documentation

- session-27 record + hard-won update-pipeline gotchas in CLAUDE.md

## v0.0.162 — 2026-07-15

### Documentation

- document '=' as the shift-free zoom-in alternative
- address Copilot review nits from #181

## v0.0.161 — 2026-07-15

### Documentation

- sync AGENTS.md and README with current toolchain and features

## v0.0.160 — 2026-07-15

### Chores

- simplification pass — consolidate button CSS, drop dead code and deps

## v0.0.159 — 2026-07-14

### Bug Fixes

- resolve PR #178 review findings (CodeQL alert #10, repo-browser listener stacking)

## v0.0.158 — 2026-07-14

### Refactoring

- Wave C hygiene — render race fix, main.js split, zero warnings

### Documentation

- evaluation v2 — independent re-audit of the modernized app at v0.0.154

### Other Changes

- Wave B consolidation — icons, toolbar, dark theme, focus traps
- Wave A hardening — update integrity, release lanes, containment

## v0.0.157 — 2026-07-14

### Build System

- Bump marked from 18.0.5 to 18.0.6
- Bump marked from 18.0.5 to 18.0.6

## v0.0.156 — 2026-07-14

### Build System

- Bump the dev-dependencies group across 1 directory with 6 updates

## v0.0.155 — 2026-07-14

### Build System

- Bump mermaid from 11.15.0 to 11.16.0

## v0.0.154 — 2026-06-25

### Documentation

- expand iOS distribution setup (step-by-step + App Store)

### Other Changes

- Surface presentation mode on iPhone via the action sheet

## v0.0.153 — 2026-06-24

- Durable annotation anchoring (store schema v2)

## v0.0.152 — 2026-06-22

### Features

- Add visible desktop update UX: check + restart

### Other Changes

- Group the changelog from descriptive commit subjects

## v0.0.151 — 2026-06-22

- Open a folder dragged onto the web app as a workspace

## v0.0.150 — 2026-06-22

- Add "Open in SpecDown" / file associations (web + desktop + iOS)

## v0.0.149 — 2026-06-22

- Fix TS2882 from the TypeScript 6 bump on the CSS side-effect import
- Bump the dev-dependencies group across 1 directory with 4 updates

## v0.0.148 — 2026-06-22

- Bump actions/checkout from 6 to 7
- Bump actions/setup-node from 4 to 6

## v0.0.147 — 2026-06-22

- Bump actions/setup-node from 4 to 6

## v0.0.146 — 2026-06-22

- Add desktop auto-update via electron-updater

## v0.0.145 — 2026-06-22

### CI

- surface Swift warnings hidden by xcpretty

## v0.0.144 — 2026-06-22

- Scaffold iOS TestFlight release lane (inert until secrets added)

## v0.0.143 — 2026-06-22

- Resolve js-yaml DoS advisory via scoped override
- Stop diagram zoom buttons triggering page double-tap zoom
- Fix diagram controls covering the diagram on phones

## v0.0.142 — 2026-06-20

### Documentation

- modernization retrospective + capture learnings in agent docs

## v0.0.141 — 2026-06-20

- fix iPad print presentation + silence Xcode warnings

## v0.0.140 — 2026-06-19

- Fix iOS horizontal drift while scrolling a document

## v0.0.139 — 2026-06-19

- surface Comments + Annotations in the More sheet (iPhone parity)

## v0.0.138 — 2026-06-19

- Bump undici from 6.26.0 to 6.27.0

## v0.0.137 — 2026-06-19

- Bump dompurify from 3.4.10 to 3.4.11

## v0.0.136 — 2026-06-18

- Reveal HTML comments in the preview (fix) + a show/hide toggle

## v0.0.135 — 2026-06-16

- in-app editor (fixes desktop) + annotations list panel

## v0.0.134 — 2026-06-16

- collapsible tree + web folder support (File System Access)

## v0.0.133 — 2026-06-16

### Documentation

- scope iOS/iPadOS distribution (TestFlight + App Store)

### Other Changes

- macOS squircle app icon (rounded + padded)

## v0.0.132 — 2026-06-16

### Documentation

- scope iOS/iPadOS distribution (TestFlight + App Store)

## v0.0.131 — 2026-06-16

- Fix annotations: render saved badges + make the mode discoverable

## v0.0.130 — 2026-06-16

### Documentation

- rewrite README for the current multi-surface app

## v0.0.129 — 2026-06-16

- build a universal (Intel + Apple Silicon) macOS DMG

## v0.0.128 — 2026-06-16

- add app icon for mac/win/linux builds

## v0.0.127 — 2026-06-16

### Documentation

- mark macOS signing secrets configured (signed pipeline live)

## v0.0.126 — 2026-06-15

- Consolidate the window.specdown bridge into one seam

## v0.0.125 — 2026-06-15

### Documentation

- Electron-vs-Tauri spike (Phase 3 decision)
