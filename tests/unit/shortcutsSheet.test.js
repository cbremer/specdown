/**
 * Unit tests for the keyboard-shortcut reference sheet.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Keyboard shortcuts sheet', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    if (isShortcutsSheetOpen()) closeShortcutsSheet();
  });

  it('opens an accessible modal listing shortcuts', () => {
    openShortcutsSheet();

    expect(isShortcutsSheetOpen()).toBe(true);
    const dialog = document.querySelector('.shortcuts-sheet');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Keyboard shortcuts');

    const rows = document.querySelectorAll('.shortcuts-row');
    expect(rows.length).toBeGreaterThan(0);
    // Each row pairs a <kbd> key with a description.
    expect(document.querySelector('.shortcuts-row kbd')).not.toBeNull();
  });

  it('is idempotent — a second open does not stack overlays', () => {
    openShortcutsSheet();
    openShortcutsSheet();
    expect(document.querySelectorAll('.shortcuts-overlay').length).toBe(1);
  });

  it('closes and removes the overlay', () => {
    openShortcutsSheet();
    closeShortcutsSheet();

    expect(isShortcutsSheetOpen()).toBe(false);
    expect(document.querySelector('.shortcuts-overlay')).toBeNull();
  });

  it('closes on Escape within the sheet', () => {
    openShortcutsSheet();
    const dialog = document.querySelector('.shortcuts-sheet');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(isShortcutsSheetOpen()).toBe(false);
  });
});
