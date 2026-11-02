# Session 59: tooling and Electron 45 validation

Date: 2026-11-01. Scope: dependency PR #358 and the narrow window-cleanup correction found by running its actual Electron runtime. The frozen Store 1.0.1 (230) release artifacts remain unchanged. These dependency-validation artifacts are not a replacement signed release.

## Changes and compatibility review

| Dependency | Before | Candidate |
| --- | --- | --- |
| Electron | 44.10.1 | 45.1.0 |
| ESLint | 10.9.1 | 10.13.0 |
| globals | 17.11.0 | 17.13.0 |
| Jest | 30.4.2 | 30.5.2 |
| jest-environment-jsdom | 30.4.1 | 30.5.2 |
| Prettier | 3.9.6 | 3.9.10 |
| Vite | 8.2.4 | 8.3.5 |

The [Electron 45 breaking changes](https://www.electronjs.org/docs/latest/breaking-changes#breaking-api-changes-450) remove Node polyfills from sandboxed preloads. SpecDown's preload imports only `electron`, uses Web APIs for URLs and retains context isolation. The [45.1.0 notes](https://releases.electronjs.org/release/v45.1.0) include File System Access and ASAR handling fixes; the tested runtime is Chromium 156.0.8078.49 / Node 24.22.1.

[Jest's release notes](https://github.com/jestjs/jest/blob/main/CHANGELOG.md) describe resolver, watcher and configuration changes. The existing test harness and coverage thresholds pass. [ESLint](https://github.com/eslint/eslint/releases/tag/v10.13.0) adds rule checks, [globals](https://github.com/sindresorhus/globals/releases/tag/v17.13.0) refreshes identifier data, [Prettier](https://github.com/prettier/prettier/releases/tag/3.9.10) fixes Markdown table parsing performance, and [Vite](https://github.com/vitejs/vite/releases/tag/v8.3.5) fixes build/import-map and development-server behavior. No whole-repository formatting was applied.

## Runtime finding and correction

Actual Electron 45 window destruction raised `Object has been destroyed`: startup cleanup accessed `BrowserWindow.webContents` after the native window was destroyed. Cleanup now checks captured window identity without reading that getter. A callback from an older window still cannot reset the current window's workspace. Receipt/frame/lifecycle validation is unchanged.

Four direct/MAS regression cases reproduce the exception on the original dependency candidate and pass with the correction. The 26 existing startup controls remain green. Real native destruction also completes without an uncaught exception after the change.

## Validation

- Clean physical `npm ci`; the existing builder keychain-source verifier passes without keychain access. Electron 45 downloads its binary lazily, so the runtime was fetched explicitly using its package-provided checksums.
- Full coverage suite, lint, typecheck and rebuilt web output pass. The final count before stacking other dependency PRs is **1,345 tests / 77 suites**.
- Fourteen checks use actual Electron 45 main/preload/renderer code and real bundled marked, DOMPurify, Mermaid and Chokidar: accepted native open; byte/complexity rejection preserving document and recents; denied ungranted reads; Close Folder retaining tabs/grants while blocking former relative navigation; live reload after Close; reload/session delivery; stale/replayed/wrong-window receipt rejection; wrong-page bridge denial; and clean window destruction.
- The existing universal Node-API bookmark addon loads under Electron 45 and creates/resolves/releases a bookmark for a disposable synthetic file. This is ABI evidence, not signed App Sandbox permission evidence.
- Unsigned MAS arm64 app assembly passes with identity explicitly null, profiles absent, publishing disabled and production permission hooks retained. Verification binds **127 source/web files, 110 web files, 8,555 runtime dependency files, 10 native binaries, 259 outer files and four internal links**. The nine Electron arm64 binaries match the verified 45.1.0 archive; the universal bookmark addon is unchanged. Public modes, version 1.0.1 (230), bundle ID and macOS 13 minimum match expectations. Updater, provisioning profile, top-level signature and QA fixtures are absent.
- Synthetic runtime userData/sessionData are isolated before production main initialization. OS recent-document writes, global shortcuts and native picker interaction are intercepted in the harness. No owner application is installed, replaced, quit or read.

Initial evidence failures are retained: sandbox DNS blocked the first install; a generic test sentinel and a malformed selector were replaced with a unique sentinel and valid selector before the complete runtime pass. Actual sanitized DOM and the unique execution sentinel pass. An initial verifier incorrectly expected the framework's minimum-OS field in its plist; the actual Mach-O `LC_BUILD_VERSION` confirms macOS 13.0. These are distinct from the reproduced application cleanup defect.

## Security and remaining gates

All **138 production lockfile entries** are unchanged by this tooling PR. Runtime audit reports **zero** vulnerabilities. The development audit still reports the same two underlying advisories through 17 affected packages: minimatch **3.1.5** (`GHSA-g3hv-75wg-m249`, moderate) at the same three legacy paths, and deepmerge **4.3.1** (`GHSA-gcqx-w48m-w2h4`, low). They remain tracked in [#356](https://github.com/cbremer/specdown/issues/356); no blanket major override or audit-suggested downgrade was applied.

The local package is arm64 and unsigned. Intel/universal and Windows/Linux package CI, combined validation with the other approved dependency PRs, independent source review and normal release-specific signing/TestFlight/physical acceptance remain separate gates. No version, native identifier, signing configuration, release policy or Apple account state changed.

Private logs, manifests, isolated fixtures and runtime/package scripts are retained under the ignored `ios/DerivedData/dependency-validation-20261101/tooling/` evidence directory. Historical failed and pre-correction artifacts are preserved separately from the corrected validation app.
