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
