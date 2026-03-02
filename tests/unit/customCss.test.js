/**
 * Unit tests for custom CSS theme support
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Custom CSS Theme', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);

    // Remove any existing custom-theme style element between tests
    const existing = document.getElementById('custom-theme');
    if (existing) existing.remove();
  });

  // ===========================
  // applyCustomCss
  // ===========================
  describe('applyCustomCss', () => {
    it('creates a <style id="custom-theme"> element in <head> on first call', () => {
      applyCustomCss('body { color: red; }');

      const el = document.getElementById('custom-theme');
      expect(el).not.toBeNull();
      expect(el.tagName.toLowerCase()).toBe('style');
    });

    it('sets the textContent of the style element to the provided CSS', () => {
      const css = 'body { background: blue; }';
      applyCustomCss(css);

      const el = document.getElementById('custom-theme');
      expect(el.textContent).toBe(css);
    });

    it('replaces content on a second call rather than creating another element', () => {
      applyCustomCss('body { color: red; }');
      applyCustomCss('body { color: green; }');

      const els = document.querySelectorAll('#custom-theme');
      expect(els.length).toBe(1);
      expect(els[0].textContent).toBe('body { color: green; }');
    });

    it('clears the CSS when called with an empty string', () => {
      applyCustomCss('body { color: red; }');
      applyCustomCss('');

      const el = document.getElementById('custom-theme');
      expect(el.textContent).toBe('');
    });

    it('clears the CSS when called with null/undefined', () => {
      applyCustomCss('body { color: red; }');
      applyCustomCss(null);

      const el = document.getElementById('custom-theme');
      expect(el.textContent).toBe('');
    });

    it('appends the style element to document.head', () => {
      applyCustomCss('p { margin: 0; }');

      const el = document.getElementById('custom-theme');
      expect(document.head.contains(el)).toBe(true);
    });
  });
});
