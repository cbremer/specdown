# Session 40: Mac TestFlight preparation

Date: November 1, 2026. Status: **Apple validated Mac 1.0.1 (228); Owner-only TestFlight is Testing and What to Test notes are saved. Physical Mac TestFlight acceptance remains pending.**

Chris accepted continuing testing through TestFlight and requested a submission-ready Mac candidate. Use the reviewed `eed62c9911d0477386c8dc3fd1a76a6a2db498f1` source with MAS-only version **1.0.1 (228)**. Root phone checkout stays `729258b`; the installed direct-download app stays separate. Existing source/test evidence remains applicable (1,183 tests / 69 suites, lint/type checking, independent review); no unchanged tests are repeated.

## Browser and Apple boundaries

Chris clarified that the current signed-in browser is **Comet**, not Chrome. Preserve the exact existing session/tab. If it signs out, stop Apple portal work for owner sign-in; never retry authentication or switch profiles/browsers. The tool's browser-family label is not authority to change this preference.

The existing production SpecDown record now has a macOS draft, with **1.0.1** saved and **manual release** selected. The iOS live version is unchanged. This is draft preparation; no App Review submission or public release is authorized here. Existing identities/profiles are reused; no new keys or credentials are created. TestFlight acceptance precedes App Review.

## Candidate preparation

Source worktree: `.claude/worktrees/specdown-mas-local-20261101`, clean branch `codex/mas-startup-delivery` at `eed62c9`. New output/evidence: `ios/DerivedData/mas-testflight-1.0.1-228-20261101/`. Both cached Electron 44.10.1 MAS architecture archives match prior reviewed hashes. The physical dependency tree and reviewed universal bookmark addon are retained. The existing macOS Store profile is byte-identical to verified Session 36, contains the correct app/team/certificate, and has no device list.

A local overlay enables universal MAS distribution packaging with force-signing, the shared team qualifier, the explicit existing Store profile and login keychain, and publishing disabled. It reuses the owner-created Apple Distribution and Mac Installer Distribution identities. The app now passes deep/strict verification against the exact existing Apple Distribution certificate, embedded profile, sandbox/no-debug entitlements and version. All 10 native binaries are universal arm64/x86_64 and signed with that identity. Source validation matched 126 application/web files and 8,555 production dependency files; updater/feed are absent. The ASAR hash is `b299e08b4bd6f8d54e135ee877a2ec8221d879b37133aaef20c6847aa394dcf7`. Installer signing and independent exact-payload verification subsequently passed, as recorded below.

Mac profile `beta-reports-active` is absent; current Mac-specific guidance did not justify adding it speculatively. Apple subsequently validated this package and made it available to Owner-only TestFlight without that speculative change. No Store application has been launched locally, and the existing development test app remains untouched.

Known residuals are WK-18 annotation identity/recovery and WK-31 visible rejected-file feedback. Intel/minimum-OS runtime and actual TestFlight behavior remain unverified. Transporter is installed, and Chris confirmed that it is signed in.

## Owner action during installer signing

During initial installer signing with the existing Mac Installer Distribution identity, `productbuild` presented a protected macOS SecurityAgent prompt. Computer-use policy disallows opening that protected app; the agent did not inspect it or enter a password. Chris was asked to enter the login-keychain password locally and choose Allow for this specific request. This is not a new key, changed password or a portal login. Chris selected Allow locally, and the build completed successfully. The prompt is resolved; no credential was entered by the agent.

The exact tracked source archive and TestFlight acceptance notes are retained with the candidate. Transporter confirms delivery of the corrected package, as recorded below; no remote merge or public release has occurred.

## Completed package and preservation

The original `SpecDown-1.0.1-universal.pkg`, retained as rejected-attempt evidence, is **283,004,921 bytes**, SHA-256 `5465f128beb213909bf421d11962f5f4038c3f1b7a77a4382712f3d88f64e761`. The installer uses the exact previously restored Mac Installer Distribution identity and Apple WWDR/Root chain. Host `pkgutil --check-signature` passes; its literal Store-certificate classification includes `(Development)`, so it is not mislabeled as Developer ID/notarization evidence. Independent extraction confirms the installer certificate matches the expected original.

All **268 payload files and 4 internal links** exactly match the verified signed app. The installer contains only SpecDown.app, targets /Applications, and has no installer scripts. Package version is the marketing version **1.0.1**; embedded app build is **228**. Initial harness text/version assumptions were corrected without modifying the artifact. The initial independent byte/link/signature review passed; subsequent Apple validation found the permissions defect described below.

The owner archive packet is `[owner-local path omitted]`. Its inventory and byte-copy verification are retained in the canonical evidence directory. Source is archived, not moved; the working source remains under the repository. All 471 prior root file hashes except the additive documentation index remain exact. All 286 installed direct-app entries remain unchanged. No live document/note-store files were read.

The earlier TestFlight view showed the existing iOS uploads. Chris subsequently explicitly approved: **"Approved; Transporter is signed in"**. This authorizes uploading the verified Mac **1.0.1 (228)** package to App Store Connect record **6822086808** and distributing it to **Owner-only TestFlight**. App Review submission and public release remain excluded.

