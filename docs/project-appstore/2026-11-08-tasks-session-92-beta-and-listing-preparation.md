# Session 92: 1.0.2 Beta and listing preparation

## Authorized scope

The owner requested current-build screenshot capture and authorized new Beta
builds, TestFlight upload and release-page preparation using the existing
App Store Connect login. This is separate from merging to main, submitting to
App Review or manually releasing a public version. Screenshots remain review
candidates until reviewed.

## Source checkpoint

The isolated combined candidate is `16f2cea71189ef96f0f0d135da413018709923cd`
on `codex/release-102-candidate-20261108`, based on current main
`a43c96197a684a9bfbbeb3dd0ca2b766c5c65cd3`. It preserves all 153 application
file hashes represented in the Dev 238 manifest. Current-main security and
instruction updates are retained. Shared checks passed: 89 suites / 1,524 tests
with the desktop coverage gate, lint, strict types, web build and diff checks.
The canonical checkout and original dirty development worktree were preserved.
The exact frozen candidate was pushed and opened as
[draft PR #419](https://github.com/cbremer/specdown/pull/419). No merge or web
deployment is recorded. The later exact-head readback confirms all **11 remote checks passed**, including
iOS Simulator, Windows Tests, all three unsigned desktop packaging jobs and
CodeQL. The PR is mergeable and remains draft; it was not merged.

## App Store Connect checkpoint

- Production SpecDown (`6822086808`): iOS and macOS **1.0.1** were confirmed
  **Ready for Distribution**. New iOS and macOS **1.0.2** drafts are now
  **Prepare for Submission**. English U.S. descriptions, promotional text and
  What's New were saved from the 1.0.2 draft copy packet. The descriptions
  include diagram Presentation mode and the Starfield / Basic theme wording.
- Manual release, inherited screenshots and existing review/privacy/contact
  settings were preserved. No build is selected, and Add for Review was not
  clicked.
- Live upload histories were inspected for production and the separate Beta
  record (`6829391032`) on both platforms. Latest uploads were **230**, all
  Complete; no newer or pending upload was observed. This is not a reservation.
- The next Beta artifacts are being prepared as **1.0.2 (239)** for both
  platforms, using their existing separate `.beta` identities and credentials.
  Signing, upload, Apple processing and Owner availability must each be recorded
  separately after observation.

## Screenshot checkpoint

Existing 1.0.1 artwork remains intact. New captures must depict actual current
UI and synthetic example documents. Save raw captures and provenance before
making any marketing composition or upload. Review current iPhone, iPad and
Mac states, especially Starfield, diagram Presentation and the new URL entry.
Portal proof stays in ignored local evidence; it must not enter public Git.

Three actual current Dev 238 mobile captures are retained for review: the iPhone
URL sheet with the keyboard visible, iPhone diagram Presentation mode, and a
fresh 13-inch iPad Starfield welcome screen. Selected native JPEGs have no alpha;
full resolutions are 1179 × 2556 (phone) and 2064 × 2752 (iPad). The captures use
bundled examples and an empty-field example URL, not owner documents. No image
was generated or pixel-edited. A private review gallery and SHA-256 manifest
bind the images to the tested source. No screenshot was uploaded.

Both Beta 1.0.2 (239) artifacts are signed and statically verified from the
frozen candidate. iOS IPA SHA-256:
`6d18d092b5967e26c214cd38d1d601a329f4f5c22cb001af373bec6d5d1c717e`.
Universal Mac package SHA-256:
`91f60e113e52a4850835ca597ecf7533635aff93bdc99d6c361ab8af16d4da2a`.
The iOS export is restricted to internal TestFlight testing. Mac package checks
include the actual signed payload, sandbox/helper identities, universal native
binaries and installer permissions. These are artifact checks, not runtime
acceptance.

The desktop remained locked during native screenshot/Transporter preparation;
the owner reported Screens Connect was unavailable. Standard Xcode upload used
the existing account successfully, without requiring native desktop access.

For iOS, Xcode reported Upload succeeded / Export succeeded at 4:09:50 p.m.
local. Apple completed processing and exposed 1.0.2 (239), build ID
`b5a7197a-debe-4651-8bf8-366cc739328e`. What to Test was saved. Automatic
approval review initially rejected Owner assignment because upload permission
did not explicitly authorize tester access. The owner then explicitly approved
both platform 239 builds to the existing one-tester Owner internal group.
Both platforms now confirm **Testing / Owner**, and each build detail confirms
**Owner / Internal / 1**, with What to Test saved. The Owner Builds view shows
both **iOS 1.0.2 (239) Internal / Testing** and
**macOS 1.0.2 (239) Internal / Testing**. The group remains one tester and five
retained builds, including older 228/230 products. Owner functional acceptance
remains pending. No App Review submission or public release occurred.

## Advisory integration review

Codex `release_integration_review` completed a read-only review of `16f2cea`.
It confirmed preservation of current-main instructions/security/dependencies
and found one proposed P2: an initial iOS GitHub chooser file-fetch error can be
written into the hidden inline URL error section. The causal path was inspected
in source, not reproduced at runtime. It is recorded in
[the review log](../reviews/REVIEW_ISSUES.md), with no implementation authorization
or change to Beta 239. The Copilot request attempt returned success, but no assigned reviewer or
completed Copilot review was present on the live readback. These advisory states do not block authorized Beta delivery.

## Mac upload route

With native desktop access still locked, the standard Xcode Mac application
archive/export flow was validated locally around a copy of the already verified
Electron MAS app. This is documented as a manually assembled prebuilt-app
archive, not an app built by an Xcode target; no dSYM was invented. An exact copy
of the existing cached Beta profile was placed in Xcode's standard UUID lookup
cache, preserving any existing entry and without a portal/key/profile change.

Local export passed verification of entitlements, profile, source ASAR, identity,
version/build and all 332 native sections across 20 architecture slices. Xcode
adds `TFInternalTestingOnly=true` and re-signs the copied payload. Original
artifacts and frozen source remain unchanged. The export-only package is
258,950,933 bytes, SHA-256
`d9916194812daf909dc08c6e3e17d57a361df02f6fab669f495dcdb9a2fcf81a`.

The upload export retains exact manual signing, 1.0.2 (239) and internal-only
restrictions, using the existing Xcode account. Xcode confirmed upload success
at **4:22:55 p.m.** local. Apple completed Mac processing, build ID
`1a6c08da-b66f-4009-9e9c-577d02d4237e`. The approved Owner assignment is complete,
and the final Owner group view confirms both platforms Testing. The Mac screenshots
can wait; existing Store artwork was independently confirmed inherited in all
five-image platform sets.

## Remaining release decisions

- Owner functional acceptance of the two Beta239 products remains pending.
- The proposed initial GitHub file-download error visibility correction requires
  explicit approval before implementation; it is not part of frozen Beta239.
- Production-identity Store artifacts, build selection and App Review submission
  remain separate steps after the candidate decision/testing. The production
  1.0.2 pages are saved drafts with inherited screenshots and manual release.
- Draft #419 is unmerged. Direct desktop source/package checks are current;
  its next signed public release still follows its own version/tag workflow.
