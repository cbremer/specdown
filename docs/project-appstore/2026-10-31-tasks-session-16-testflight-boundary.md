# Session 16 — TestFlight gate and native iOS annotations

Date: 2026-10-31 (America/Los_Angeles).

## Owner direction and next build

Chris requested submission of the next build to App Review **after TestFlight testing**. The current handoff targets the next iPhone/iPad revision. Prepare and review the source, create an owner-signed device archive, upload for TestFlight, test the exact processed build on physical devices, then submit that tested build to App Review after the checks pass. This direction does not authorize an automatic public release or change Chris's reservation of Apple login/signing and Mac App Store key setup.

The preceding candidate is application `65716dc` with documentation head `a4fc5fb`. Its 958-test and simulator evidence is recorded in Sessions 14–15. The installed simulator's validation identity 1.0 (228) is not an uploadable device archive or a chosen next Store build. Source settings remain 1.0 (11); Chris must check current Apple build history before the next version/build is stamped.

Use a Store-capable upload for the candidate: Apple's **TestFlight Internal Only** option cannot later be submitted to customers. After testing, select the exact processed build for the app version rather than rebuilding different bytes without retesting. Public reference: [internal tester/build eligibility](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/) and [choosing the submitted build](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/).

## Confirmed iOS annotation gap (WK-25)

The intended iOS feature policy defers annotations, but hiding editing/list controls did not disable the subsystem. On `65716dc`, normal preview rendering reads filename-based annotation buckets, displays clickable note badges and can write anchor migrations. Cmd/Ctrl+K is available, and annotation import/export commands lacked the iOS gate already applied to editing/list commands. Thus preexisting or imported notes for one `README.md` can appear on another same-named document, and rendering can modify their saved anchors.

The narrow mobile fix must enforce the existing deferred-feature policy throughout native-iOS annotation entry and persistence paths. Preserve existing stored bytes untouched; do not read/render/migrate/import/export/edit those notes on native iOS. Keep web/desktop annotation behavior unchanged. This does not solve general filename identity or activate the separate WK-18 recovery preparation.

## Implementation and validation

The fix adds native-iOS guards to the annotation entry points and storage boundary and removes annotation import/export from the native command palette. Reads and writes stop before touching `specdown-annotations`; import returns failure, `getAnnotationsJSON()` throws an unavailable error, and `exportAnnotations()` returns without creating a download. No empty backup is fabricated. Existing note bytes remain untouched. Mobile Safari and desktop keep their annotation features.

The isolated branch is `codex/ios-testflight-annotation-boundary`, based on documentation head `a4fc5fb5308e78cab77477cafaf041d5406df94b` and application `65716dc`. The only application changes are `markdown-viewer/src/features/annotations.js` and `markdown-viewer/src/features/app-commands.js`; native Swift/configuration, diagrams, dependencies and release workflows are unchanged.

- Negative control: the unmodified base fails all 10 new native-iOS cases while both web/desktop controls pass. The corrected candidate passes all 12 cases and **169 tests across 7 focused suites**.
- Full CI-style validation: **970 tests across 57 suites**, lint, type checking and the production web build pass. The full test command uses `--roots ./tests` to exclude cached/generated test trees.
- An independent source review found no actionable issue. Four separate real-ESM probes cover native iOS with normal and throwing synthetic storage plus mobile Safari and desktop controls. Native iOS performs zero annotation-storage accesses and preserves exact raw text; both other platforms still migrate, render and import. No installed app data was read.
- Frozen SHA-256 values: annotations `ede24826dff55a996c28e5970a06524007cb753c10ec728d12989c141d7b425c`; commands `de10920130a069d08947eae6344687751308932027635eade28104951903e453`; regression test `f2d4f063b12fb908cf8ea0440f25ac76d2cefcf2a90e7df0fab6a3c1b8cb2281`.

