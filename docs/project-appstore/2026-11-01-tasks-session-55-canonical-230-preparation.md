# Session 55 — canonical build 230 preparation

Date: November 1, 2026. Current source is **`28848a25b837c022918ccc1625b17af0fa9c80e1`**, marketing version **1.0.1**, build **230**, on `codex/local-ios-1-0-1`. Use `<repo>/ios/SpecDown.xcodeproj`; ordinary local Run remains **SpecDown Dev**.

## Source and preservation

The reviewed Close Folder change (`2414bc5`, Session 53) is followed by the separate version-only commit (`28848a2`, Session 54). Close Folder detaches the folder browser without closing documents or clearing notes, recents, file access or watchers. Hide remains reversible. Pending picker, scan, relative-open and queued workspace results cannot restore a closed or superseded folder. Retained former-folder documents show reopen-folder guidance for relative Markdown links without leaving the app. Folder navigation and Close Folder are available on supported desktop/web surfaces; native iOS exposes neither folder controls nor this command.

All **1,341 tests across 77 suites**, required coverage, lint, typecheck and production web build pass. The independent Close Folder review passes **58 cases**; the production-browser review passes **10 observed cases** using synthetic folders. Those browser checks are not packaged MAS or physical TestFlight acceptance. The separate version review verifies the five version files, 458 unchanged inherited files, 806 unchanged dependency entries and all 110 web outputs.

Guarded promotion preserves all **70 owner/local untracked files**, every original README timeline row, signing/team settings, scheme/UI metadata and generated Info.plist. Exactly six generated Xcode build counters changed from 229 to 230. Independent preservation review passed. The earlier web output and all signed 229 artifacts remain retained. This handoff changes documentation and tracker values only.

## Actual iOS build results

Canonical signing-disabled **Release device and simulator builds passed**, and independent artifact verification passed. Both products contain production `com.mosaicpando.specdown`, **1.0.1 (230)**, iOS 16 minimum, iPhone/iPad families, Original plus seven alternate icons, and all **110 exact reviewed web files**. Device architecture is arm64; simulator architectures are x86_64 and arm64.

The device is unsigned. Simulator x86_64 is unsigned; simulator arm64 has only the linker-generated ad-hoc signature, with no owner/team identity or resource seal. These are build products, **not uploadable signed distribution archives**. Each build log has one App Intents metadata-extraction-skipped warning and no errors. No install, simulator boot, Run, signing, key access or upload occurred in these iOS build checks.

## Mac and release proof

The unsigned Mac App Store **arm64 review app** now passes independent static verification: 127 exact source/web files including all 110 web files, 8,555 dependency files, 259 bundle files and four safe internal links. Its nine Electron binaries are arm64; the separately verified cached bookmark addon is universal. It identifies as `com.mosaicpando.specdown`, **1.0.1 (230)**, Electron 44.10.1, macOS 13 minimum, with no direct-channel updater. No new owner signature, provisioning profile or installer was produced. Cached linker ad-hoc metadata is not owner signing. A new universal signed distribution package and provisioned-sandbox/Intel/TestFlight acceptance remain separate gates. The existing direct-download desktop installation is untouched.

A subsequent native run of this exact **unsigned arm64 MAS-runtime app passed 12 observed cases**: clean synthetic startup, native File menu enablement, picker/open and relative links, File/header Close preserving documents, retained-link guidance, live reload after Close, reopening a distinct folder/document, retained recents and native Quit. The host confirmed the QA process ended; the synthetic fixture was restored exactly and app binary/ASAR remained unchanged. Fresh Electron user data does not isolate the bundle identity or shared OS recents. This is **not provisioned-sandbox, Intel, Store or TestFlight acceptance**. Native empty-folder/pending-picker race UI and note persistence were not exercised; automated/source/browser coverage remains separate.

The exact signed production iOS and universal Mac **1.0.1 (229)** artifacts were delivered and assigned only to Owner, as recorded in Session 52. They are historical candidates and do not contain Close Folder. Their hashes, Apple build IDs and source-specific runtime evidence are preserved in the proof metadata; none is relabeled as 230.

The proof gallery still selects the retained saved listing copy. The optional AI-workflow copy remains deferred. Header assignment and Search Results Waiting for Review are retained portal observations, not new account checks. All artwork/copy bytes, image files and screenshot-manifest hashes are preserved. The ten iPhone screenshots remain build-229 captures, not 230 captures. Current-release screenshot proof remains pending; Mac window sizing and capture wait for Chris.

## Next gate

The scoped unsigned native checks are complete. Prepare the exact 230 distribution artifacts under owner authorization and complete the remaining provisioned-sandbox/Intel and production TestFlight acceptance. Physical production iPhone/iPad and Mac TestFlight acceptance and final copy/artwork/screenshots proof precede App Review. No build 230 has been signed, uploaded or submitted here; public release remains owner-controlled.

The existing Launch Weekend sheet now records WK-13 and WK-34 as **Ready for review**, and WK-14 as **In progress**. Only each row's status, next action, evidence and date were updated; bounded readback verifies all other cells, formatting and validation remained intact. This does not mark physical or Store acceptance complete.

## Evidence

All paths are under the canonical repository:

- `ios/DerivedData/release-230-20261101/author/` and `independent/review.json`: version source gates.
- `ios/DerivedData/close-folder-20261101/author/`, `independent/review.json` and `parent/browser-final-result.json`: feature and real-browser scope.
- `ios/DerivedData/release-230-20261101/promotion/{promotion,independent-review}.json`: exact owner-preservation proof.
- `ios/DerivedData/release-230-20261101/native/{verification,independent/review}.json`: actual signing-disabled native artifact verification, full inventories and log bindings.
- `ios/DerivedData/close-folder-20261101/packaging-plan/runs/230-28848a2-attempt01/`: frozen Mac app, `ARTIFACT-MANIFEST.json`, `FINAL-INDEPENDENT-GATE.json` and `independent/review.json`; static unsigned arm64 scope only.
- `ios/DerivedData/release-230-20261101/mac-runtime-unsigned/runtime-result.json`: 12 observed native cases, limits, restored fixture and clean shutdown; SHA-256 `3ad6257cb618ac93dba482d0f55afe94e6ee3ccad01917b27d045354c8ed23f9`.
- `ios/DerivedData/release-230-20261101/handoff/`: previous metadata, unchanged artwork/copy/screenshot inventory and final handoff verification.
- [Proof gallery](release-proof-2026-11-01/index.html), [build metadata](release-proof-2026-11-01/build-status.json), [acceptance checklist](release-proof-2026-11-01/acceptance-checklist.md).
