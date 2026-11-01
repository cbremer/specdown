# Session 32: independent iOS development and beta installs

Chris approved documenting and implementing separate production, local development and TestFlight beta identities, with a reversible path back to the original workflow. The complete contract and owner setup are in [iOS development channels](2026-10-31-spec-ios-development-channels.md).

## Implemented

- One source target with three shared schemes: `SpecDown Dev`, `SpecDown Beta`, and production `SpecDown`.
- Six configurations keep existing production `Debug`/`Release` intact and add `Dev Debug`/`Dev Release` and `Beta Debug`/`Beta Release`.
- Bundle IDs `com.mosaicpando.specdown.dev`, `.beta`, and original `com.mosaicpando.specdown`; native source version remains 1.0.1 (228).
- Display names identify each installation. Dev defaults to existing Flat artwork, Beta to existing Light, production to Original. Every channel offers all eight choices with the correct primary reset mapping; no artwork bytes changed.
- Shared viewer, internal origin, native document security and production/MAS identity remain unchanged. No shared data container or migration was added.
- CI verifies generated scheme/config identities and compiled bundle metadata. The production release-validation workflow now explicitly rejects a non-production bundle ID.

## Validation and provenance

The feature starts at reviewed `b157b29d6e4eeb36628ee6def166fda6da92eace`; final commit identity is retained in `ios/DerivedData/ios-channels-20261031/COMMIT.json`. Review work remains inside `.claude/worktrees/specdown-ios-channels-20261031` and the canonical owner project remains `/Users/chrisbremer/code/specdown/ios/SpecDown.xcodeproj`.

The full shared suite passed **1,128 tests / 67 suites**, plus lint, typecheck, icon export verification, native security checks and all 24 channel/artwork mapping checks. Actual unsigned generic-simulator builds passed for `Dev Debug`, `Beta Release` and production `Release`. The first simulator attempt was blocked by the host sandbox's SwiftUI compiler-service restrictions; the identical signing-disabled builds passed with scoped local execution access. No app security protection was removed.

The shared viewer source and dependency manifests are unchanged. The previously verified 110-file production web output was copied exactly for review builds rather than rebuilding identical assets. Build logs, compiled-identity verification, independent review, canonical project preservation and owner backups are retained under `ios/DerivedData/ios-channels-20261031/`.

Seventeen verifier regression controls passed, including incorrect production identifiers, Beta Archive mapped to production Release, wrong icon mappings, weaker ATS/document support and stale web output. All six generated configurations, all three schemes and all three compiled apps passed the verifier with explicit 1.0.1 (228) and 110 matching web files.

An independent smoke check installed and launched all three apps on a new isolated iPhone 17 Pro / iOS 26.4.1 simulator. All three identities and display names coexisted, all three processes remained running, and their data-container paths were distinct. No container contents were read. The QA simulator was returned to Shutdown and pre-existing simulator states were unchanged. This establishes simulator coexistence, not physical phone icon switching or TestFlight acceptance. Evidence: `coexistence/result.json` and `coexistence/commands.json` in the session evidence directory.

Project generation is staged and independently compared before canonical promotion. Preserve existing owner signing/team settings and workspace/UI state. Never copy a production-specific profile UUID or specifier into the Dev/Beta configurations. Root README owner entries and all original local artwork/copy/session files remain preserved.

## Owner follow-through

Use `SpecDown Dev` for everyday local Run. The owner completes identifier/provisioning setup for `.dev` and `.beta` and creates a separate Beta App Store Connect record before a Beta TestFlight upload. Existing suitable certificates may be reused. No registration, account login, key generation, signing, physical-device installation, upload or submission is performed by this implementation session. The isolated unsigned simulator installations above are the only new installs. The preceding owner-authorized Run of the earlier production candidate is historical and does not validate these separate phone installs.

Physical checks must verify the three apps coexist, preferences/recents remain separate, each icon can switch/reset, and deliberately selected external documents still open. Final release acceptance uses an exact production-identity TestFlight build before App Review; a Beta upload cannot substitute for that build.

To abandon the setup, select the production `SpecDown` scheme and leave the additional configurations unused, or revert this one logical source change. Existing production identity is unchanged. Account reservations and separate app data do not automatically roll back or merge; preserve needed data and decide about deleting installations or account records separately.
