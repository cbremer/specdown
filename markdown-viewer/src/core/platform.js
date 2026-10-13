// @ts-check
// Platform detection. The native shells inject their flags before the bundle
// runs — the Electron preload sets window.specdown, and the iOS WKUserScript
// sets window.iosNative at document start — so these evaluate correctly when
// this module is first imported.

export const isDesktop = !!(
  typeof window !== 'undefined' &&
  window.specdown &&
  window.specdown.isDesktop
);

export const isIOSNative = !!(
  typeof window !== 'undefined' &&
  window.iosNative &&
  window.webkit &&
  window.webkit.messageHandlers &&
  window.webkit.messageHandlers.specdown
);

/**
 * True on touch-first devices (the iOS app, or a coarse-pointer browser).
 * Dialogs there should not auto-focus a text field on open: that pops the
 * software keyboard, and on iOS the keyboard shifts the whole web view.
 */
export function platformIsTouchFirst() {
  if (isIOSNative) return true;
  return !!(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches
  );
}
