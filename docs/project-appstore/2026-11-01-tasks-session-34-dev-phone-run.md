# Session 34: development channel Run on the owner's phone

Status: **SpecDown Dev installed and owner phone checks passed.** The owner-approved **Beta 1.0.1 (228)** upload processed successfully and is now **Testing**, assigned to **Owner only**. The group still contains one tester; no external group was added. Beta TestFlight installation and physical acceptance remain outstanding. Only the Dev phone checks have passed so far.

## Authorized scope and preserved source

The owner's “Let's do the next steps” authorized the existing-certificate Dev Run following [Session 33](2026-11-01-tasks-session-33-apple-channel-setup.md). The Run used the canonical project `<repo>/ios/SpecDown.xcodeproj`, scheme **SpecDown Dev**, and destination **iPhone Z**.

Canonical source remains `729258b3ef31d9a4167e8e93fdd3f095d92a08d2`. Independent preflight found all **116 application/configuration/dependency/verifier inputs** exact to that revision and all **110 web files** exact to the Session 32 output. Application source, project and signing configuration were not edited. The scheme/device UI selection is expected local Xcode state. No other computers were accessed.

After the archive/export-dialog inspection, Xcode was restored to **SpecDown Dev → iPhone Z**, with Dev still Running. The generated project hash remained unchanged; the project README received an additive Session 34 summary/timeline entry with all prior lines preserved.

## Completed and observed

- Xcode's automatic-signing UI showed the existing Apple Development certificate and managed profiles for all three channel configurations. This establishes the visible configuration; only the Dev Run was performed here.
- Run was selected for **SpecDown Dev → iPhone Z**, and Xcode subsequently reported **Running**.
- A read-only CoreDevice metadata query confirmed installed **SpecDown Dev**, bundle ID `com.mosaicpando.specdown.dev`, version **1.0.1 (228)**. The initial sandboxed query timed out; the same scoped read-only query succeeded with local execution access. No application feature change was made to address that tooling restriction.
- In response to the explicit physical-phone check, including the icon choices, the owner reported: **“Separate apps; icons look correct.”** This records owner-reported coexistence and icon appearance acceptance. It does not claim an exhaustive automated test of every icon choice or app-data isolation.

A separate exact-ID metadata query also confirmed installed **SpecDown**, bundle ID `com.mosaicpando.specdown`, version **1.0.1 (228)**, alongside Dev 1.0.1 (228). This is the earlier local production-identity installation; it is not claimed to be the App Store 1.0 installation. The owner's coexistence report is recorded independently of those metadata queries.

## Actual device-build product verification

Independent verification located the actual `Dev Debug-iphoneos/Specdown.app` under the canonical project's Xcode DerivedData. Its successful build activity ran **2026-11-01 07:10:50–07:10:58 UTC** and recorded the canonical project and exact product paths, with zero errors and warnings in that activity.

The compiled product is **arm64**, `com.mosaicpando.specdown.dev`, **SpecDown Dev 1.0.1 (228)**, with iOS 16.0 minimum and both phone/iPad device families. Flat is the primary icon, with seven alternates per family: all eight choices remain available. All **110 bundled web files** match canonical `dist`, and the **116 tracked inputs** still match the source revision.

Existing signature metadata reports the Dev identifier and owner team. That inspection was display-only: it is **not signature integrity or trust validation**. The inspection reported `Authority=(unavailable)` and `Info.plist=not bound`; those observations are preserved in the evidence. No embedded-profile contents, private keys or keychain were accessed by the independent verifier. The Xcode Run, installed-device metadata, compiled-product inspection and owner functional report are separate evidence surfaces.

## Phone acceptance and distribution setup

