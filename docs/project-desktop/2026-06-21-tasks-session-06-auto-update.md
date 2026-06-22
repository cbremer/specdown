# Session 06 — Desktop auto-update (electron-updater)

**Date:** 2026-06-21
**Type:** tasks
**Surface:** desktop (Electron) — macOS / Windows / Linux.

## Goal

Turn the already-published signed DMG / NSIS / AppImage into self-updating apps
by wiring `electron-updater` to the GitHub Releases the pipeline already
produces. No new distribution infra — just the update feed + app-side check.

## Changes

- **`desktop/main.js`** — `initAutoUpdater()`: lazy-requires `electron-updater`
  (so unit tests, which mock electron but not the updater, never load it), routes
  updater logs into the existing user-accessible log file, and calls
  `checkForUpdatesAndNotify()` after the window is created. Guarded by
  `app.isPackaged` (no update feed in dev) and an `SPECDOWN_DISABLE_UPDATER=1`
  escape hatch. Downloads in the background; installs on next quit with a native
  OS notification when ready.
- **`package.json`** —
  - added `electron-updater` (`^6.8.9`, pairs with electron-builder 26),
  - added a `publish` provider (`github` cbremer/specdown) so electron-builder
    generates the `latest*.yml` update feeds,
  - macOS target is now `["dmg", "zip"]` — electron-updater downloads the **zip**
    (not the dmg) for macOS updates.
- **`.github/workflows/desktop.yml`** — builds the mac `zip` alongside the dmg,
  passes `--publish never` (electron-builder generates the feed but doesn't
  upload; softprops stays the sole uploader), and the upload steps now include
  `latest*.yml`, `*.zip`, and `*.blockmap` so the update feed lands in the
  release.

## Why this shape

The release is created up front by `version-bump.yml`, and `desktop.yml`
attaches artifacts to it via `softprops/action-gh-release`. Keeping softprops as
the only uploader (rather than switching to electron-builder's publisher) means
the existing, working release flow is unchanged in its core behavior — the only
addition is more files in the release. Worst case (if a feed file isn't
produced) auto-update is simply inert; nothing breaks.

## Gates

- `npm ci` / `npm audit` — 0 vulnerabilities
- `npm run lint` — 0 errors
- `npm run typecheck` — clean
- `npm test` — 448/448 pass (updater code is lazy + packaged-only, so tests
  don't load it)
- `npm run build` — succeeds

## Follow-ups / verification

- **Can't be verified from CI/agent:** the full download→install cycle needs a
  signed packaged build on a real OS across two versions. First real release
  should confirm `latest-mac.yml` (+ zip) lands in the GitHub Release and that an
  older install picks up the update.
- macOS auto-update requires the **signed** build path (the `HAS_SIGNING` lane);
  an unsigned fallback build won't self-update (Gatekeeper).
- Optional next step: surface update status in-app (toast via the
  `window.specdown` bridge) instead of relying on the native notification.
