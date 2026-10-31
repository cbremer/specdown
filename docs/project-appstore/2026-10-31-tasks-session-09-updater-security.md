# Session 09: direct desktop updater cache validation

Date: 2026-10-31. Base candidate: `069486c`. Branch: `codex/weekend-updater-cache`.

## Problem and change

The direct desktop candidate still used electron-updater 6.8.9. A cached `update-info.json` could name a file outside the pending update directory, and a missing filename could reach path handling instead of being treated as corrupt metadata. Version 6.8.11 rejects missing, empty, non-string and path-valued filenames before resolving or hashing a cached installer, then clears the invalid pending cache.

Raise the manifest minimum to `^6.8.11` and lock exactly 6.8.11. No other installed dependency version changes. The reviewed app-builder-lib 26.18.1 and its strict version/source guard are preserved. The earlier build-tool overrides also remain intact.

This affects the direct Electron updater. The Mac App Store package excludes electron-updater and disables update checks; web and iOS do not use it. The prior zero runtime npm audit did not establish that every upstream security hardening change was included. This follow-up is based on the upstream behavior fix, without claiming a separately published CVE/GHSA.

## Upstream evidence

- [electron-updater 6.8.11 release](https://github.com/electron-userland/electron-builder/releases/tag/electron-updater@6.8.11): cached update filename validation is the patch change.
- [Upstream PR #10300](https://github.com/electron-userland/electron-builder/pull/10300): v26 backport of #10115; describes rejecting paths that leave the pending update directory and preserving normal cache reuse.
- [Exact upstream commit e5e3b4143484b68cd2a08c2c0a5eda7f5465c4cf](https://github.com/electron-userland/electron-builder/commit/e5e3b4143484b68cd2a08c2c0a5eda7f5465c4cf): adds type, nonempty-string and platform basename checks in `DownloadedUpdateHelper`, with upstream regressions.

## Verification

The new integration suite loads the actual installed `DownloadedUpdateHelper`, using inert files in a private temporary directory. It checks traversal to an existing outside file with a matching checksum, malformed and absolute filenames, pending-cache cleanup, preservation of the outside file, and successful normal cache reuse. File hashing is observed directly; no updater network request or installer execution occurs.

- Clean `npm ci` passed and ran the unchanged postinstall guard, confirming reviewed app-builder-lib 26.18.1. Only electron-updater's installed version changed.
- The new suite passes **8/8** against 6.8.11. Running the same tests against the existing 6.8.9 dependency produces **6 failures / 2 passes**, including acceptance of the outside-file traversal; the valid-cache control still passes. No source or dependency downgrade was needed for this comparison.
- Full `npm run test:ci -- --roots ./tests`: **854 tests / 53 suites**, with coverage thresholds passed. Lint, typecheck, production build and `git diff --check` passed.
- `npm audit --omit=dev`: **zero advisories**. Full toolchain remains **17 (12 moderate, 5 low)**, with the previously documented upstream constraints unchanged.

## Boundaries and follow-up

All implementation and testing runs on this Mac in an isolated worktree, with public upstream/npm references and connected project services only. No other computers, Apple login, keys, signing, UI unlock, deployment, upload or release actions are involved. Dependabot PR #320 overlaps this update; PR #316's grouped runtime/tooling changes and Chokidar/Marked updates are separate work. No dependency PR was merged, closed or commented on.

The tests establish cache validation behavior, not a production update download/install or signed release. Release-candidate packaging and owner-controlled publication gates still apply.