- **Owner-reported phone checks passed:** the owner replied **“Diagram and Find work normally”** to the explicit Dev diagram-centering/zoom and Find keyboard-dismissal check. This adds physical Dev behavior acceptance to the separate coexistence/icon appearance report; it does not validate a TestFlight build.
- **Owner-created certificate confirmed:** the initial Xcode Manage Certificates inventory showed the current-Mac development certificate plus Developer ID Application and Installer entries, without an Apple Distribution entry. The owner then reported **“Apple Distribution certificate created”**; a subsequent read-only observation showed Apple Distribution with creation date **2026-11-01**. Certificate/private-key setup was performed by the owner, not the agent.
- **Beta profile generated:** the portal confirmed **SpecDown Beta - App Store - 2026-11-01**, type **App Store**, profile ID `6GF285P872`, for App ID `582YQWPT9G.com.mosaicpando.specdown.beta`, expiring **2027-11-01**. It selected only the owner's new Distribution certificate, also expiring **2027-11-01**. The profile was not downloaded manually from the browser; it was subsequently downloaded and selected through Xcode's **Download Profile / Select** flow for distribution signing.
- **Beta Archive succeeded:** the canonical Xcode project selected **SpecDown Beta → Any iOS Device (arm64)** and Product → Archive completed. Organizer showed **SpecDown Beta 1.0.1 (228)**, the `.beta` bundle ID, **arm64**, dated **November 1, 12:21 AM** in the local UI. Independent artifact results are recorded below. The Xcode Cloud marketing prompt was dismissed with **Remind Me Later**; no Xcode Cloud setup was performed.
- Cloud-managed signing is not an inspection-only workaround. Apple's documented flow can create or rotate signing assets and signs before the final Upload summary. It must not be entered merely to inspect readiness while avoiding the owner's signing decision.

## Beta archive verification and distribution-signing gate

The verified archive is `[owner-local path omitted]`. Independent checks confirmed Beta **1.0.1 (228)**, `.beta` identity, **arm64**, iOS 16.0 minimum, both device families, Light primary plus seven alternatives, and all **110 web files** exact to canonical output. All **116 source inputs** still match `729258b`. The app and dSYM share UUID `1AA5474B-ED4C-316D-888C-CA19438D662A`. The canonical Beta build ended at **07:21:50 UTC**, with zero errors and warnings. The finalized report confirms **123 archive files**, including **119 app files**, no symlinks, and unchanged inventory before/after inspection.

The source archive uses **Apple Development** signing and an Xcode-managed wildcard development profile with `get-task-allow` enabled. That archive alone is **not distribution-ready**. The separately authorized distribution-signing result is recorded below; the source-archive observations remain distinct from the upload payload. These are signature/profile metadata observations, not cryptographic trust validation. Archive success does not establish App Store distribution signing.

The custom distribution dialog reached the **Upload / Export** choice. **Automatic approval review rejected the attempted selection of Export followed by Next because the owner had reserved signing.** No export or distribution-signing attempt was executed. The dialog was canceled safely back to Organizer.

After the independent artifact checks, the owner was asked to approve using the existing Apple Distribution certificate to sign/export this exact Beta **729258b / 1.0.1 (228)** archive, upload it to the separate Beta TestFlight record, and assign it to the **Owner** group only. The owner answered **“Approve Beta signing and TestFlight upload.”** This explicit approval cleared the prior owner-signing gate for that concrete scope. It excludes new keys, App Review submission and public release.

## Xcode upload complete; Beta Testing in Owner only

Manual signing used the owner's explicit Apple Distribution certificate and the exact Beta App Store profile. Xcode's completed signing review showed **Beta 1.0.1 (228), arm64**, the certificate expiring **2027-11-01**, `beta-reports-active=true` and `get-task-allow=false`. This is the observed distribution review, separate from the development-signed source archive and its independent metadata inspection.

**Manage version and build number** was off, **TestFlight internal testing only** was on, and symbols were included. Upload was selected under the owner's explicit approval. After the upload progress stage, Xcode reported **App upload complete: Specdown 1.0.1 (228) uploaded**. This establishes Xcode upload success, not completion of Apple's processing or a successful TestFlight installation.

App Store Connect initially listed **Build Uploads: version 1.0.1 (228)** as **Processing**, dated **November 1, 12:31 AM** in the local UI, while the available-builds section said **No Builds**. Apple then completed processing and showed build ID `f6855ad9-79ee-4233-b893-493ba70c94a0` as **Ready to Test — Internal** before group assignment.

Under the existing Owner-only assignment approval, **Add Group → Owner** was selected and the save completed. Independent browser readback shows this exact **1.0.1 (228)** build as **Testing**, expiration in **90 days** at the check, and **Owner** as its only group. The group selection also confirms **OW Owner** selected; no external group was added. The one-tester Owner setup and manual distribution policy remain unchanged. The portal's **Testing** status confirms distribution to that group; it does not establish an owner installation or acceptance of this TestFlight build.

