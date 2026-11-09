# Session 94: Mac App Store availability copy

## Scope

The owner requested that the review and current copy describe the Mac App Store
edition as live. Both iOS/iPadOS and macOS 1.0.1 (230) were observed as Ready for
Distribution in App Store Connect. Version 1.0.2 (240) remains a pending update;
this copy correction does not claim that 1.0.2 has shipped.

## Changes

- Replace the homepage and public support page's coming/TestFlight-only and
  upcoming Mac wording with present-tense availability and the public Store link.
- Add the Mac App Store distribution option to the root README.
- Refresh the current review-notes source with the exact existing iOS/Mac 1.0.2
  review notes plus a clear published-1.0.1 / pending-1.0.2 introduction.
- Update the asset/project entry points and mark the October copy review as a
  historical pre-release discussion with a pointer to current review notes.
- Keep the frozen build-240 checkout and signed artifacts intact by preparing
  these copy-only changes on a separate branch based on current main.

## Validation and delivery

Baseline checks passed: 81 suites / 1,443 tests. The baseline reports an existing
MaxListenersExceededWarning; it is unrelated to this copy-only change.
The public Mac Store link returned HTTP 200 and listed version 1.0.1. Both
1.0.2 App Review note fields were updated and saved; exact readback matched the
platform-specific sections in `app-store/metadata/review-notes.md`. No other
listing fields, screenshots or build selections changed.

The copy change passed 81 suites / 1,443 tests, lint, strict types and the web
build. Scoped Prettier checks pass for support HTML, current review notes and
this new session record. The four touched historical Markdown documents already
fail whole-file Prettier on main; their existing layout is preserved. Whitespace
and current-copy availability checks pass. The built support page was visually
reviewed in a local-only preview. Website publication remains pending source
merge; App Review submission and native rebuilding are separate actions.
