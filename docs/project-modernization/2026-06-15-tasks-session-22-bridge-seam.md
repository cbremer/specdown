# Tasks — Session 22: consolidate the `window.specdown` bridge seam

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 3 — distribution (portability hardening)

Follow-through on the Electron-vs-Tauri spike (2026-06-15): its one actionable
"do it now, cheaply" recommendation was to make the `window.specdown` bridge the
*single* coupling between the renderer and the native shell. It was the seam at
the **contract** level (15 methods, typed in `globals.d.ts`) but access was
**decentralized** — the global was poked directly in ~10 spots across four
modules. This consolidates those behind one module.

---

## What shipped

### `platform/bridge.js` (new)
- The single invocation surface for the desktop shell. One private
  `nativeBridge()` accessor + null-guarded wrappers for every bridge method:
  `hasDesktopBridge`, `bridgeRequestFileOpen`, `bridgeRequestOpenPath`,
  `bridgeRequestOpenFolder`, `bridgeRequestOpenRelative`, `bridgeWatchFile`,
  `bridgeUnwatchFile`, `bridgeSaveSession`, and the `bridgeOn*` event
  registrations (`onFileOpened`, `onFileChanged`, `onCloseTab`,
  `onWorkspaceOpened`, `onTriggerPrint`, `onTriggerSearch`, `onApplyCustomCss`).
- Param types derive from the ambient `Window['specdown']` contract
  (`Parameters<NonNullable<…>>`), so they can't drift from `globals.d.ts`.

### Call sites routed through it
- `platform/desktop.js` — watch/unwatch ref-counting, all `setupDesktopIPC`
  event registrations, and `saveDesktopSession` now use the wrappers +
  `hasDesktopBridge()` instead of `const bridge = window.specdown`.
- `features/workspace.js` — open-path/open-folder/open-relative + the
  workspace-opened listener.
- `platform/ios-chrome.js` — `requestNativeOpenIfAvailable` desktop branch.
- `main.js` — `openRecentEntry`'s desktop path re-open.

`window.specdown` is now referenced in exactly two places: `core/platform.js`
(the `isDesktop` **detection** — the legitimate single source) and
`platform/bridge.js` (the **invocation** seam). No feature module touches the
global directly.

**Behavior is unchanged** — this is a pure refactor. The payoff: a future shell
swap (e.g. Tauri) means reimplementing one module, callers get less repetitive
`?.()` guarding, and tests can mock one seam.

## Verification

- `tests/unit/bridge.test.js` (new, +4): proxies commands when the bridge is
  present, registers event callbacks, and reports-absent + no-ops safely on the
  web/iOS surfaces.
- Existing desktop/workspace/iOS suites cover the rewired call sites unchanged.
- `npm run build` ✓, `npm run lint` ✓ (0 errors), `npm run typecheck` ✓,
  `npm test` → **427 passed**.

## Notes

- `core/platform.js` keeps `window.specdown.isDesktop` for detection by design;
  detection (one read) and invocation (this module) are intentionally separate.
- The bridge's *shape* still lives in `desktop/preload.js` + `globals.d.ts`; this
  module is the renderer-side consumer of that contract.
