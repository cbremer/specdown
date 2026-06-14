// Custom CSS themes (desktop): inject a user-supplied stylesheet into the page.

let customStyleEl = null;

export function applyCustomCss(cssContent) {
  if (!customStyleEl) {
    customStyleEl = document.createElement('style');
    customStyleEl.id = 'custom-theme';
    document.head.appendChild(customStyleEl);
  }
  customStyleEl.textContent = cssContent || '';
}
