# Session 52 — Signed iOS and Mac 229 handoff

Chris authorized preparation of both final 1.0.1 (229) releases using existing certificates. He separately approved creating the matching production iOS provisioning profile. The profile was created and installed; no new key or certificate was generated. Both signed delivery artifacts are now independently verified against frozen source `b9e54727f3e18d02a874c5de768f6e0e47def493`.

Both exact 229 artifacts have now been delivered to Apple. Production iOS was delivered at 6:59 PM Pacific on November 1 and is available to the sole **Owner** internal group (one tester, zero individual testers). Mac was delivered at 7:04 PM and subsequently processed; parent observed its exact build available only to Owner. Eleven scoped checks of the separate development-signed Mac candidate passed. No physical TestFlight acceptance of either 229 build is claimed. Chris subsequently required **Close Folder** for this release (WK-34), so both 229 builds are preserved as historical testing candidates, pending a reviewed replacement. Build **230** is proposed; its implementation and artifacts do not exist at this checkpoint.

## Exact delivery artifacts

Paths below are relative to `ios/DerivedData/release-proof-20261101/` in the canonical checkout.

| Platform | Signed artifact | SHA-256 | Size |
| --- | --- | --- | --- |
| Production iOS | `signing/ios229/runs/production-229-b9e5472-20261101/export/Specdown.ipa` | `93d7b1e573bc8ad374c38035d0f308012003645c9ac122996d203962c3e87aa2` | 31,461,547 bytes |
| Mac App Store | `signing/mac229/outputs/store-b9e5472/build/mas-universal/SpecDown-1.0.1-universal.pkg` | `f0d6cd989fcee692c484f5d77da72cdb336b6babe5bd3d4945178a68fa0f8aff` | 283,007,361 bytes |

Both use production bundle ID `com.mosaicpando.specdown`, marketing version 1.0.1 and build 229. They include the security/recovery changes and required diagram-link removal. Historical unsigned and 228 artifacts remain preserved with their own evidence.

## Independent verification

**iOS:** The signed archive and exported IPA passed independent checks. The IPA contains 119 application files, including all 110 frozen web files, arm64 code, iOS 16 minimum, both device families and Original plus seven alternate icons. The existing distribution certificate is `887B0443F892AF1E5557D3728BC180F4D26DCD0B`. The matching production profile UUID is `e3dc2bab-d6a1-464b-a59c-2ffef5f9e071`; `get-task-allow` is false. Export preserves version/build and uses standard App Store Connect distribution with the internal-only restriction **off**. Apple later automatically assigned the exact processed build to the existing Owner group; the readback confirms no other groups or individual testers. The exported executable retains archive/dSYM UUID `88985B2E-D942-39FF-9622-C46A74B04C85`; normal export symbol stripping and re-signing are recorded rather than mislabeled as byte equality.

- Archive evidence: `signing/ios229/runs/production-229-b9e5472-20261101/archive-independent-verification.json`, SHA-256 `54e52af6d1f34e692c52446102cc557d44cc23159b0afc7ee861eb07349547e7`.
- IPA evidence: `signing/ios229/runs/production-229-b9e5472-20261101/ipa-independent-verification.json`, SHA-256 `b0d2b0b82ba5afedc1d9633992d50b1622a0756ecfac34fb0ef4503e238d9094`.

**Mac:** The app and installer passed independent signature, source, dependency, payload and permission checks. All 127 packaged source files, including 110 web files, and 8,555 dependency files match their verified inputs. Ten native binaries contain both arm64 and x86_64 slices; all 20 signatures use the expected distribution certificate. The installer uses existing certificate `5848618D96FAF016C3DC4E863C6A242E8F9004C5`. The extracted package matches all 268 app files, four safe links, modes and 20 CDHashes. All 1,175 BOM entries have root:wheel ownership; each of the 587 AppleDouble companions is bound to a real payload path. The embedded public profile is 0644, while private source profiles remain unchanged. No updater, packaged QA Markdown fixture or installer script is present.

- Final gate: `signing/mac229/FINAL-INDEPENDENT-GATE.json`, SHA-256 `e8ccbf4af859b6ee0f80149102c930f16e9ef769d5fc9ec1e94e9b99aea87bd2`.
- Store independent review: `signing/mac229/independent-store-review.json`, SHA-256 `7578721bda78893ac4e9dde8485fd3acc5b3decfbff0a0e68dff1e488d793baf`.
- Separate development app review: `signing/mac229/independent-development-review.json`, SHA-256 `a0032c72ba8742ae45962e9905ec1dc2360907aeb2fb499f8e209c4db88a041a`. Local runtime uses this development-signed candidate and isolated QA state; it does not establish Store/TestFlight acceptance.

## Delivery and scoped local runtime

