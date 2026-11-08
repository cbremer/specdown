# Session 82: local Dev 1.0.2 (231)

Chris requested local Dev builds for testing. Both apps use the existing
development certificate and device-restricted Dev profiles. This session does
not authorize Beta delivery, App Review submission or public release.

## Source and build identity

- Source: `codex/wave-102-integration` at
  `2297953c7c77b1692bbf3b73246c148a217cb4c5`, matching the reviewed candidate's
  application source. All 691 tracked files matched before and after building
  and installing; the existing untracked dependency symlink was retained.
- Local build metadata: **1.0.2 (231)**, overridden only in build commands and
  an ignored local packaging config. This is a local Dev number, not an Apple
  build-number reservation. Tracked Store configuration still has placeholder 230.
- The canonical checkout remains clean at
  `9d27fc1a6961e29c86def43cee17c6fbb7d66db1`; it was not updated or regenerated.
- Fresh shared web build and XcodeGen ran in the isolated wave worktree.
  No dependencies were installed or changed. The Mac bookmark module was
  compiled for arm64 and x86_64; the local Mac app uses Electron MAS 45.1.0 arm64.

## Installed apps

| Platform | App | Result |
| --- | --- | --- |
| iPhone Z | SpecDown Dev, `com.mosaicpando.specdown.dev` | Installed metadata confirms 1.0.2 (231); device launch succeeded. |
| This Mac | `<user-applications>/SpecDown Store Dev.app`, same Dev bundle ID | Installed copy matches all 274 signed files/links; strict signature passes and the updated welcome screen is visible. |

The previously running Mac Dev 1.0.1 (230) was observed at its welcome screen,
quit normally, and moved to the retained rollback copy before installation.
Production and direct-desktop Info.plist/ASAR hashes were rechecked unchanged.
No app data was reset or migrated by an installation script. Owner functional
acceptance of the updated apps remains pending.

## Verification and retained local evidence

Evidence directory in this worktree:
`ios/DerivedData/wave-102-local-dev-231/` (ignored, local only).

- Both apps passed strict code-signature verification. Extracted leaf
  certificates match existing Apple Development identity
  `A053B0045AF48141A17DE1EBB3EE861672EDB986`; embedded profiles match the
  verified input bytes, intended Dev identity and team `582YQWPT9G`.
- iOS development debugging entitlement, channel identity, Flat primary icon,
  seven alternate icons per family and all 110 bundled web files verified.
- Mac sandbox and Dev application group verified; all 110 packaged web files
  and 19 desktop source files match the candidate. The native bookmark module
  is present outside ASAR with both architecture slices.
- The installed Mac Dev app visibly displays Browse Files, Open Folder, Try
  diagram showcase and the updated public GitHub repository/branch/folder URL
  guidance, without a launch prompt. This confirms initial UI launch, not the
  owner functional checklist.
- Logs, profiles' public metadata, installed metadata, launch results, source
  and web manifests, content verification and installation/rollback paths are
  retained alongside `BUILD-RECORD.json`.
- iOS emitted the existing AppIntents metadata warning (no AppIntents.framework
  dependency), with no build error. Mac packaging reported dependency discovery
  warnings for the shared dependency symlink; packaged required application
  files were checked directly. The initial welcome UI was observed; feature
  acceptance is a separate check. A System Events window check was denied
  assistive access; the existing computer-use API then verified the welcome UI
  without changing system permissions.
- Certificate/profile signatures and artifact identity checks do not establish
  independent online revocation verification. No certificate, key, profile or
  Apple account configuration was created or changed.

## Testing handoff

Open **SpecDown Dev** on iPhone Z and **SpecDown Store Dev** on this Mac. Confirm
**1.0.2 (231)** when reporting an issue. Use the
[candidate owner checklist](2026-11-02-spec-1-0-2-candidate-review.md#owner-review-before-release-preparation)
for recents/restart, image-folder access, PNG/SVG exports, GitHub browsing,
desktop icon choices, synthetic annotation recovery and existing zoom/Find/live
reload behavior. Physical iPad and provider-specific acceptance remain open.
Keep annotation recovery tests on disposable notes.

The earlier phone certificate-extraction invocation used the wrong option form;
it was corrected and the exact certificate fingerprint verified. Its preceding
strict signature, identity/profile and compiled-content checks had passed.

No merge, upload, TestFlight delivery, Store submission or public deployment
occurred. The other SpecDown release chat was checked read-only and remained idle.
