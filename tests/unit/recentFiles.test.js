/**
 * Unit tests for the recent-files feature (storage model + history dialog).
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Recent files', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    document.querySelector('.recent-files-overlay')?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
  });

  function recentDialog() {
    const overlay = document.querySelector('.recent-files-overlay');
    return overlay?.matches('[role="dialog"]')
      ? overlay
      : overlay?.querySelector('[role="dialog"]');
  }

  function recentCloseButton() {
    return [...recentDialog().querySelectorAll('button')].find((button) =>
      /^close/i.test(
        button.getAttribute('aria-label') || button.textContent.trim()
      )
    );
  }

  function openRecentFromWelcome() {
    const opener = document.getElementById('header-more-toggle');
    opener.focus();
    opener.click();
    document.getElementById('open-recent-button').click();
    return opener;
  }

  describe('storage model', () => {
    it('records most-recent-first', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      recordRecentFile({ ref: 'https://a/two.md', title: 'two.md' });

      const refs = getRecentFiles().map((e) => e.ref);
      expect(refs).toEqual(['https://a/two.md', 'https://a/one.md']);
    });

    it('de-duplicates by ref and moves a repeat to the top', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      recordRecentFile({ ref: 'https://a/two.md', title: 'two.md' });
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });

      const refs = getRecentFiles().map((e) => e.ref);
      expect(refs).toEqual(['https://a/one.md', 'https://a/two.md']);
    });

    it('caps the list at 8 entries', () => {
      for (let i = 0; i < 12; i++) {
        recordRecentFile({ ref: 'https://a/' + i + '.md', title: i + '.md' });
      }
      expect(getRecentFiles().length).toBe(8);
      // Newest kept, oldest dropped.
      expect(getRecentFiles()[0].ref).toBe('https://a/11.md');
    });

    it('ignores entries without a ref', () => {
      recordRecentFile(/** @type {any} */ ({ title: 'no ref' }));
      expect(getRecentFiles().length).toBe(0);
    });

    it('persists to localStorage', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      const stored = JSON.parse(localStorage.getItem('specdown-recent-files'));
      expect(stored[0].ref).toBe('https://a/one.md');
    });

    it('clears the list', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      clearRecentFiles();
      expect(getRecentFiles()).toEqual([]);
    });

    it('defaults entries to the url type', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      expect(getRecentFiles()[0].type).toBe('url');
    });

    it('records desktop file paths with the path type', () => {
      recordRecentFile({ type: 'path', ref: '/tmp/a.md', title: 'a.md' });
      const entry = getRecentFiles()[0];
      expect(entry.type).toBe('path');
      expect(entry.ref).toBe('/tmp/a.md');
    });
  });

  describe('header More menu', () => {
    it('keeps Recent tucked away and synchronizes expanded state when toggled', () => {
      const more = document.getElementById('header-more-toggle');
      const menu = document.getElementById('header-more-menu');
      const recent = document.getElementById('open-recent-button');
      expect(more.getAttribute('aria-label')).toBe('More');
      expect(more.getAttribute('aria-haspopup')).toBe('menu');
      expect(more.getAttribute('aria-controls')).toBe(menu.id);
      expect(menu.getAttribute('role')).toBe('menu');
      expect(menu.hidden).toBe(true);
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(menu.contains(recent)).toBe(true);
      expect(recent.getAttribute('role')).toBe('menuitem');
      expect(
        document.querySelector('#drop-zone #open-recent-button')
      ).toBeNull();

      more.click();
      expect(menu.hidden).toBe(false);
      expect(more.getAttribute('aria-expanded')).toBe('true');
      expect(document.querySelector('.recent-files-overlay')).toBeNull();
      more.click();
      expect(menu.hidden).toBe(true);
      expect(more.getAttribute('aria-expanded')).toBe('false');
    });

    it('dismisses on an outside click even when the other control stops propagation', () => {
      const more = document.getElementById('header-more-toggle');
      const menu = document.getElementById('header-more-menu');
      const outside = document.createElement('button');
      document.body.append(outside);
      outside.addEventListener('click', (event) => event.stopPropagation());
      more.click();
      outside.focus();
      outside.click();

      expect(menu.hidden).toBe(true);
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(outside);
    });

    it('opens and focuses Recent with ArrowDown and dismisses with Escape without global key handling', () => {
      const more = document.getElementById('header-more-toggle');
      const menu = document.getElementById('header-more-menu');
      const recent = document.getElementById('open-recent-button');
      const backgroundKey = jest.fn();
      document.addEventListener('keydown', backgroundKey);
      try {
        more.focus();
        const arrow = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        });
        more.dispatchEvent(arrow);
        expect(arrow.defaultPrevented).toBe(true);
        expect(menu.hidden).toBe(false);
        expect(document.activeElement).toBe(recent);
        recent.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
          })
        );
        expect(menu.hidden).toBe(true);
        expect(more.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(more);
        expect(backgroundKey).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener('keydown', backgroundKey);
      }
    });

    it.each([false, true])(
      'closes before normal Tab navigation (shiftKey=%s)',
      (shiftKey) => {
        const more = document.getElementById('header-more-toggle');
        const menu = document.getElementById('header-more-menu');
        more.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          })
        );
        const tab = new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey,
          bubbles: true,
          cancelable: true,
        });
        document.activeElement.dispatchEvent(tab);

        expect(tab.defaultPrevented).toBe(false);
        expect(menu.hidden).toBe(true);
        expect(more.getAttribute('aria-expanded')).toBe('false');
        // jsdom does not perform native Tab navigation; the browser proceeds from More.
        expect(document.activeElement).toBe(more);
      }
    );
  });

  describe('history dialog', () => {
    it('opens an accessible empty dialog without browsing or expanding the welcome card', () => {
      const filePicker = jest.spyOn(
        document.getElementById('file-input'),
        'click'
      );
      const opener = document.getElementById('open-recent-button');
      expect(opener).not.toBeNull();
      expect(opener.disabled).toBe(false);
      expect(
        document.querySelector('#drop-zone #recent-files-section')
      ).toBeNull();
      expect(
        document.querySelector('#drop-zone #recent-files-list')
      ).toBeNull();

      openRecentFromWelcome();

      expect(document.getElementById('header-more-menu').hidden).toBe(true);
      expect(
        document
          .getElementById('header-more-toggle')
          .getAttribute('aria-expanded')
      ).toBe('false');
      const overlay = document.querySelector('.recent-files-overlay');
      const dialog = recentDialog();
      expect(overlay.parentElement).toBe(document.body);
      expect(dialog).not.toBeNull();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const name =
        dialog.getAttribute('aria-label') ||
        dialog
          .getAttribute('aria-labelledby')
          ?.split(/\s+/)
          .map((id) => document.getElementById(id).textContent)
          .join(' ');
      expect(name.trim()).toBe('Open Recent');
      expect(dialog.textContent).toContain('No recent files yet.');
      expect(document.getElementById('recent-files-clear').disabled).toBe(true);
      expect(recentCloseButton()).toBeDefined();
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(filePicker).not.toHaveBeenCalled();
    });

    it('renders path and URL entries in most-recent-first order with their labels and locations', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      recordRecentFile({ type: 'path', ref: '/tmp/two.md', title: 'two.md' });
      openRecentFiles();

      const items = document.querySelectorAll(
        '#recent-files-list .recent-file-item'
      );
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('two.md');
      expect(items[0].getAttribute('title')).toBe('/tmp/two.md');
      expect(items[0].dataset.type).toBe('path');
      expect(items[1].textContent).toBe('one.md');
      expect(items[1].getAttribute('title')).toBe('https://a/one.md');
      expect(items[1].dataset.type).toBe('url');
    });

    it('closes before invoking onSelect with the clicked entry', () => {
      const onSelect = jest.fn(() => {
        expect(document.querySelector('.recent-files-overlay')).toBeNull();
      });
      configureRecentFiles({ onSelect });
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      openRecentFiles();

      const item = document.querySelector('.recent-file-item');
      item.dispatchEvent(new Event('click', { bubbles: true }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith({
        type: 'url',
        ref: 'https://a/one.md',
        title: 'one.md',
      });
    });

    it.each(['Close button', 'Escape', 'backdrop'])(
      'dismisses with %s and restores opener focus',
      (action) => {
        const opener = openRecentFromWelcome();
        if (action === 'Close button') {
          recentCloseButton().click();
        } else if (action === 'Escape') {
          document.activeElement.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Escape',
              bubbles: true,
              cancelable: true,
            })
          );
        } else {
          document.querySelector('.recent-files-overlay').click();
        }
        expect(document.querySelector('.recent-files-overlay')).toBeNull();
        expect(document.activeElement).toBe(opener);
      }
    );

    it('wraps Tab and Shift+Tab within the dialog', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      openRecentFromWelcome();
      const buttons = [
        ...recentDialog().querySelectorAll('button:not([disabled])'),
      ];
      const first = buttons[0];
      const last = buttons.at(-1);

      last.focus();
      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      last.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);

      const shiftTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      first.dispatchEvent(shiftTab);
      expect(shiftTab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);
    });

    it('keeps global shortcuts from opening another surface underneath the dialog', () => {
      openRecentFromWelcome();
      for (const shortcut of [
        { key: '?' },
        { key: 'k', ctrlKey: true },
        { key: 'k', metaKey: true },
      ]) {
        document.activeElement.dispatchEvent(
          new KeyboardEvent('keydown', {
            ...shortcut,
            bubbles: true,
            cancelable: true,
          })
        );
        expect(isCommandPaletteOpen()).toBe(false);
        expect(isShortcutsSheetOpen()).toBe(false);
        expect(document.querySelector('.recent-files-overlay')).not.toBeNull();
      }
    });

    it('clears history, shows the empty state, and keeps focus on an enabled dialog control', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      openRecentFromWelcome();
      const clear = document.getElementById('recent-files-clear');
      expect(clear.textContent.trim()).toBe('Clear history');
      expect(clear.disabled).toBe(false);
      clear.focus();
      clear.click();

      expect(getRecentFiles()).toEqual([]);
      expect(JSON.parse(localStorage.getItem('specdown-recent-files'))).toEqual(
        []
      );
      expect(recentDialog().textContent).toContain('No recent files yet.');
      expect(document.querySelectorAll('.recent-file-item')).toHaveLength(0);
      expect(document.getElementById('recent-files-clear').disabled).toBe(true);
      expect(recentDialog().contains(document.activeElement)).toBe(true);
      expect(document.activeElement.disabled).toBe(false);
      expect(document.getElementById('open-recent-button').disabled).toBe(
        false
      );
    });

    it('refreshes an open dialog without creating history markup while it is closed', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      renderRecentFiles();
      expect(document.querySelector('.recent-files-overlay')).toBeNull();
      expect(document.getElementById('recent-files-list')).toBeNull();

      openRecentFiles();
      expect(document.activeElement.getAttribute('title')).toBe(
        'https://a/one.md'
      );
      recordRecentFile({ ref: 'https://a/two.md', title: 'two.md' });
      renderRecentFiles();
      expect(
        [...document.querySelectorAll('.recent-file-item')].map(
          (item) => item.textContent
        )
      ).toEqual(['two.md', 'one.md']);
      expect(document.querySelectorAll('.recent-files-overlay')).toHaveLength(
        1
      );
      expect(recentDialog().contains(document.activeElement)).toBe(true);
      expect(document.activeElement.getAttribute('title')).toBe(
        'https://a/one.md'
      );
    });

    it('focuses Close when a refresh removes the focused entry and leaves history empty', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      openRecentFromWelcome();
      expect(document.activeElement.getAttribute('title')).toBe(
        'https://a/one.md'
      );

      clearRecentFiles();
      renderRecentFiles();

      expect(document.querySelectorAll('.recent-file-item')).toHaveLength(0);
      expect(recentDialog().textContent).toContain('No recent files yet.');
      expect(document.activeElement).toBe(recentCloseButton());
      expect(document.activeElement.disabled).toBe(false);
      expect(document.getElementById('recent-files-clear').disabled).toBe(true);
    });

    it('renders malicious-looking filenames as text without creating markup', () => {
      const title = '<img src=x onerror=alert(1)>.md';
      recordRecentFile({ ref: 'https://a/unusual.md', title });
      openRecentFiles();

      const item = document.querySelector('.recent-file-item');
      expect(item.textContent).toBe(title);
      expect(item.querySelector('img')).toBeNull();
      expect(global.alert).not.toHaveBeenCalled();
    });
  });

  describe('desktop path re-open', () => {
    afterEach(() => {
      delete window.specdown;
    });

    it('re-opens a recorded path through the desktop bridge', () => {
      window.specdown = { isDesktop: true, requestOpenPath: jest.fn() };

      recordRecentFile({ type: 'path', ref: '/tmp/a.md', title: 'a.md' });
      openRecentFiles();

      const item = document.querySelector('.recent-file-item');
      item.dispatchEvent(new Event('click', { bubbles: true }));

      expect(window.specdown.requestOpenPath).toHaveBeenCalledTimes(1);
      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/tmp/a.md');
    });

    it('does not throw when a path entry is clicked without a desktop bridge', () => {
      recordRecentFile({ type: 'path', ref: '/tmp/a.md', title: 'a.md' });
      openRecentFiles();

      const item = document.querySelector('.recent-file-item');
      expect(() =>
        item.dispatchEvent(new Event('click', { bubbles: true }))
      ).not.toThrow();
    });
  });

  describe('session restore', () => {
    it('does nothing when there is no last session', () => {
      const onSelect = jest.fn();
      configureRecentFiles({ onSelect });
      restoreLastSession();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('re-opens the most recent document via onSelect', () => {
      const onSelect = jest.fn();
      recordRecentFile({ ref: 'https://a/old.md', title: 'old.md' });
      recordRecentFile({ ref: 'https://a/last.md', title: 'last.md' });
      configureRecentFiles({ onSelect });

      restoreLastSession();

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect.mock.calls[0][0].ref).toBe('https://a/last.md');
    });
  });
});

describe('Session restore on launch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reopens the stored last document when the app starts', () => {
    localStorage.setItem(
      'specdown-recent-files',
      JSON.stringify([
        { type: 'url', ref: 'https://example.com/a.md', title: 'a.md' },
      ])
    );
    loadHTML(document);
    loadApp(document);

    // init() should have kicked off a fetch for the restored URL.
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/a.md',
      expect.anything()
    );
  });

  it('does not reopen anything when there is no stored session', () => {
    loadHTML(document);
    loadApp(document);

    expect(global.fetch).not.toHaveBeenCalledWith(
      'https://example.com/a.md',
      expect.anything()
    );
  });
});