Transporter is installed and signed in. The initial package selection and window-foreground issue preceded the rejected upload described below. The macOS draft and manual-release setting were saved in the same existing Comet session; no sign-in retry or browser switch occurred after Chris's clarification. This activity update changes only the working Session 40 document; the archived `SESSION-40` snapshot and original candidate artifacts remain immutable.

## Transporter validation and scoped correction

Chris explicitly approved upload and Owner-only TestFlight distribution. Transporter displayed SpecDown **1.0.1 (228)** for record **6822086808** before Deliver was clicked. Apple rejected this attempt with **90255**: an installed file would be readable only by root. No authentication retry, App Review submission or public release occurred. The original signed package and archived preparation packet remain intact as rejected-attempt evidence.

Inspection found exactly one restricted app file: `Contents/embedded.provisionprofile` was mode `0600`. The installer BOM made it root-owned and also included a matching restricted AppleDouble metadata entry. `osx-sign` preserved the private source profile's permissions when copying it into the public app bundle. The earlier byte/link/signature verification did not detect this permissions defect.

Future MAS builds must set **only the embedded public profile** to `0644` after embedding, never change the private source profile's permissions, and gate delivery on public file readability, directory traversal and root ownership across the **entire installer BOM**, alongside content and signature verification. The one-off correction for this exact `eed62c9` package passed those checks; no persistent source hook has been implemented.

A new `permissions-retry` candidate copies the exact signed app and changes **only the embedded public profile** to `0644`. All 268 file contents and four link targets are unchanged; the original private profile remains untouched. Host deep/strict verification and all ten universal native signatures pass without re-signing the app. Independent corrected-app review confirms all 20 arm64/x86_64 CDHashes are unchanged and all 315 directories are readable/traversable. No source or app behavior change is involved. See `upload-attempt-1.json` for the historical failed attempt.

## Permissions correction completed; Transporter delivery confirmed

Chris allowed the replacement installer's local `productbuild` request, and signing completed with exit **0** using the existing installer identity. No password was read or entered by the agent. The corrected package is **282,510,951 bytes**, SHA-256 `3ce91397ff26f84bce4d2e6e0ad602054f06f56a13fb09d7be07d6797d6560de`.

Independent verification passed all **1,175 BOM records**: the embedded profile and its generated companion are both `0644`; all **268 payload files, 4 link targets and 20 architecture CDHashes** remain exact. The original package is preserved. The independent report SHA-256 is `8fac9efde716408ecd00e68ae62ffeb8f5950317cf12b2525846bf532793f6bd`. A **12-file, hash-verified additive archive** is retained under the existing owner packet's `permissions-retry/` directory; the original archived records remain unchanged.

Transporter loaded the corrected package and replaced the rejected queue entry. Automatic approval review blocked the coordinate-based **Deliver** click because a named target was unavailable, so Chris pressed **Deliver** locally; that handoff is resolved. Transporter now shows **Delivered — November 1, 2026, 12:53 PM** for SpecDown **1.0.1 (228)**, App Store Connect record **6822086808**, using corrected package SHA-256 `3ce91397ff26f84bce4d2e6e0ad602054f06f56a13fb09d7be07d6797d6560de`. Evidence: `ios/DerivedData/mas-testflight-1.0.1-228-20261101/permissions-retry/transporter-delivered.jpg`.

Immediately after delivery, Apple listed macOS **1.0.1 (228)** as **Processing** (build ID `7a9d8b65-3b74-49ad-bb90-2f0d16be2e98`, upload time November 1 at 12:53 PM). That historical processing state is preserved in `permissions-retry/apple-processing.json`, `.txt` and `.jpg`; it is superseded by the completed validation below.

## Apple validation and Owner-only TestFlight confirmed

Apple's build metadata now reports **Binary State: Validated**, bundle **`com.mosaicpando.specdown`**, version **1.0.1**, build **228**, minimum **macOS 13.0**, architectures **x86_64 and arm64**, and **nonexempt encryption: No**. The Mac build ID is **`7a9d8b65-3b74-49ad-bb90-2f0d16be2e98`**.

Build details show exactly **one group: Owner / Internal / 1 tester**, with **0 individual testers**. The Owner group's Builds list now contains 12 builds, with macOS **1.0.1 (228)** at the top in **Testing** status and an indicated expiry of **90 days**. Apple assigned the build automatically; no duplicate assignment was performed. The **What to Test** checklist was saved successfully, with the UI confirming **Saved**.

Evidence under `ios/DerivedData/mas-testflight-1.0.1-228-20261101/permissions-retry/`: `apple-validated-metadata.txt`, `apple-owner-testing.jpg` and `.txt`, and `apple-owner-test-notes.jpg` and `.txt`.

**Remaining gate: install and accept the delivered build through TestFlight on the physical Mac.** Apple validation and Testing status do not establish runtime acceptance; Intel/minimum-OS testing and the known residuals above remain unverified. **App Review submission and public release have not been performed and remain excluded from this authorization.**
