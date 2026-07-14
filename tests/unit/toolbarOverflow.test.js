/**
 * Unit tests for the toolbar overflow menu — the "⋮" menu, visible at every
 * width, holding the complete document-action list (long-tail `.overflow-only`
 * actions like Watch/Comments/Notes/Print/Raw live only here). Menu items
 * proxy to the real toolbar buttons.
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

  it('skips inline-hidden targets (e.g. Present with no diagrams)', () => {
    const present = document.getElementById('present-button');
    // Hidden by default (no diagrams) → not offered in the menu.
    expect(present.style.display).toBe('none');
    openOverflowMenu();
    let labels = Array.from(document.querySelectorAll('.overflow-menu-item')).map(
      (i) => i.textContent
    );
    expect(labels).not.toContain('Present diagrams');
    closeOverflowMenu();

    // Once visible (diagrams present), it appears.
    present.style.display = '';
    openOverflowMenu();
    labels = Array.from(document.querySelectorAll('.overflow-menu-item')).map((i) => i.textContent);
    expect(labels).toContain('Present diagrams');
  });

  it('offers the long-tail overflow-only actions (Print, Raw) at any width', () => {
    openOverflowMenu();
    const labels = Array.from(document.querySelectorAll('.overflow-menu-item')).map(
      (i) => i.textContent
    );
    expect(labels).toContain('Print / Save as PDF');
    expect(labels).toContain('Toggle raw / preview');
  });

  it('offers "Show author comments" only when the comments feature is active', () => {
    // comments-toggle is feature-gated via inline display (hidden by default).
    openOverflowMenu();
    let labels = Array.from(document.querySelectorAll('.overflow-menu-item')).map(
      (i) => i.textContent
    );
    expect(labels).not.toContain('Show author comments');
    closeOverflowMenu();

    document.getElementById('comments-toggle').style.display = '';
    openOverflowMenu();
    labels = Array.from(document.querySelectorAll('.overflow-menu-item')).map(
      (i) => i.textContent
    );
    expect(labels).toContain('Show author comments');
  });

  it('exposes a visible search affordance that opens the search bar', () => {
    const searchButton = document.getElementById('search-button');
    expect(searchButton).not.toBeNull();
    // Create a tab so search has content context (search bar element exists regardless).
    searchButton.dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.getElementById('search-bar').style.display).not.toBe('none');
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
