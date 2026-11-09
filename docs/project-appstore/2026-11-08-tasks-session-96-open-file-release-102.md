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
remain ignored. Signed package verification and affected screenshot refreshes
are in progress. Native artifact and provider evidence belongs in ignored local
build records. Preparing new packages does not submit the app for review or
publish a release.