The signed upload IPA was retained as **SpecDown-Beta-1.0.1-228-AppStore.ipa**, **31,469,300 bytes**, SHA-256 `f4e3d1b94a5ad27aeb0e73acdd44f1e8429c77fd08e54def2aa2fdf9444c5e43`. Independent inspection confirmed ZIP integrity, all **119 payload files** matching the inspected signed staging, and all **110 web files** matching canonical output. The Beta identity/version, icons and arm64 architecture match the verified archive. Signature/profile metadata shows `get-task-allow=false`, `beta-reports-active=true`, the exact **SpecDown Beta - App Store - 2026-11-01** profile with no provisioned-device list, and the existing Apple Distribution certificate expiring **2027-11-01**. This separate distribution evidence does not rewrite the development-archive report or claim server processing, assignment or testing success.

Beta upload, Apple processing and the approved Owner-only assignment are complete. Owner Beta TestFlight installation/acceptance, App Review submission and public release have not occurred in this session. The agreement-status discrepancy from Session 33 remains for owner review unless separately resolved and recorded.

## Evidence and next steps

Local evidence is retained under `ios/DerivedData/dev-phone-run-20261101/`:

- [Installed Dev metadata](../../ios/DerivedData/dev-phone-run-20261101/installed-dev.json).
- [Installed local production-identity metadata](../../ios/DerivedData/dev-phone-run-20261101/installed-production.json).
- [Xcode Running observation](../../ios/DerivedData/dev-phone-run-20261101/xcode-running.txt).
- [Beta profile creation confirmation](../../ios/DerivedData/dev-phone-run-20261101/beta-profile-created.png).
- [Xcode upload-complete observation](../../ios/DerivedData/dev-phone-run-20261101/beta-upload-complete.txt).
- [Apple Processing state](../../ios/DerivedData/dev-phone-run-20261101/beta-apple-processing.png) and its [text observation](../../ios/DerivedData/dev-phone-run-20261101/beta-apple-processing.txt).
- [Final Beta Testing / Owner-only assignment](../../ios/DerivedData/dev-phone-run-20261101/beta-owner-testing.png) and its [text observation](../../ios/DerivedData/dev-phone-run-20261101/beta-owner-testing.txt).
- [Actual device-product verification](../../ios/DerivedData/dev-phone-run-20261101/actual-device-product-verification.md) and its [machine-readable record](../../ios/DerivedData/dev-phone-run-20261101/actual-device-product-verification.json), SHA-256 `a6738834173cd590228c6c4ff5680b89bf6f9eb7ba8ef93c0dc55f5d52da7c69`.
- [Final Beta archive verification](../../ios/DerivedData/dev-phone-run-20261101/beta-archive-verification.json), SHA-256 `7deb0b629aaf79d73a574f6f07dfbfee65f1e22c7f25429ac4a910654974afcf`; unchanged archive inventory SHA-256 `2c00b3e8de2c45d14104dea68c2580a6540ebbfcd21af248ead71ca65226fa32`.
- [Distribution payload verification](../../ios/DerivedData/dev-phone-run-20261101/beta-distribution-verification.json), SHA-256 `da34222057c730b05042bbeb182ea70c2343a4372200e77bd46bf5848b713593`, and the [retained signed IPA](../../ios/DerivedData/dev-phone-run-20261101/SpecDown-Beta-1.0.1-228-AppStore.ipa).
- [Source/project and prior README preservation](../../ios/DerivedData/dev-phone-run-20261101/source-preservation.json).

This handoff includes no raw device identifier, email address or certificate secret. Detailed local diagnostics are evidence, not public-release artifacts.

1. Preserve the verified archive and its finalized report as the input to distribution signing/export.
2. Have the owner install **SpecDown Beta 1.0.1 (228)** from TestFlight and verify coexistence, icons, document opening, diagram centering/zoom and Find/keyboard dismissal. Record the exact installed TestFlight build and results separately from the completed Dev checks.
3. Retain the Owner-only testing scope. The completed Beta assignment does not authorize new keys, App Review or public release, and no owner TestFlight acceptance is claimed yet.
4. Final App Review submission remains conditional on acceptance of the exact production-identity TestFlight build. Public release remains owner-controlled.

Repository edits for this handoff are documentation only; application source remains unchanged. No commit or public deployment is included.