Logs are `/private/tmp/specdown-ios-annotation-{negative,focused,lint,typecheck,full-verified,web-build}-20261031.log`; the independent probe is `/private/tmp/specdown-ios-boundary-independent-20261031/probe.cjs`. The annotation checks are synthetic JS evidence, not a claim of TestFlight or physical-device validation.

The unsigned universal Release simulator build passed with validation identity **1.0 (228)**, bundle ID `com.mosaicpando.specdown`, minimum iOS 16 and phone/tablet families. Both ATS exceptions remain false. All **109 application-source hashes** stayed fixed during the build, with exactly the two frozen JS modules changed from the prior candidate. All **110 packaged web files** match the frozen production bundle, and all 117 app files are inventoried. Native/configuration and dependency hashes match the prior build. The first local build attempt failed because the execution sandbox blocked Swift macro subprocesses; the identical unsigned command succeeded with scoped execution access. No native source change was needed.

Artifact: `/private/tmp/specdown-ios-testflight-20261031-derived/Build/Products/Release-iphonesimulator/Specdown.app`. Manifest: `/private/tmp/specdown-ios-testflight-native-manifest-20261031.json`. Build log: `/private/tmp/specdown-ios-testflight-build-20261031.log`; the failed first log is preserved separately. Executable SHA-256: `80c23fa4ed9a16b65492f7cb795fb76b3a51b3b45c1f0eb8a2f3cbc783935886`; Info.plist SHA-256: `b4f636452e38dbccff1870681c5cf58285fb1a082d9039b52637bb2ce9b8de76`. This new artifact was not installed or launched and cannot be uploaded to TestFlight. Source version settings remain **1.0 (11)**.

The existing Duo and ordinary iPhone/iPad **simulator** interaction evidence belongs to application `65716dc`; its diagram/native inputs are unchanged here. Session 15's desktop packages also belong to `65716dc` and have not been regenerated for this native-iOS-only change. Do not describe those package bytes as this newer source revision. General web/desktop annotation identity and recovery remain open under WK-18, and inactive preparation #325 remains outside this candidate.

## TestFlight handoff checklist

1. Review the final source/CI and freeze the exact candidate. Do not use the older `65716dc` iOS package after this annotation-boundary correction.
2. Chris signs in and checks the latest version/build history. Confirm the next marketing version and unused build number, then stamp and inspect the final archive's bundle ID (`com.mosaicpando.specdown`), version/build, entitlements and bundled viewer. Preserve source, archive/IPA, symbols and hashes in the owner archive.
3. Upload using Store-capable distribution, wait for processing, and match the processed build identity to the archive. Use the existing authorized internal testing group; adding outside testers or changing account access is separate.
4. Install that exact TestFlight build on physical iPhone and iPad. Test upgrade from 1.0 without deleting data, cold launch, Files/iCloud open/reopen, two same-named documents, multiple tabs and Raw/Preview, diagrams/centered zoom, Find/keyboard, iPad resizing/rotation, offline samples, HTTPS failures, rejected oversized/invalid files and native print/cancel. Verify annotation controls/commands/markers remain absent and stored legacy notes are not modified. Record device/OS, build, steps and results; do not mark unavailable device/runtime cases passed.
5. Fix any release-blocking failure, issue a new build and repeat affected acceptance checks. Keep Session 14's physical Duo, camera/freeform resizing, iOS 16 and WebContent restart gaps explicit until verified or their release applicability is resolved.
6. Update the next-version What's New/reviewer text to match the shipping build; the existing `ios.json` still contains first-release copy. Select the exact tested build, complete required listing/compliance fields, and submit it to App Review after the TestFlight gate passes. Record server-confirmed submission status. Keep public release owner-controlled.

The current `ios-release.yml` performs unsigned simulator validation only. The old distribution guide and `ExportOptions.plist` contain stale automatic-upload instructions and a placeholder team; do not execute them as a ready signing/upload recipe. This session performs no Apple account access, signing, upload, submission, public release or other-computer access.
