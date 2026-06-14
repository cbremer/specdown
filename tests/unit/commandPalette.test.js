/**
 * Unit tests for the command palette: fuzzy filtering (pure) and the
 * open/close/keyboard-navigation behavior.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

function dispatchKey(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('Command palette', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    if (isCommandPaletteOpen()) closeCommandPalette();
  });

  describe('fuzzyScore', () => {
    it('returns -1 when the query is not a subsequence', () => {
      expect(fuzzyScore('xyz', 'Toggle theme')).toBe(-1);
    });

    it('matches an in-order subsequence', () => {
      expect(fuzzyScore('tg', 'Toggle')).toBeGreaterThanOrEqual(0);
    });

    it('rewards start-of-string matches', () => {
      expect(fuzzyScore('to', 'Toggle')).toBeGreaterThan(fuzzyScore('gl', 'Toggle'));
    });

    it('scores an empty query as 0', () => {
      expect(fuzzyScore('', 'anything')).toBe(0);
    });
  });

  describe('filterCommands', () => {
    const cmds = [
      { id: 'a', title: 'Toggle theme', run() {} },
      { id: 'b', title: 'Find in document', run() {} },
      { id: 'c', title: 'Print', run() {}, isAvailable: () => false },
    ];

    it('returns all available commands for an empty query', () => {
      expect(filterCommands(cmds, '').map((c) => c.id)).toEqual(['a', 'b']);
    });

    it('filters by a fuzzy query', () => {
      expect(filterCommands(cmds, 'find').map((c) => c.id)).toEqual(['b']);
    });

    it('matches against keywords too', () => {
      const withKw = [{ id: 'x', title: 'Toggle theme', keywords: ['dark'], run() {} }];
      expect(filterCommands(withKw, 'dark').map((c) => c.id)).toEqual(['x']);
    });

    it('returns nothing when no command matches', () => {
      expect(filterCommands(cmds, 'zzzz')).toEqual([]);
    });
  });

  describe('open / close', () => {
    it('opens an accessible dialog with command options', () => {
      openCommandPalette();

      expect(isCommandPaletteOpen()).toBe(true);
      const dialog = document.querySelector('.command-palette');
      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      const input = document.querySelector('.command-palette-input');
      expect(input.getAttribute('role')).toBe('combobox');
      expect(document.querySelectorAll('.command-palette-item').length).toBeGreaterThan(0);
    });

    it('closes and removes the overlay', () => {
      openCommandPalette();
      closeCommandPalette();

      expect(isCommandPaletteOpen()).toBe(false);
      expect(document.querySelector('.command-palette-overlay')).toBeNull();
    });

    it('toggles open then closed', () => {
      toggleCommandPalette();
      expect(isCommandPaletteOpen()).toBe(true);
      toggleCommandPalette();
      expect(isCommandPaletteOpen()).toBe(false);
    });

    it('only registers available commands (doc-only commands hidden with no doc)', () => {
      openCommandPalette();
      const titles = Array.from(document.querySelectorAll('.command-palette-item-title')).map(
        (el) => el.textContent
      );
      // "Open file…" is always available; "Find in document" needs an open doc.
      expect(titles).toContain('Open file…');
      expect(titles).not.toContain('Find in document');
    });
  });

  describe('keyboard navigation', () => {
    it('moves the selection with arrow keys', () => {
      openCommandPalette();
      const input = document.querySelector('.command-palette-input');

      let items = document.querySelectorAll('.command-palette-item');
      expect(items[0].getAttribute('aria-selected')).toBe('true');

      dispatchKey(input, 'ArrowDown');
      items = document.querySelectorAll('.command-palette-item');
      expect(items[0].getAttribute('aria-selected')).toBe('false');
      expect(items[1].getAttribute('aria-selected')).toBe('true');

      dispatchKey(input, 'ArrowUp');
      items = document.querySelectorAll('.command-palette-item');
      expect(items[0].getAttribute('aria-selected')).toBe('true');
    });

    it('runs the selected command on Enter and closes', () => {
      const run = jest.fn();
      registerCommands([{ id: 'spy', title: 'Spy command', run }]);
      openCommandPalette();

      const input = document.querySelector('.command-palette-input');
      dispatchKey(input, 'Enter');

      expect(run).toHaveBeenCalledTimes(1);
      expect(isCommandPaletteOpen()).toBe(false);
    });

    it('closes on Escape', () => {
      openCommandPalette();
      const input = document.querySelector('.command-palette-input');
      dispatchKey(input, 'Escape');
      expect(isCommandPaletteOpen()).toBe(false);
    });
  });

  describe('filtering via the input', () => {
    it('re-renders the list as the query changes', () => {
      registerCommands([
        { id: 'theme', title: 'Toggle theme', run() {} },
        { id: 'find', title: 'Find in document', run() {} },
      ]);
      openCommandPalette();

      const input = document.querySelector('.command-palette-input');
      input.value = 'find';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const items = document.querySelectorAll('.command-palette-item');
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain('Find in document');
    });

    it('shows an empty state when nothing matches', () => {
      openCommandPalette();
      const input = document.querySelector('.command-palette-input');
      input.value = 'zzzznope';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(document.querySelector('.command-palette-item')).toBeNull();
      expect(document.querySelector('.command-palette-empty')).not.toBeNull();
    });
  });
});
