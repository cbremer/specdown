// @ts-check
// Custom CSS themes (desktop): inject a user-supplied stylesheet into the page.

/** @type {HTMLStyleElement | null} */
let customStyleEl = null;

/** @param {string} cssContent */
export function applyCustomCss(cssContent) {
  if (!customStyleEl) {
    customStyleEl = document.createElement('style');
    customStyleEl.id = 'custom-theme';
    document.head.appendChild(customStyleEl);
  }
  customStyleEl.textContent = cssContent || '';
}
