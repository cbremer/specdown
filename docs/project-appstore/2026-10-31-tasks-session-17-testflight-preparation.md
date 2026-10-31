# Session 17 — final mobile source review and TestFlight preparation

Date: 2026-10-31 (America/Los_Angeles).

**Numbering superseded:** Chris subsequently selected **1.0.1 (228)** for the security update. Use [Session 18](2026-10-31-tasks-session-18-security-update-numbering.md) and its new owner packet for signing. The 1.1 paths and evidence below are retained as the historical preparation record.

## Owner direction and verified portal state

Chris requested the final source review and preparation of the next TestFlight build. He confirmed Chrome was already signed in and authorized using that session. Apple signing and existing Mac App Store keys remain owner-managed. The accepted sequence remains TestFlight acceptance first, followed by App Review submission of that exact passing build; public release remains owner-controlled.

The existing Chrome tab for SpecDown (Apple app ID `6822086808`) was inspected without signing in again. App Store Connect shows iOS **1.0 Ready for Distribution**, with build **11** selected. TestFlight's upload list, sorted newest first with all statuses, shows **1.0 (11), Complete**, followed by 10–7; no newer upload was present. The existing **Owner** internal group contains one tester and 11 builds, with automatic distribution for Xcode builds. No tester, permission, account or release setting was changed.

The next candidate is prepared as **1.1 (228)**, following the existing 1.1 plan and using the current web patch as its build number. This is a reversible preparation choice; Chris was offered 1.0.1 (228) as the patch-version alternative and has not yet replied. The earlier simulator identity alone did not choose or reserve this number: the live upload history was checked first. Recheck upload history before the owner uploads if another build may have been sent in the meantime.

## Final source review

The review covers the complete mobile-relevant change from `681d9527fad55782182687b819009559a4bb3f78` through `2d10adc69ffebd27b0fd4fc0245ac1a32ca68b17`, including shared sanitization/resource policy, native file and bridge boundaries, adaptive layout, document context, centered diagrams, Find and deferred annotations. Exact #328 CI and iOS simulator/security CI were independently confirmed green. This does not close scanner records or replace signed/physical-device acceptance.

Two additional defects were reproduced with bounded synthetic fixtures and corrected before freezing the next candidate:

