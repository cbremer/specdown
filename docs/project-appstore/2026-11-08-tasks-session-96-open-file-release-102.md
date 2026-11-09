# Session 96: Include Open File in 1.0.2

## Scope

The owner confirmed that the Open File wording should ship in version 1.0.2.
Prepare fresh native packages and refresh screenshots containing the affected
labels. Keep the uploaded build-240 source and artifacts as historical evidence.

## Integration

- Start from the exact build-240 source, including the visible GitHub-download
  error correction.
- Integrate the already-published Mac App Store availability copy and the approved
  Open File wording from PR 423. Preserve both project-history timelines.
- Keep web, direct desktop, Mac App Store and iOS file-opening behavior unchanged.
- Use 1.0.2 build 241 for the refreshed candidate; maintain distinct production,
  Beta and Development identities.

## Validation and delivery

Integrated source passes 89 suites / 1,527 tests, scoped lint, strict type checks
and the web build. The existing generated-project and native-package outputs
remain ignored. Production and internal Beta packages for iOS and macOS were
signed, verified and uploaded successfully. Both production drafts now select
1.0.2 (241) with manual release. Both Beta builds are Testing in the existing
one-tester Owner group, with fresh testing notes.

The signed application payloads were built from commit
`b11b25594e5f093ca8152d9225200a9d75736257`. This delivery record and the Mac
reviewer-instruction wording are documentation-only follow-ups.

Eleven affected screenshots were refreshed and uploaded. The saved listing
retains eight images each for iPhone, iPad, iPhone Duo and Mac, in the intended
order. Reviewer instructions use Open File on both platforms. Native artifact
and provider evidence remains in ignored local build records.

Owner functional acceptance of build 241, source merging, App Review submission
and public release remain separate, unfinished steps. No physical-device Dev
installation or installed Mac Dev replacement was performed for build 241.