Apple's production iOS build ID is `5b231c50-ceb7-4883-b1c3-189765832828`. The 1.0.1 (229) build page shows **Owner / Internal / 1**, **Individual Testers (0)** and saved What to Test notes covering documents, rejected inputs, diagram controls and link removal, Find, icons and relaunch. Evidence is retained under `ios/DerivedData/store-asset-audit-20261101/`: `ios229-transporter-delivered.json/.png` and `ios229-owner-testflight.txt/.png`. The original delivery record says processing; the later Owner readback supersedes that state.

The exact Mac PKG delivery is recorded in the same directory as `mac229-transporter-delivered.json/.png`. The later parent observation confirms processed Mac build `67638394-ae7d-40a7-a160-549087fb95c3` is Owner-only. The retained `mac229-owner-testflight.txt/.png` readback confirms **Owner / Internal / 1** and **Individual Testers (0)**, superseding the original processing record. Neither delivery submits an app build for App Review or releases it publicly.

The Mac What to Test field remains blank in that readback. Automatic approval review rejected an optional attempt to label it an interim candidate before execution, citing unapproved new release messaging and the retained-copy preference. No field was changed and no retry is planned; this does not block the code fix. The earlier saved iOS notes still call 229 a release candidate; the later WK-34 requirement supersedes that local release-readiness assessment without changing Apple's saved text.

`mac-runtime-229/runtime-result.json/.md` records 11 passing observed-scope cases using the separately development-signed arm64 MAS app with fresh, explicit Electron user data: clean launch, native Open/Split, fullscreen zoom/reset with SVG/PNG and no Link, Find dismissal, oversized-input rejection preserving the accepted document, valid startup restoration, missing-startup recovery controls, Locate cancellation, temporary Dismiss, persistent Stop reopening, and actual SVG/PNG saves. The exact report retains evidence and exceptions. Later parent observation confirmed runtime QA ended with the app quit and no matching `pgrep` process. A separate screenshot session subsequently reopened the app as PID 79910. Parent then quit it through the native app and verified `pgrep -x SpecDown` returned exit 1 with no output. That screenshot QA process is closed. All four QA simulators remained Shutdown, with no simulator boot in this turn. These cleanup observations do not change the completed runtime results.

This runtime result is not installation or acceptance of the distribution-signed TestFlight package. Successful Locate replacement, multiple/stale callbacks, malformed input and tab-limit native paths, bookmarks/live reload/PDF/Print, numeric resize centering, Intel and minimum-OS runtime remain unexercised in this run. Fresh Electron user data does not isolate the shared bundle identity, OS recents or app-group identity.

**WK-34 — required for this release:** Chris subsequently instructed, “We should fix the folder thing for this release.” This supersedes the earlier future-backlog classification. `mac-runtime-229/folder-close-audit.md` remains an unchanged historical source audit: **Workspace files** hides the tree but there is no true **Close Folder** command. The sheet tracks WK-34 in row 38. A reviewed close lifecycle and regression/runtime checks are now required before the replacement release candidate can be submitted. Parent plans a separate worktree and build 230; no implementation, new source revision or new build is claimed here. Session 53 will record that work.

## Remaining release gates

1. Implement and review the complete WK-34 Close Folder lifecycle in a separate in-repository worktree, preserving canonical source and owner data until a reviewed promotion. Verify synthetic renderer/main/native cases; do not mutate the existing 229 artifacts.
2. Freeze the replacement source, confirm the aligned version/build (230 is proposed), then prepare and independently verify the new iOS and Mac artifacts. Retain the signed 229 artifacts and delivery evidence as historical testing candidates; do not re-upload them.
3. Deliver the new exact candidates to Owner TestFlight and accept them on iPhone/iPad and Mac, including Close Folder where supported, recovery, document access, diagram controls/export and absence of the unsupported link action. Neither 229 build has physical acceptance recorded here.
4. Finish required screenshots and proof the selected saved copy, draft metadata and exact replacement builds before final app-build App Review. Session 51's existing copy remains selected; the optional Session 49 AI-workflow refinement is preserved and deferred.

Chris deferred Mac screenshot window sizing/capture until he returns to this Mac. Mac capture waits for owner availability; separately, the newly required Close Folder fix will require reviewed replacement builds. The current screenshot manifest still records five ready-for-proof iPhone 6.9-inch images, a lower-zoom recapture needed for iPhone 6.3-inch order 4, and empty iPad, Mac and optional Duo groups. No fresh screenshots or upload completion is claimed here; the deferral itself does not require a rebuild, but WK-34 now does.

Search Results artwork is independently Waiting for Review from Session 50; its approval is not a prerequisite to beginning build delivery. Optional additional device artwork is not treated as required without portal evidence. Public release remains manual and owner-controlled. This handoff does not submit either app build for App Review.

Canonical source remains `<repo>`, branch `codex/local-ios-1-0-1`, at `b9e5472`; ordinary Xcode Run remains **SpecDown Dev**. This documentation update changed no source, signing inputs, artifacts, selected/optional copy files, images, portal fields or tracker rows. Current local proof status is in [build-status.json](release-proof-2026-11-01/build-status.json) and [preparation-status.json](release-proof-2026-11-01/preparation-status.json).
