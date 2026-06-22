# Session 07 — Visible desktop update UX (check + restart)

**Date:** 2026-06-22
**Type:** tasks
**Surface:** desktop (Electron).
**Builds on:** [session 06 auto-update](2026-06-21-tasks-session-06-auto-update.md).

## Why

Auto-update (session 06) was silent: background download + install-on-quit + a
native OS notification, with no visible control. This adds the two pieces a user
expects: a way to **check** on demand, and a one-click **restart** when an update
is ready.

## Changes

- **`desktop/main.js`**
  - Holds the `autoUpdater` instance (`autoUpdaterRef`) + a `manualUpdateCheck`
    flag so a user-initiated check surfaces a result while the silent on-launch
    check stays quiet.
  - **Help → "Check for Updates…"** menu item → `checkForUpdatesManually()`.
    Result is a native dialog: "You're up to date" / "Could not check…", or — if
    an update is found — it downloads and triggers the restart toast. In a
    dev/unpackaged build it explains updates are install-only.
  - On `update-downloaded`, sends `update-downloaded` IPC to the renderer (for
    the toast). The native `checkForUpdatesAndNotify` OS notification still fires
    as a fallback.
  - `ipcMain.on('restart-to-update')` → `autoUpdater.quitAndInstall()`.
- **`desktop/preload.js`** — exposes `onUpdateDownloaded(cb)` + `restartToUpdate()`.
- **`globals.d.ts` / `platform/bridge.js`** — the two new bridge members behind
  the `window.specdown` seam (`bridgeOnUpdateDownloaded`, `bridgeRestartToUpdate`).
- **`platform/desktop.js`** — on update-downloaded, shows a persistent toast
  ("An update (vX) is ready to install." + **Restart now**) wired to the bridge.
- **`features/toast.js` (+ `styles.css`)** — `showToast` gains an optional
  `action: { label, onClick }`, rendering a button (reusable, not update-specific).

## Tests / gates

- Added a toast action-button test (renders, runs handler, dismisses).
  `npm test` → **456 pass**. lint 0 errors, typecheck clean, build green.

## Verification gaps

- The full check→download→restart cycle needs a **signed packaged build** across
  two versions (same constraint as session 06). The menu item, dialogs, toast,
  and quitAndInstall path are wired and unit-/type-checked, but the live update
  feed can't be exercised from CI.
- macOS self-update requires the signed build path (Gatekeeper).
