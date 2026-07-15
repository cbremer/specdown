# Tasks — Session 27: Desktop Update-Pipeline Repair

**Date:** 2026-07-15
**Scope:** Live-debugging the desktop auto-update path with a real v0.0.154
install — the first time anyone updated from an older signed build. Three
distinct failures were found stacked on top of each other.

## Checklist

- [x] **Diagnose the notarization outage.** Every macOS release job since
      ~v0.0.157 failed with Apple 403 "A required agreement is missing or has
      expired" — an Apple Developer Program License Agreement update pending
      acceptance. Linux/Windows assets kept publishing, so the latest release
      had no `latest-mac.yml` and clients saw a raw 404. **Owner accepted the
      agreement**; v0.0.161 then notarized and published clean.
- [x] **One dialog per failed manual update check.** electron-updater reports
      the same failure twice ('error' event + rejected `checkForUpdates()`
      promise); both paths opened a modal (close one, the next pops). A shared
      `showManualUpdateCheckError()` consumes the manual-check flag once;
      background checks never dialog.
- [x] **Friendly packaging-window message.** The release record is published
      minutes before the platform jobs attach artifacts, so every merge has a
      ~5–15-minute window where update checks 404. Feed 404s now show "the
      newest release is still being packaged — try again in a few minutes"
      instead of an HTTP dump.
- [x] **Fix auto-update downloads (broken in every release to date).** The
      product name "Specdown Desktop" contains a space: electron-builder's
      feed hyphenates it (`Specdown-Desktop-…-universal-mac.zip`) while
      GitHub's asset store dots it on upload (`Specdown.Desktop-…`), so the
      feed URL never matched the stored asset — verified live against
      v0.0.162 (hyphen URL 404, dot URL 200). Explicit space-free
      `artifactName` templates (root/mac/nsis/linux) align feed and asset
      names; fixes already-installed clients too, since the mismatch lives
      inside each release. Static regression test forbids spaces in artifact
      names; README artifact table updated.

## Deferred / options not taken

- **Draft-release pipeline** (publish the release only after all three
  platform uploads finish) would eliminate the packaging window entirely;
  the friendly client message shrinks the pain enough for now.
- **CI guard issue-on-failure for the macOS release lane** — offered, not
  yet requested; would have surfaced the agreement expiry three releases
  sooner.

## Verification

`npm test` — 488 passing (+5: dialog dedupe ×4, artifact-name guard).
Lint 0/0 (enforced), typecheck clean. End-to-end confirmation recorded
against the first release cut after merge (feed URLs return HTTP 200).
