// @ts-check
// The single seam between the renderer and the native desktop (Electron) shell.
//
// Every use of the preload's `window.specdown` bridge goes through this module,
// so swapping the shell (e.g. Electron → Tauri — see the 2026-06-15
// Electron-vs-Tauri spike) means reimplementing this one file rather than
// touching feature code. Each call is null-guarded, so callers work unchanged on
// the web/iOS surfaces where no desktop bridge exists. Platform *detection*
// still lives in core/platform.js; this module is the *invocation* surface.
//
// The bridge contract itself is declared on `window.specdown` in
// src/types/globals.d.ts; the param types below derive from it so they can't
// drift.

/** @typedef {NonNullable<Window['specdown']>} DesktopBridge */

/** @returns {Window['specdown']} */
function nativeBridge() {
  return typeof window !== 'undefined' ? window.specdown : undefined;
}

/** Whether the native desktop shell bridge is present (i.e. we're in Electron). */
export function hasDesktopBridge() {
  return !!nativeBridge();
}

/**
 * The desktop shell's OS platform (Node `process.platform`: 'darwin', 'win32',
 * 'linux'), or undefined outside the desktop shell.
 * @returns {string | undefined}
 */
export function bridgeDesktopPlatform() {
  return nativeBridge()?.platform;
}

// --- Commands (renderer → shell) -------------------------------------------

/** Ask the shell to show its native file-open dialog. */
export function bridgeRequestFileOpen() {
  nativeBridge()?.requestFileOpen?.();
}

/** @param {string} filePath Re-open a known local file by absolute path. */
export function bridgeRequestOpenPath(filePath) {
  nativeBridge()?.requestOpenPath?.(filePath);
}

/** Ask the shell to show its folder picker (workspace mode). */
export function bridgeRequestOpenFolder() {
  nativeBridge()?.requestOpenFolder?.();
}

/**
 * @param {string} fromPath The document the link was clicked in.
 * @param {string} href The relative link to resolve + open.
 */
export function bridgeRequestOpenRelative(fromPath, href) {
  nativeBridge()?.requestOpenRelative?.(fromPath, href);
}

/** @param {string} filePath Start watching a file for on-disk changes. */
export function bridgeWatchFile(filePath) {
  nativeBridge()?.watchFile?.(filePath);
}

/** @param {string} filePath Stop watching a file. */
export function bridgeUnwatchFile(filePath) {
  nativeBridge()?.unwatchFile?.(filePath);
}

/** @param {Parameters<NonNullable<DesktopBridge['saveSession']>>[0]} tabs */
export function bridgeSaveSession(tabs) {
  nativeBridge()?.saveSession?.(tabs);
}

// --- Events (shell → renderer) ---------------------------------------------

/** @param {Parameters<NonNullable<DesktopBridge['onFileOpened']>>[0]} cb */
export function bridgeOnFileOpened(cb) {
  nativeBridge()?.onFileOpened?.(cb);
}

/** @param {Parameters<NonNullable<DesktopBridge['onFileChanged']>>[0]} cb */
export function bridgeOnFileChanged(cb) {
  nativeBridge()?.onFileChanged?.(cb);
}

/** @param {Parameters<NonNullable<DesktopBridge['onCloseTab']>>[0]} cb */
export function bridgeOnCloseTab(cb) {
  nativeBridge()?.onCloseTab?.(cb);
}

/** @param {Parameters<NonNullable<DesktopBridge['onWorkspaceOpened']>>[0]} cb */
export function bridgeOnWorkspaceOpened(cb) {
  nativeBridge()?.onWorkspaceOpened?.(cb);
}

/** @param {Parameters<NonNullable<DesktopBridge['onTriggerPrint']>>[0]} cb */
export function bridgeOnTriggerPrint(cb) {
  nativeBridge()?.onTriggerPrint?.(cb);
}

/** @param {Parameters<NonNullable<DesktopBridge['onTriggerSearch']>>[0]} cb */
export function bridgeOnTriggerSearch(cb) {
  nativeBridge()?.onTriggerSearch?.(cb);
}

/** @param {Parameters<NonNullable<DesktopBridge['onApplyCustomCss']>>[0]} cb */
export function bridgeOnApplyCustomCss(cb) {
  nativeBridge()?.onApplyCustomCss?.(cb);
}

/** @param {Parameters<NonNullable<DesktopBridge['onUpdateDownloaded']>>[0]} cb */
export function bridgeOnUpdateDownloaded(cb) {
  nativeBridge()?.onUpdateDownloaded?.(cb);
}

/** Ask the shell to quit and install a downloaded update. */
export function bridgeRestartToUpdate() {
  nativeBridge()?.restartToUpdate?.();
}
