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

    const firstTabId = tabs[0].id;
    const secondTabId = tabs[1].id;

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
    const backgroundTab = tabs.find(t => t.filePath === '/tmp/a.md');
    const activeTab = tabs.find(t => t.filePath === '/tmp/b.md');
    expect(activeTabId).toBe(activeTab.id);

    await fileChangedCallback({
      filename: 'a.md',
      filePath: '/tmp/a.md',
      content: '# A (updated)',
    });

    // Background tab should be flagged and its DOM element should carry
    // the change indicator class so the user sees something changed.
    expect(backgroundTab.hasUnseenChanges).toBe(true);
    const backgroundEl = document.querySelector(`.tab[data-tab-id="${backgroundTab.id}"]`);
    expect(backgroundEl.classList.contains('tab-has-changes')).toBe(true);

    // Switching to the background tab should clear the flag.
    await switchTab(backgroundTab.id);
    expect(backgroundTab.hasUnseenChanges).toBe(false);
    const refreshedEl = document.querySelector(`.tab[data-tab-id="${backgroundTab.id}"]`);
    expect(refreshedEl.classList.contains('tab-has-changes')).toBe(false);
  });
});
