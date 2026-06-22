// @ts-check
// Progressive Web App: register the service worker so the web (GitHub Pages)
// surface is installable and works offline.
//
// The same dist/ is loaded by the Electron (file://) and iOS WKWebView
// (specdown://) shells, where a service worker is unsupported and pointless, so
// registration is strictly web-only (http/https + not a native shell).

import { isDesktop, isIOSNative } from '../core/platform.js';

/**
 * Whether a service worker should be registered in the current environment.
 * @returns {boolean}
 */
export function shouldRegisterServiceWorker() {
  if (isDesktop || isIOSNative) return false;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const protocol = window.location.protocol;
  return protocol === 'http:' || protocol === 'https:';
}

/**
 * Wire the File Handling API so an installed PWA can be the "Open with" target
 * for .md/.markdown files (Chromium desktop). The manifest's `file_handlers`
 * advertises the association; this consumer receives the launched files and
 * hands each one to `onFile`. Web-only and capability-gated, like the SW.
 * @param {(file: File) => void} onFile
 */
export function registerFileHandlerLaunchConsumer(onFile) {
  if (isDesktop || isIOSNative) return;
  if (typeof window === 'undefined' || !('launchQueue' in window)) return;

  try {
    /** @type {any} */ (window).launchQueue.setConsumer(async (/** @type {any} */ launchParams) => {
      if (!launchParams || !launchParams.files || launchParams.files.length === 0) return;
      for (const handle of launchParams.files) {
        try {
          const file = await handle.getFile();
          onFile(file);
        } catch (err) {
          console.warn('Failed to open launched file:', err);
        }
      }
    });
  } catch (err) {
    console.warn('launchQueue consumer registration failed:', err);
  }
}

/** Register the service worker (once the page has loaded), web surface only. */
export function registerServiceWorker() {
  if (!shouldRegisterServiceWorker()) return;

  const doRegister = () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  };

  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister, { once: true });
  }
}
