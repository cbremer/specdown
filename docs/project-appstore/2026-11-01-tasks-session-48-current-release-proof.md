# Session 48 — Current iOS and Mac release proof

Chris requested complete artwork, text, images and builds for proof before submission, then explicitly made removal of the diagram link button a submission blocker. The reviewed shared source now removes that action. PNG/SVG export, ordinary document links and bounded incoming legacy links remain supported.

## Current source and canonical project

- Canonical checkout: `<repo>`, branch `codex/local-ios-1-0-1`, commit `b9e54727f3e18d02a874c5de768f6e0e47def493`.
- Canonical Xcode project remains `<repo>/ios/SpecDown.xcodeproj`; ordinary local Run uses **SpecDown Dev**. All six native configurations are **1.0.1 (229)**. The shared source version is 0.0.229.
- The target includes the reviewed native rejected-open/startup recovery, MAS installer permission guards and diagram-link removal. Sessions 44–47 describe those logical changes. No dependency or artwork changes were introduced by the final link removal.
- Final source gates: **1,292 tests / 74 suites**, lint, typecheck and production web build passed. The link correction also passed 157 independent focused checks. Earlier 1,294/73 results belong to the pre-removal version stamp and are not relabeled.

The local fast-forward preserved all **60 owner files**, 460 tracked source objects and 110 web files. The generated Xcode project changed only six literal build-number fields from 228 to 229. Reversing those substitutions recovers the exact prior project bytes; all other generated project/workspace/scheme/Info.plist/UI files and signing settings are unchanged. No XcodeGen, signing, device installation or public merge occurred during promotion.

The initial attempt could not write Git metadata in the normal sandbox. It stopped before the fast-forward; exact held documents and README were restored from verified copies. A new snapshot had the identical hash, and the same reviewed operation succeeded with scoped local Git permission. Both attempt journals are retained. No automatic approval rejection or owner-data loss occurred.

Promotion evidence under `ios/DerivedData/release-proof-20261101/promotion/`:

- `final-canonical-b9e-local-git/snapshot.json`: SHA-256 `24532c42836fd43bbd5d44e385a9cdbd7c6312ba7e6e75cea1783b02fd7267a8`.
- `final-canonical-b9e-local-git/execution-backup/journal.json`: verified complete, with full owner/generated backups and prior web output retained.
- `canonical-independent-verification.json`: SHA-256 `4fef5ab397119b92218779769949de0e05c19acc3dfa91f888e71b2b6cc05763`.
- Root README current-status paragraphs were subsequently updated and duplicate identical Session 37/38 union rows removed; every distinct historical owner row remains.

## Final unsigned artifacts

The frozen inventory `ios/DerivedData/release-proof-20261101/FROZEN-SOURCE.json`, SHA-256 `2d406b497ad884b6ea01e05620ae2f717b255857075f57e705fa91d00f298f77`, binds 460 tracked files, seven generated inputs and 110 web files to the final source.

| Artifact | Verified result | Evidence |
| --- | --- | --- |
| Production iOS device archive | 1.0.1 (229), `com.mosaicpando.specdown`, arm64, iOS 16 minimum, iPhone/iPad, Original plus seven alternatives; exact source/web and matching executable/dSYM UUID. Unsigned, no embedded profile. | `ios-device-1.0.1-229/final-b9e5472/manifest.json`, SHA-256 `f36b5d323b709c36836cd0bbe4da6db6199bfabac72f98a17cd9df0650626747` |
| Production iOS simulator app | Final release configuration, exact 110 web files, correct production identity/version and all icon mappings. Zero compiler errors or warnings. | `simulator-final-verification.json` |
| Universal MAS app | 1.0.1 (229), 127 packaged source files including 110 web files; 8,555 dependency files; 10 universal native binaries; 260 regular bundle files and four internal links. No updater, profile, top-level signature or installer PKG. | `mac/final-b9e5472/manifest.json`, SHA-256 `c6cee0a6230dcfe7f9e13fa9bf47419bcb784e0ccda42df82c8ab924e67cf686` |

These evidence paths are relative to `ios/DerivedData/release-proof-20261101/`. The iOS device build had one expected App Intents extraction notice because the target does not link AppIntents; no compiler errors occurred. Its executable and dSYM UUID is `71384E92-C828-33A4-9C12-26ED392E2F63`.

Independent MAS review (`mac/final-b9e5472/independent/review.json`, SHA-256 `2616a777dacf285938b9a2cd07b43006059eaf991b0437f123687b68becfa724`) compared actual packaged files against Git, the frozen web inventory and all dependency files; both Electron framework slices match the local Electron 44.10.1 MAS archives. All 25,987 physical dependency input entries remained unchanged. The final ASAR hash is `4f534369a0bd848e2ca848c7d28a275004b8c965aee6a6b547900bf67edde564`.

