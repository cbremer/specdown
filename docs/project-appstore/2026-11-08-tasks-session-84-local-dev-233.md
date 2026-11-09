# Session 84: fresh local Dev 233 and remaining 1.0.2 acceptance

The owner reports that 1.0.1 is now released on both iOS and the Mac App Store.
This session prepares local development builds for testing the next Store wave.

## Plan and source

1. Check other SpecDown chats, candidate source and current GitHub checks.
2. Rebuild the shared viewer and separate iOS/Mac Dev apps using existing local
   development signing material, with local metadata 1.0.2 (233).
3. Verify packaged content and signatures, install where existing profiles allow,
   and record the remaining acceptance work.

The candidate remains `c0ddabaea9c1cecfbcb6f20b0b05333e74bf3d21` on
`codex/wave-102-starfield-presentation`, stacked on the combined wave in
[#403](https://github.com/cbremer/specdown/pull/403) through
[#404](https://github.com/cbremer/specdown/pull/404). Both PRs are still open.
All six exact-head checks on #404 are successful. Verified main is `431be2f`;
reconciliation with current main remains part of release integration.

The other SpecDown instruction-migration and security/release chats are idle or
not loaded. Their checkouts are outside this build session's changes. Canonical
source remains on `codex/docs-security-privacy-audit` at `5ac3a0c`.

This is a fresh rebuild of the existing candidate, including initial Starfield,
the Basic theme label and draft diagram-presentation copy. Build 233 is local
metadata and does not reserve an Apple upload number.

## Verification and artifacts

- Fresh scoped Jest run: 86 suites, 1,483 tests passed.
- Scoped lint and strict type checking passed.
- Fresh viewer production build passed; the expected direct-channel package
  version 0.0.232 is present in the generated assets. Store metadata is 1.0.2.
- Both native Dev builds completed successfully using the existing development
  certificate and profiles. Strict signature, exact certificate, Dev identity,
  profile and packaged-content checks passed. Each app contains all 110 freshly
  built viewer files; the Mac also matches all 19 desktop source files.
- The native Mac bookmark module matches its source binary in both architectures
  after accounting for signing metadata and the signing allocation size. A raw
  signed-versus-unsigned hash comparison is insufficient for that file.
- Mac Dev 1.0.2 (233) is installed and its process is running. The previous Dev
  232 app bundle is retained for rollback. No app data was reset.
- iPhone Dev 1.0.2 (233) installed successfully after the owner connected and
  unlocked the phone by USB. The first attempt failed during developer-disk-image
  preparation; the underlying reason for that initial setup failure is unknown.
  A launch request after installation was denied because the phone had locked.
  The owner can unlock it and open SpecDown Dev. Feature acceptance remains pending.
- Private build records, source/web manifests and complete logs are retained
  under `ios/DerivedData/wave-102-local-dev-233/`. Existing packaging dependency
  warnings and Vite/test-runner warnings remain in those logs; all listed checks
  and both build commands exited successfully.

The existing iOS Dev profile covers the paired iPhone, but does not cover the
paired iPad. The iPad needs a valid Dev profile covering that device before this
candidate can be installed there. Developer Mode is enabled on both devices.

For iPad installation, open this candidate's `ios/SpecDown.xcodeproj`, select
**SpecDown Dev** and the physical iPad. In the app target's **Dev Debug** settings,
keep `com.mosaicpando.specdown.dev`, use the existing team, set local build 233,
and choose automatic development signing or a valid existing profile covering
the iPad. Resolve any device-registration/profile prompt in Xcode, then Run.
The generated project's source placeholder is still 230; this session used
command-line overrides and did not regenerate the project or change signing
settings. The signed phone artifact cannot be installed on the uncovered iPad.

## What remains for 1.0.2

- Physical iPhone and iPad acceptance of durable recents after app restart,
  moved/deleted documents, denied access and offline/provider behavior.
- Signed sandbox file-provider behavior on Mac, including moves, revoked access
  and offline files. iCloud, Dropbox and OneDrive require individual checks.
- Real-device relative images and PNG/SVG Files/Share flows, including cancellation,
  document switches and adaptive navigation/VoiceOver.
- Desktop annotation recovery using synthetic notes: backup, actual file
  reselection, restore preview, explicit association/reconnect and undo. True OS
  disk/quota failures and worst-case peak-memory stress remain unverified.
- Actual Windows/Linux runtime acceptance where those platforms are in scope.
- Choose one integration path for the combined candidate versus its constituent
  PRs; reconcile main, then run the applicable checks before an authorized merge.
- After acceptance, finish release notes/screenshots and App Store copy, select
  upload build numbers, prepare signed release artifacts, and separately arrange
  any beta delivery and Apple submission.

Native iOS annotation editing remains disabled. Optional email signup is deferred
in [#413](https://github.com/cbremer/specdown/issues/413).

## Owner testing order

1. Open the Dev app and check Starfield, Basic selection persistence, and
   diagram-only Presentation mode with zoom/pan and next/previous navigation.
2. On iOS, open two unrelated files with the same filename, restart the app, and
   explicitly reopen each recent. Try moved and unavailable copies.
3. Open Markdown containing relative raster images, explicitly choose its folder,
   and check tab switches and reopen. Save/share both diagram PNG and SVG files.
4. On Mac, select Light, quit/relaunch, and reset Original. Browse a public GitHub
   repository and a nondefault branch, filter files, and open a document.
5. With disposable notes only, test the full backup/restore/reconnect/undo path.

See the [detailed candidate checklist](2026-11-02-spec-1-0-2-candidate-review.md)
and [36-row recovery evidence](2026-11-02-annotation-recovery-evidence.md).
