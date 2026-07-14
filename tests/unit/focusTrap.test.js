/**
 * Unit tests for the modal focus trap (core/focus-trap.js) and its wiring into
 * the command palette and shortcuts sheet.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const tabEvent = (shiftKey = false) =>
  new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });

describe('focus trap', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  describe('trapFocus core behavior', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML =
        '<button id="ft-first">first</button>' +
        '<input id="ft-mid" type="text">' +
        '<button id="ft-last">last</button>';
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('wraps Tab from the last focusable back to the first', () => {
      const release = trapFocus(container);
      document.getElementById('ft-last').focus();

      const e = tabEvent(false);
      container.dispatchEvent(e);

      expect(e.defaultPrevented).toBe(true);
      expect(document.activeElement.id).toBe('ft-first');
      release();
    });

    it('wraps Shift+Tab from the first focusable to the last', () => {
      const release = trapFocus(container);
      document.getElementById('ft-first').focus();

      const e = tabEvent(true);
      container.dispatchEvent(e);

      expect(e.defaultPrevented).toBe(true);
      expect(document.activeElement.id).toBe('ft-last');
      release();
    });

    it('lets Tab proceed between interior focusables', () => {
      const release = trapFocus(container);
      document.getElementById('ft-mid').focus();

      const e = tabEvent(false);
      container.dispatchEvent(e);

      // Browser default handles interior moves; the trap must not intercept.
      expect(e.defaultPrevented).toBe(false);
      release();
    });

    it('release() stops trapping and is idempotent', () => {
      const release = trapFocus(container);
      release();
      release();

      document.getElementById('ft-last').focus();
      const e = tabEvent(false);
      container.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    });
  });

  describe('modal wiring', () => {
    it('traps Tab inside the command palette while open', () => {
      openCommandPalette();
      const overlay = document.querySelector('.command-palette-overlay');
      expect(overlay).not.toBeNull();

      const input = overlay.querySelector('.command-palette-input');
      input.focus();
      // Palette's only tabbable element is the input → Tab wraps onto itself.
      const e = tabEvent(false);
      overlay.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);

      closeCommandPalette();
    });

    it('traps Tab inside the shortcuts sheet while open', () => {
      openShortcutsSheet();
      const overlay = document.querySelector('.shortcuts-overlay');
      expect(overlay).not.toBeNull();

      // The sheet has no tabbable children (dialog is tabindex=-1), so the
      // trap pins focus rather than letting Tab escape to the page.
      const e = tabEvent(false);
      overlay.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);

      closeShortcutsSheet();
    });
  });
});
