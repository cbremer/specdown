# Session 18 — security-update numbering

Date: 2026-10-31 (America/Los_Angeles).

Chris selected **1.0.1 (228)** for the next iPhone/iPad security update. This replaces the provisional 1.1 (228) preparation from Session 17. Build number 228 and bundle ID `com.mosaicpando.specdown` remain unchanged. The prior source/archive records are retained for traceability and must not be used as the current signing candidate.

## Scope and verification

The new branch `codex/ios-testflight-1-0-1` follows `b64b82bba762600c2ddf0192b80407add0b13058` / #331. The only native configuration change is `MARKETING_VERSION` in `ios/project.yml`. Release metadata, the matching What to Test draft and current handoff links now use 1.0.1. No Swift, shared-viewer implementation, dependency, icon or security-policy change is included.

Regenerate the Xcode project and both unsigned Release artifacts from the selected version. The device and simulator manifests must identify 1.0.1 (228), verify the exact committed source/configuration and unchanged 110-file web bundle, and match the actual packaged Info.plist values. Source, native configuration, generated project, executable, symbols and bundle hashes must be captured again; do not relabel old binaries as 1.0.1.

The prior 996-test source review and focused iPad callback smoke remain evidence for the same application logic. Required tests/lint/typecheck are rerun before the new commit. No simulator interactions are repeated solely for the version change, and the earlier runtime screenshots/logs remain explicitly identified as prior 1.1 evidence. Physical-device and processed TestFlight acceptance are still pending.

## Current owner signing packet

The replacement packet is `/Users/chrisbremer/Documents/SpecDown/ReleaseArchives/release/ios-1.0.1-228-20261031/`. Its `HANDOFF.md`, `SHA256SUMS.json` and `VERIFIED.json` record the exact final source revision and rebuilt unsigned products. Preserve the previous `ios-1.1-228-20261031` packet without modification.

Open the replacement packet's `source/ios/SpecDown.xcodeproj`. Confirm **1.0.1 (228)**, the SpecDown scheme and `com.mosaicpando.specdown`; Chris selects the existing signing setup and creates the signed archive. Follow its handoff and `WHAT-TO-TEST.md`, which copies `app-store/metadata/testflight-1.0.1-228.md`. The unsigned validation archive is not uploadable.

Use a Store-capable App Store Connect distribution, preserve the signed archive/symbols and verify the processed build identity. Complete TestFlight upgrade/security/UX acceptance on physical iPhone/iPad, then submit that exact passing build to App Review. Public release remains owner-controlled. Chris's Apple signing and existing Mac App Store keys remain manual; no credentials, profiles or keys are discovered, copied, generated, replaced or used during this preparation.

The Launch Weekend tracker and bounded weekend automation must point to this replacement source/packet. Neither the version decision nor successful local builds count as Apple processing or TestFlight acceptance. The portal was not revisited for this numbering-only follow-up.
