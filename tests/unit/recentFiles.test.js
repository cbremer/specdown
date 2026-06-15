/**
 * Unit tests for the recent-files feature (storage model + drop-zone rendering).
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

  describe('drop-zone rendering', () => {
    it('hides the section when there are no recents', () => {
      renderRecentFiles();
      const section = document.getElementById('recent-files-section');
      expect(section.style.display).toBe('none');
    });

    it('renders a clickable item per recent and shows the section', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      recordRecentFile({ ref: 'https://a/two.md', title: 'two.md' });
      renderRecentFiles();

      const section = document.getElementById('recent-files-section');
      expect(section.style.display).not.toBe('none');

      const items = document.querySelectorAll('.recent-file-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('two.md');
      expect(items[0].getAttribute('title')).toBe('https://a/two.md');
    });

    it('invokes the configured onSelect with the entry when an item is clicked', () => {
      const onSelect = jest.fn();
      configureRecentFiles({ onSelect });
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      renderRecentFiles();

      const item = document.querySelector('.recent-file-item');
      item.dispatchEvent(new Event('click', { bubbles: true }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect.mock.calls[0][0].ref).toBe('https://a/one.md');
    });

    it('tags each item with its entry type for styling', () => {
      recordRecentFile({ ref: 'https://a/one.md', title: 'one.md' });
      recordRecentFile({ type: 'path', ref: '/tmp/a.md', title: 'a.md' });
      renderRecentFiles();

      const items = document.querySelectorAll('.recent-file-item');
      // Most-recent-first: the path entry is on top.
      expect(items[0].dataset.type).toBe('path');
      expect(items[1].dataset.type).toBe('url');
    });
  });

  describe('desktop path re-open', () => {
    afterEach(() => {
      delete window.specdown;
    });

    it('re-opens a recorded path through the desktop bridge', () => {
      window.specdown = { isDesktop: true, requestOpenPath: jest.fn() };

      recordRecentFile({ type: 'path', ref: '/tmp/a.md', title: 'a.md' });
      renderRecentFiles();

      const item = document.querySelector('.recent-file-item');
      item.dispatchEvent(new Event('click', { bubbles: true }));

      expect(window.specdown.requestOpenPath).toHaveBeenCalledTimes(1);
      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/tmp/a.md');
    });

    it('does not throw when a path entry is clicked without a desktop bridge', () => {
      recordRecentFile({ type: 'path', ref: '/tmp/a.md', title: 'a.md' });
      renderRecentFiles();

      const item = document.querySelector('.recent-file-item');
      expect(() => item.dispatchEvent(new Event('click', { bubbles: true }))).not.toThrow();
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
      JSON.stringify([{ type: 'url', ref: 'https://example.com/a.md', title: 'a.md' }])
    );
    loadHTML(document);
    loadApp(document);

    // init() should have kicked off a fetch for the restored URL.
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/a.md', expect.anything());
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
