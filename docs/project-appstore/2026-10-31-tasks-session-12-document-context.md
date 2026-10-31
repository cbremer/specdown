# Session 12: keep annotation actions with their document

Date: 2026-10-31 (America/Los_Angeles). Follow-up to [session 10](2026-10-31-tasks-session-10-annotation-storage.md).

## Problem and resulting behavior

An annotation editor could outlive the document it was opened on. A later Save or Delete used the current document's annotation key, while an older asynchronous render could install its annotation context over a newer document. Similar late completions could restore the previous tab's scroll position or update its watch indicator after the user switched away.

Document replacement now advances a transient generation tied to the active tab and actual content root. Annotation editor and panel actions capture that context. A Save or Delete from an obsolete context changes no stored notes and keeps the editor's draft text. Returning to the old tab does not silently reactivate an old editor; the user can copy the draft or cancel and reopen the note. A second editor request cannot replace the open draft or accumulate save listeners.

## Scope

- Accepted preview replacement, raw-view transitions, active-tab raw restoration, empty/drop-zone reset and raw watcher refresh invalidate the old document context. Invalid input is checked before replacement, so a rejected same-tab render leaves the existing visible document and editor usable.
- Main rendering checks its context after diagram work and before annotation setup, TOC/split refresh, scroll or other completion effects. Superseded failures do not show errors over the new document.
- Mermaid processing and theme rerendering also observe document validity after awaits and in error paths. Raw/empty transitions invalidate these passes even when they do not start another Mermaid render.
- Tab and watcher completion paths restore scroll and pulse watch chrome only for the current view. Background tabs still receive their unseen-change flags.
- Editors and panel actions require their captured annotation key, tab, generation and content root to remain current. A new note also requires its original element to remain in that root. Resize without content replacement does not invalidate a draft.
- PDF export snapshots its title before asynchronous printable-document rendering, matching the document already cloned by the print builder. A later tab switch does not rename that requested export; no cancellation or extra UI was added.

The annotation store schema and filename buckets are unchanged. **WK18 filename-only document identity and explicit legacy-note recovery remain open.** These guards prevent stale actions from acting on another view; they do not associate notes with stable source identities.

## Verification

Three local reproductions confirmed the prior behavior on clean candidate `7803f9b` using actual application functions in jsdom. The new suite adds 30 deterministic cases covering document switches, same-filename tabs, same-tab reload, raw/empty/close, root replacement, stale panel actions, draft preservation, normal resize, rejected input, late render success/failure, scroll/watch completion, diagram/theme completion and delayed PDF title capture. No timing-dependent sleeps are used.

The focused context, annotation, storage, desktop, view-mode and Mermaid suites pass **200 tests across six suites**. Full `npm run test:ci` passes **938 tests across 55 suites**, including the required desktop coverage thresholds. Lint, type checking and the production build pass; the build retains the existing large-chunk warning. Independent frozen-source review found no actionable issues: 14 additional regressions and the 117 context/persistence/annotation tests pass. The original candidate fails the relevant negative controls, including an actual cloned-document PDF export whose external title previously changed with the active tab.

Local evidence:

- Original reproductions: `/private/tmp/specdown-context-repro-20261031/current-races.test.js` and `result.log`.
- Focused tests: `/private/tmp/specdown-context-targeted-20261031.log`.
- Full tests: `/private/tmp/specdown-context-full-tests-20261031.log`.
- Production build: `/private/tmp/specdown-context-build-20261031.log`.
- Independent review manifest: `/private/tmp/specdown-context-independent-review/reviewed-source-manifest.json`.

## Evidence boundary

Only this Mac's isolated checkout and local headless tests/build were used. No browser/native UI, unlock attempt, Apple account, signing, keys, other computer, release or deployment was accessed. Existing dependencies were cloned from the candidate checkout; no dependency or native-shell source changed. Native interaction evidence from earlier sessions does not prove this new renderer revision. Fresh noninteractive packaging is recorded below; interaction remains a separate release gate.

## Exact native packaging — application revision 7509a0c

Artifacts were rebuilt from **`7509a0c84ddab3c90e665c2ae080f24ac492693e`** in `/private/tmp/specdown-weekend-context-20261031`. Any later documentation-only amendment is a separate review revision. A fresh production web build passed and contains application version 0.0.228. The earlier 938-test/55-suite and independent review results above are reused; no additional full test run or runtime/UI smoke was needed for this packaging pass.

- Fresh unsigned universal direct **DMG/ZIP** and **MAS app** assembly passed. The DMG checksum and ZIP compressed-data integrity checks passed. Both actual Electron frameworks report **44.10.1**, and app/framework binaries contain **arm64 and x86_64**. Direct contains electron-updater **6.8.11** and its update feed; MAS contains neither. All **125 packaged source files, including 110 generated web files**, match the exact checkout/build.
- Dependency manifests, builder guard and all native Swift/project sources exactly match the previous combined-source manifests. The verified universal bookmark addon was reused byte-for-byte. Both packaged desktop executables/frameworks and that addon retain their earlier native hashes. The previous real Swift security-regression and native-addon compatibility evidence therefore applies to unchanged native inputs; no repeated native runtime launch was performed.
- A newly generated Xcode project and unsigned **Release iOS simulator build** passed, with **arm64 and x86_64** slices and all **110 packaged web files** matching the freshly built viewer. Validation-only settings remain 1.0 (228), minimum iOS 16.0; both arbitrary-load ATS flags are false. Approved source settings remain 1.0 (11). The app was not installed or launched.

| Artifact | SHA-256 |
| --- | --- |
| Direct app ASAR | `17158731cf054872b615500ebcad61b243da9120828f9920b35cd438850052cf` |
| MAS app ASAR | `e591c90ed76363a72dbb61630c643e2540b05045a4b8f14248cda19c3c854723` |
| Direct universal DMG | `5fc86ae8e51802fc5ac68f9f90ae34d0521f489fec09b84dde35a293eaa1bcd0` |
| Direct universal ZIP | `02dc2747923fdbfd1df20b56d654009c21bde7ef5be70168a05f4fc9936ca996` |
| iOS simulator executable | `281f137385f4bb4129f9a336cdd8d2d16825f180c87c212a3c59e00720a0c9d2` |

Desktop outputs and exact source/version/architecture hashes: `/private/tmp/specdown-context-native-direct-20261031/`, `/private/tmp/specdown-context-native-mas-20261031/`, and `/private/tmp/specdown-context-native-manifest-20261031.json`. iOS app: `/private/tmp/specdown-ios-context-20261031/Build/Products/Release-iphonesimulator/Specdown.app`; native/web/dependency manifest: `/private/tmp/specdown-context-native-ios-manifest-20261031.json`. Build/verification logs and reusable unsigned wrappers use `/private/tmp/specdown-context-native-*`; the simulator log is `/private/tmp/specdown-ios-context-20261031.log`. Prior artifacts/manifests remain preserved.

This adds compile/package evidence for the new renderer revision. It does not complete final Duo pose/keyboard/compact-sidebar interaction, ordinary-device regression, signed MAS sandbox/bookmark validation, physical-device QA, final CI/review or owner-controlled distribution. No UI input/unlock attempt, app install/launch, Apple login, keys, signing, other computer, upload or publication was used.
