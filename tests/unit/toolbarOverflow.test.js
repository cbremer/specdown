/**
 * Unit tests for the toolbar overflow menu (the "⋮" menu that collapses the
 * content-header actions on narrow viewports). Menu items proxy to the real
 * toolbar buttons.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Toolbar overflow menu', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    if (isOverflowMenuOpen()) closeOverflowMenu();
  });

  it('opens a menu of action items anchored in the toolbar', () => {
    openOverflowMenu();

    expect(isOverflowMenuOpen()).toBe(true);
    const menu = document.querySelector('.overflow-menu');
    expect(menu).not.toBeNull();
    expect(menu.getAttribute('role')).toBe('menu');

    const items = menu.querySelectorAll('.overflow-menu-item');
    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => expect(item.getAttribute('role')).toBe('menuitem'));

    // It lives inside the content-header actions container.
    expect(menu.closest('.content-header-actions')).not.toBeNull();
  });

  it('opens via the overflow toggle button and syncs aria-expanded', () => {
    const toggle = document.getElementById('overflow-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.dispatchEvent(new Event('click', { bubbles: true }));

    expect(isOverflowMenuOpen()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('proxies a menu item to the real toolbar button and closes', () => {
    expect(state.splitViewActive).toBe(false);

    openOverflowMenu();
    const items = Array.from(document.querySelectorAll('.overflow-menu-item'));
    const splitItem = items.find((i) => /split/i.test(i.textContent));
    expect(splitItem).toBeTruthy();

    splitItem.dispatchEvent(new Event('click', { bubbles: true }));

    // Clicking the item should have triggered #split-toggle's handler.
    expect(state.splitViewActive).toBe(true);
    expect(isOverflowMenuOpen()).toBe(false);
  });

  it('closes and removes the menu', () => {
    openOverflowMenu();
    closeOverflowMenu();

    expect(isOverflowMenuOpen()).toBe(false);
    expect(document.querySelector('.overflow-menu')).toBeNull();
    expect(document.getElementById('overflow-toggle').getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles open/closed', () => {
    toggleOverflowMenu();
    expect(isOverflowMenuOpen()).toBe(true);
    toggleOverflowMenu();
    expect(isOverflowMenuOpen()).toBe(false);
  });

  it('closes on an outside click', () => {
    jest.useFakeTimers();
    try {
      openOverflowMenu();
      jest.advanceTimersByTime(1); // register the deferred outside-click listener
      document.body.dispatchEvent(new Event('click', { bubbles: true }));
      expect(isOverflowMenuOpen()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
