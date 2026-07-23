/**
 * Unit tests for desktop-only renderer behavior in app.js
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Desktop renderer integration', () => {
  beforeEach(() => {
    localStorage.clear();
    window.specdown = {
      isDesktop: true,
      requestFileOpen: jest.fn(),
      watchFile: jest.fn(),
      unwatchFile: jest.fn(),
      onFileOpened: jest.fn(),
      onCloseTab: jest.fn(),
      onFileChanged: jest.fn(),
      onTriggerPrint: jest.fn(),
      onTriggerSearch: jest.fn(),
      onApplyCustomCss: jest.fn(),
      saveSession: jest.fn(),
      requestRefreshFile: jest.fn(),
    };

    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    delete window.specdown;
  });

  it('uses native dialog on desktop when clicking Browse', () => {
    const browseButton = document.getElementById('browse-button');
    const fileInput = document.getElementById('file-input');
    fileInput.click = jest.fn();

    browseButton.dispatchEvent(new Event('click', { bubbles: true }));

    expect(window.specdown.requestFileOpen).toHaveBeenCalledTimes(1);
    expect(fileInput.click).not.toHaveBeenCalled();
  });

  it('auto-enables file watching for desktop file tabs and reference-counts duplicate paths', async () => {
    createTab('one.md', '# One', '/tmp/one.md');
    expect(window.specdown.watchFile).toHaveBeenCalledTimes(1);
    expect(window.specdown.watchFile).toHaveBeenCalledWith('/tmp/one.md');

    // Same file opened in another tab should not register a duplicate main-process watcher
    createTab('one.md', '# One again', '/tmp/one.md');
    expect(window.specdown.watchFile).toHaveBeenCalledTimes(1);

    const firstTabId = state.tabs[0].id;
    const secondTabId = state.tabs[1].id;

    await closeTab(firstTabId);
    expect(window.specdown.unwatchFile).not.toHaveBeenCalled();

    await closeTab(secondTabId);
    expect(window.specdown.unwatchFile).toHaveBeenCalledTimes(1);
    expect(window.specdown.unwatchFile).toHaveBeenCalledWith('/tmp/one.md');
  });

  it('flags background tabs whose watched file changed on disk, clearing on focus', async () => {
    // Register the onFileChanged callback that app.js wired up during init.
    const fileChangedCallback = window.specdown.onFileChanged.mock.calls[0][0];
    expect(typeof fileChangedCallback).toBe('function');

    createTab('a.md', '# A', '/tmp/a.md');
    createTab('b.md', '# B', '/tmp/b.md');

    // Tab b is now active; deliver a file-changed event for tab a.
    const backgroundTab = state.tabs.find((t) => t.filePath === '/tmp/a.md');
    const activeTab = state.tabs.find((t) => t.filePath === '/tmp/b.md');
    expect(state.activeTabId).toBe(activeTab.id);

    await fileChangedCallback({
      filename: 'a.md',
      filePath: '/tmp/a.md',
      content: '# A (updated)',
    });

    // Background tab should be flagged and its DOM element should carry
    // the change indicator class so the user sees something changed.
    expect(backgroundTab.hasUnseenChanges).toBe(true);
    const backgroundEl = document.querySelector(
      `.tab[data-tab-id="${backgroundTab.id}"]`
    );
    expect(backgroundEl.classList.contains('tab-has-changes')).toBe(true);

    // Switching to the background tab should clear the flag.
    await switchTab(backgroundTab.id);
    expect(backgroundTab.hasUnseenChanges).toBe(false);
    const refreshedEl = document.querySelector(
      `.tab[data-tab-id="${backgroundTab.id}"]`
    );
    expect(refreshedEl.classList.contains('tab-has-changes')).toBe(false);
  });

  it('reloads the active tab when the same file is open in an earlier tab too', async () => {
    const fileChangedCallback = window.specdown.onFileChanged.mock.calls[0][0];

    // Same file opened twice; the second copy is the active tab. Array.find
    // would return the first (background) copy, so the old handler took the
    // background branch and never re-rendered the visible view.
    createTab('dup.md', '# Original', '/tmp/dup.md');
    createTab('dup.md', '# Original', '/tmp/dup.md');

    const firstTab = state.tabs[0];
    const activeTab = state.tabs[1];
    expect(state.activeTabId).toBe(activeTab.id);

    await fileChangedCallback({
      filename: 'dup.md',
      filePath: '/tmp/dup.md',
      content: '# Reloaded from disk',
    });

    // The visible content must reflect the new file contents.
    const markdownContent = document.getElementById('markdown-content');
    expect(markdownContent.innerHTML).toContain('Reloaded from disk');
    expect(markdownContent.innerHTML).not.toContain('Original');

    // Both copies carry the fresh raw markdown; the background copy is flagged.
    expect(activeTab.rawMarkdown).toBe('# Reloaded from disk');
    expect(firstTab.rawMarkdown).toBe('# Reloaded from disk');
    expect(firstTab.hasUnseenChanges).toBe(true);
  });

  describe('live-reload chip', () => {
    it('shows "Live" with active state for a fresh desktop file tab', () => {
      createTab('one.md', '# One', '/tmp/one.md');
      const chip = document.getElementById('watch-toggle');
      expect(chip.style.display).not.toBe('none');
      expect(chip.classList.contains('active')).toBe(true);
      expect(chip.querySelector('.watch-toggle-label').textContent).toBe('Live');
    });

    it('click pauses live reload: "Paused" label and the watcher is released', () => {
      createTab('one.md', '# One', '/tmp/one.md');
      const chip = document.getElementById('watch-toggle');

      chip.dispatchEvent(new Event('click', { bubbles: true }));

      expect(window.specdown.unwatchFile).toHaveBeenCalledWith('/tmp/one.md');
      expect(chip.classList.contains('active')).toBe(false);
      expect(chip.querySelector('.watch-toggle-label').textContent).toBe('Paused');

      // Click again resumes.
      chip.dispatchEvent(new Event('click', { bubbles: true }));
      expect(chip.querySelector('.watch-toggle-label').textContent).toBe('Live');
    });

    it('hides the chip for tabs without a file path (URL/dragged content)', () => {
      createTab('remote.md', '# Remote', null);
      const chip = document.getElementById('watch-toggle');
      expect(chip.style.display).toBe('none');
    });

    it('Reload from disk asks the shell to re-read the active tab\'s file', () => {
      createTab('one.md', '# One', '/tmp/one.md');
      refreshActiveFileFromDisk();
      expect(window.specdown.requestRefreshFile).toHaveBeenCalledWith('/tmp/one.md');
    });

    it('Reload from disk is a no-op without a file-backed tab', () => {
      createTab('remote.md', '# Remote', null);
      refreshActiveFileFromDisk();
      expect(window.specdown.requestRefreshFile).not.toHaveBeenCalled();
    });
  });

  describe('version check vs. the desktop auto-updater', () => {
    const githubApiCalled = () =>
      // startsWith (not includes): asserts the exact API origin, which also
      // satisfies CodeQL's URL-substring-sanitization rule (alert #10).
      global.fetch.mock.calls.some((call) =>
        String(call[0]).startsWith('https://api.github.com/')
      );

    it('skips the GitHub-API poll on macOS, where electron-updater owns updates', () => {
      window.specdown.platform = 'darwin';
      global.fetch.mockClear();
      loadApp(document);
      expect(githubApiCalled()).toBe(false);
    });

    it('still polls on unsigned desktop platforms (their only update signal)', () => {
      window.specdown.platform = 'win32';
      global.fetch.mockClear();
      loadApp(document);
      expect(githubApiCalled()).toBe(true);
    });
  });
});