Both final artifacts exclude the unsupported diagram link action. These are unsigned/static and simulator checks, not signed sandbox runtime, TestFlight processing or physical acceptance. Existing direct desktop and Store TestFlight 228 installations remain untouched.

## Artwork, copy and screenshot proof

Session 43 retains exact saved App Store Connect copy and creative-asset evidence. Both 1.0.1 draft listings contain the platform-specific copy and review notes; release remains manual. The approved Halo Header is assigned to the iOS 1.0.1 draft. Apple reference previews on iPhone, Duo outer/inner and iPad light/dark retain the emblem without clipping. The new Halo Search Results adaptation exists as an **unsubmitted, unassigned draft**, awaiting Chris's proof and subsequent creative review.

The proof gallery is `docs/project-appstore/release-proof-2026-11-01/index.html`. Its manifests distinguish `ready_for_proof` from owner acceptance. Five final native iPhone69 screenshots are independently reviewed as opaque 1320×2868 JPEGs. The iPhone63 set needs one lifecycle recapture at lower zoom so the start node is below the toolbar. iPad, Duo and Mac captures remain in progress. Shared iPhone captions describe the actual tables, fullscreen state diagram and dark document appearance without promising dark native status-bar chrome.

The Mac locked during native captures. The owner unlock request remains pending; there were no further UI attempts after the lock report. Proof, artifact and documentation review continued locally. All screenshot devices are newly created isolated QA simulators; pre-existing simulators and physical devices are not used for these synthetic scenes.

## Signing and next gates

`ios/DerivedData/release-proof-20261101/signing/PLAN.md` documents exact retained Mac development, distribution and installer identities/profiles without private-key access. A production iOS App Store profile matching the existing distribution certificate has not yet been established; the `.beta` profile cannot substitute. Production export must use manual signing, retain version/build 1.0.1 (229) and set internal-only testing **false** so the build remains eligible for later App Review. Owner-only group assignment controls tester access separately.

The earlier explicit signing/upload grants applied to build 228. A single request is pending for using existing certificates, a matching production iOS profile if necessary, local 229 QA and Owner-only TestFlight uploads of both final 229 candidates. No 229 signing, account/profile change, upload, App Review, creative review submission or public release has occurred at this checkpoint. No new keys are requested.

Unexecuted, guarded signing inputs are now prepared under `signing/ios229/` and `signing/mac229/` in the same ignored evidence area. iOS manifest SHA-256 is `cac68c8052ad2fc125ed8d35581ba2feee7121e46c293e9281e32dbf8ab50db7`; Mac wrapper manifest SHA-256 is `e99b5e618208e9f451a379bb395d75929846932c17ce43f96fc458bef1826ff1`. Syntax/static validation passed. Mac input validation also confirms all 460 source, 110 web and 25,987 physical dependency entries plus cached native inputs. These checks did not read provisioning profiles or Keychain, activate signing, build or launch anything. Owner authorization and exact verified production iOS profile inputs remain unresolved; exported/signed artifacts still need independent verification afterward.

Remaining work: finish native screenshots after unlock; perform approved existing-key signing and exact signed artifact verification; complete local Mac recovery/export QA; upload only to Owner TestFlight; replace screenshots/attach the exact passing builds in the drafts; obtain owner copy/artwork and physical iPhone/iPad/Mac TestFlight acceptance before submission. Broad annotation recovery WK-18 remains deferred; native iOS annotations remain disabled.

The Launch Weekend tracker now records canonical 229 preparation and the corrected artifact evidence for WK-10, WK-12–15 and WK-31–33. WK-33 is **Ready for review**, with final TestFlight absence of the link still part of the submission gate.

## GitHub review publication gate

A fresh read-only GitHub audit found existing draft #343 at exact `729258b` with successful checks. None of the six later local commits is published. Six one-commit draft PRs are prepared under `ios/DerivedData/release-proof-20261101/git-review/`, extending #343 through `b512db3`, `eed62c9`, `00da12e`, `0370329`, `bb59e16` and final `b9e5472`. Their descriptions and direct-parent ranges are reviewed. Live main is `5ce94677ee945335d2cd2cb4eec83f25a43db92f`; it is intentionally not merged or rewritten into this frozen candidate. The older published ancestor focus branches must not be replayed twice.

Automatic approval review rejected publishing those six branches before execution because explicit owner authorization is required for sending that source payload to GitHub. No new branches were created or pushed, no PRs opened, and no alternate tool or workaround was attempted. A precise owner question is pending for six `codex/release-review-*` branches and draft PRs in `cbremer/specdown`, excluding merge/deploy/signing/release. Rejection evidence is `git-review/execution/approval-rejection.json`. This is separate from the pending existing-certificate 229 signing/TestFlight permission and Mac unlock.

All four new screenshot simulators were returned to Shutdown while waiting. A state comparison confirms all 88 pre-existing simulator states are unchanged (`simulator-checkpoint-locked.json`). The old bounded weekend automation was also checked: it already does not exist, so no further scheduled runs were created or extended.