1. **Rejected document opens changed identity before validation.** Opening valid A followed by B with a 65,537-character line selected B's tab while A remained visible/raw. Native title/recents were also committed before renderer acceptance. [#329](https://github.com/cbremer/specdown/pull/329), commit `112844b3942e75832c9dd6aafa71b2f69eb7ed2e`, prepares/sanitizes the document before tab mutation, reuses the prepared HTML, and commits native metadata only after true acceptance. The native guard handles stale/reordered callbacks and page reloads.
2. **Find created unbounded highlights.** A valid 30,007-character document containing one text element could create more than 20,000 highlight elements. The bounded probe stopped before allocating the 20,001st. This is a resource-budget defect, not an observed device crash. [#330](https://github.com/cbremer/specdown/pull/330), commit `4dd0f594839c8ff23b3f1f48634fe04e1f537a2a`, limits displayed highlights to 1,000, preserves all remaining text, and shows `1000+` plus an accessible explanation when there are more matches.

No other release-blocking source defect was identified in the scoped mobile reviews. Real-library probes preserved Mermaid's strict security and size/edge limits against document directives, scoped custom CSS, and removed authored controls/positioning from sanitized HTML-label output. Those probes do not establish native layout geometry. Web/desktop annotation identity and recovery remain WK-18; native-iOS annotations remain disabled without reading or modifying their saved data.

## Final validation and owner archive

The complete corrected source passes **996 tests across 59 suites**, lint, type checking and the production web build. The atomic-open negative control fails all 12 new cases on the prior source; its corrected focused set passes 126 tests. The Find negative control fails seven new cases while seven controls pass; its corrected focused set passes 44 tests. Real Swift warnings-as-errors checks pass for file security and accepted-document ordering/reload behavior. Independent shared/native and Find reviews found no remaining actionable issue in these corrections.

Logs use `/private/tmp/specdown-atomic-open-*`, `/private/tmp/specdown-find-limit-*`, and `/private/tmp/specdown-ios-final-review-*-20261031.log`. These bounded synthetic checks establish behavior under the tested conditions, not physical-device or TestFlight acceptance. The version/settings-only preparation follows #330 on `codex/ios-testflight-1-1`; the shared package version remains 0.0.228.

Both final correction PRs have green lint/test and iOS simulator/security CI: #329 at `112844b` and #330 at `4dd0f59`. The candidate's unsigned **Release device archive** also passed. It targets arm64 iPhoneOS 27.2, minimum iOS 16, iPhone/iPad families, version **1.1 (228)** and bundle `com.mosaicpando.specdown`. All **111 application-source hashes** and **8 native/configuration hashes** stayed fixed; all **110 bundled web files** match. The app's dSYM UUID matches `AB59FB14-8CF4-3E01-BEE4-598BD8AF7DAE`. No signing identity, team, provisioning profile or signature directory is present.

Device archive: `/private/tmp/specdown-ios-device-preflight-20261031-unsigned.xcarchive`; exact manifest/report: `/private/tmp/specdown-ios-device-preflight-{manifest,report}-20261031.{json,md}`. Executable SHA-256: `1687ed242724ebfa14f8273c41cf40c9ef897a75f64f55796a459e7d32da7e5e`. A separate unsigned simulator build at `/private/tmp/specdown-ios-final-review-sim-20261031-derived/Build/Products/Release-iphonesimulator/Specdown.app` matches the same source/web inventories. These new native artifacts supersede the older artifacts for this candidate; neither is an uploadable signed build.

Focused native callback smoke passed on one local iPad Pro 11-inch (M4), iOS 18.5. The exact 117-file simulator app was installed without erasing app data. Real Open Sample followed by native-sidebar Open Diagram Showcase updated the native navigation title to `sample.md` and then `diagram-showcase.md`, with matching rendered content and both tabs present. All three bounded XCUITest batches passed; PID 64046 remained stable until cleanup. The iPad was returned to its prior Shutdown state; the ordinary phone stayed shut down. Evidence: `/private/tmp/specdown-final-native-callback-smoke-20261031/{RESULT.md,evidence-index.json}`. No rejection/provider route, live note store, debugger or physical device was exercised; rejected-input behavior remains covered by the JS and Swift regressions.

The durable owner packet is `/Users/chrisbremer/Documents/SpecDown/ReleaseArchives/release/ios-1.1-228-20261031/`. It retains a pinned source archive and extracted source, the generated Xcode project and web bundle, unsigned validation artifacts, dSYMs, evidence and a SHA-256 inventory. The packet's manifest maps the final preparation commit to the exact source hashes used by both native builds. No private credential directory or key material is involved.

## Signing and TestFlight handoff

Chris retains signing. The final handoff must identify the exact Xcode project, version/build, source snapshot, expected bundle ID `com.mosaicpando.specdown`, bundled web hashes and unsigned device validation evidence. An unsigned app/archive is not a TestFlight upload artifact. Preserve the owner-created signed archive, IPA if exported, dSYMs and hashes alongside the source/evidence before uploading.

Open the packet's `source/ios/SpecDown.xcodeproj`, select the `SpecDown` scheme and a generic iOS device destination, confirm 1.1 (228), and select the existing signing team/setup manually. Then create the signed Release archive in Xcode. Use Organizer's App Store Connect distribution path, preserve its signed archive/symbols and record the processed build identity. Do not run the repository's old `ExportOptions.plist` as a ready recipe: it still has a placeholder team and obsolete CI comments. Signing settings may change in the generated project; application source and bundled web content must remain the reviewed candidate.

The ready-to-paste test instructions are in `app-store/metadata/testflight-1.1-228.md`. The next-version What's New draft now replaces the initial-release copy in `en-US/ios.json`; other historical proposed fields are not instructions to overwrite the live listing.

Use a Store-capable App Store Connect distribution path. Do not select **TestFlight Internal Only**, because that build cannot later be submitted to customers. [Apple's internal testing guidance](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/) describes the restriction. Browser sign-in does not establish Xcode signing readiness; no credential generation, replacement, inspection or use is part of this preparation.

After processing, verify the exact version/build in the existing Owner group and follow [Session 16's physical-device checklist](2026-10-31-tasks-session-16-testflight-boundary.md). Add the two final-review regressions: a rejected document must leave the prior document/tab/title consistent, and Find must preserve text and remain usable when matches exceed the displayed limit. Keep physical Duo, iOS 16, WebContent restart and other untested runtime cases explicit. Fix failures and retest a new build before App Review; preserve manual public release.

## Store asset observations

The live 1.0 listing has five iPhone screenshots and five iPad 13-inch screenshots. The iPhone Duo screenshot slot is empty. No header is currently assigned. Asset Library contains **SpecDown — Brand Halo Header** and **SpecDown — Reading Companion Header**, both 21:9, both **Waiting for Review**. Existing screenshot assets shown for the current listing are approved. Do not upload duplicates or call either header approved; assign the chosen header after Apple approval and add Duo captures only from a validated candidate.

The live 1.0 reviewer notes still describe its HTTP web-content exception. Preserve that released-version description; the next version's local review copy already reflects the corrected HTTPS policy. No Store listing, asset assignment, upload, submission or public release was changed in this portal inspection.
