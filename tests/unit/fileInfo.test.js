/**
 * Unit tests for the File info sheet (features/file-info.js) — the modal that
 * shows the active document's on-disk location and metadata. Covers the pure
 * row/format helpers, the web/URL/desktop surfacing, and the entry points
 * (overflow menu, command palette, Escape chain).
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('File info sheet (web)', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    if (isFileInfoSheetOpen()) closeFileInfoSheet();
  });

  describe('pure helpers', () => {
    it('formats byte sizes into readable units', () => {
      expect(formatBytes(0)).toBe('0 bytes');
      expect(formatBytes(1)).toBe('1 byte');
      expect(formatBytes(512)).toBe('512 bytes');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(-5)).toBe('—');
      expect(formatBytes(NaN)).toBe('—');
    });

    it('formats timestamps and rejects missing/invalid values', () => {
      expect(formatTimestamp(0)).toBe('—');
      expect(formatTimestamp(undefined)).toBe('—');
      expect(formatTimestamp(null)).toBe('—');
      // A real value produces a non-placeholder string.
      expect(formatTimestamp(Date.UTC(2026, 0, 1))).not.toBe('—');
    });

    it('builds rows for a browser File tab (size + last-modified, no path)', () => {
      const tab = {
        filename: 'notes.md',
        filePath: null,
        sourceMeta: { size: 2048, lastModified: Date.UTC(2026, 0, 2) },
      };
      const rows = buildInfoRows(tab);
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
      expect(byKey.name.value).toBe('notes.md');
      expect(byKey.location.value).toMatch(/browser/i);
      expect(byKey.size.value).toBe('2.0 KB');
      expect(byKey.modified.value).not.toBe('—');
      // No path means no created/owner rows on the web surface.
      expect(byKey.created).toBeUndefined();
      expect(byKey.owner).toBeUndefined();
    });

    it('builds rows for a URL tab (source URL as location)', () => {
      const tab = {
        filename: 'readme.md',
        filePath: null,
        sourceMeta: { url: 'https://example.com/readme.md' },
      };
      const rows = buildInfoRows(tab);
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
      expect(byKey.location.label).toBe('Source URL');
      expect(byKey.location.value).toBe('https://example.com/readme.md');
    });

    it('returns no rows for a null tab', () => {
      expect(buildInfoRows(null)).toEqual([]);
    });
  });

  it('opens an accessible modal describing the active document', () => {
    createTab('notes.md', '# Notes', null, { size: 100, lastModified: Date.UTC(2026, 0, 2) });
    openFileInfoSheet();

    expect(isFileInfoSheetOpen()).toBe(true);
    const dialog = document.querySelector('.file-info-sheet');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('File info');

    const nameCell = document.querySelector('[data-info-value="name"]');
    expect(nameCell.textContent).toBe('notes.md');
    // Web file has no path, so no Copy path button.
    expect(document.querySelector('.file-info-copy')).toBeNull();
  });

  it('warns and does not open when no document is active', () => {
    openFileInfoSheet();
    expect(isFileInfoSheetOpen()).toBe(false);
    expect(document.querySelector('.file-info-overlay')).toBeNull();
  });

  it('is idempotent — a second open does not stack overlays', () => {
    createTab('a.md', '# A', null, {});
    openFileInfoSheet();
    openFileInfoSheet();
    expect(document.querySelectorAll('.file-info-overlay').length).toBe(1);
  });

  it('closes on Escape within the sheet', () => {
    createTab('a.md', '# A', null, {});
    openFileInfoSheet();
    const dialog = document.querySelector('.file-info-sheet');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(isFileInfoSheetOpen()).toBe(false);
    expect(document.querySelector('.file-info-overlay')).toBeNull();
  });

  it('is offered in the overflow menu only when a document is open', () => {
    // No document → not offered.
    openOverflowMenu();
    let labels = Array.from(document.querySelectorAll('.overflow-menu-item')).map(
      (i) => i.textContent
    );
    expect(labels).not.toContain('File info');
    closeOverflowMenu();

    // With a document → offered, and clicking it opens the sheet.
    createTab('a.md', '# A', null, {});
    openOverflowMenu();
    labels = Array.from(document.querySelectorAll('.overflow-menu-item')).map(
      (i) => i.textContent
    );
    expect(labels).toContain('File info');

    const item = Array.from(document.querySelectorAll('.overflow-menu-item')).find(
      (i) => i.textContent === 'File info'
    );
    item.dispatchEvent(new Event('click', { bubbles: true }));
    expect(isFileInfoSheetOpen()).toBe(true);
  });
});

// Desktop variant: window.specdown must be set BEFORE loadApp so isDesktop
// resolves true at module-eval time (see the toolbarOverflow desktop block).
describe('File info sheet (desktop bridge)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.specdown = {
      isDesktop: true,
      watchFile: jest.fn(),
      unwatchFile: jest.fn(),
      requestRefreshFile: jest.fn(),
      getFileMetadata: jest.fn(() =>
        Promise.resolve({
          filePath: '/Users/me/.hidden/notes.md',
          size: 4096,
          birthtimeMs: Date.UTC(2026, 0, 1),
          mtimeMs: Date.UTC(2026, 0, 5),
          owner: 'me',
        })
      ),
      saveSession: jest.fn(),
      onFileOpened: jest.fn(),
      onCloseTab: jest.fn(),
      onFileChanged: jest.fn(),
      onTriggerPrint: jest.fn(),
      onTriggerSearch: jest.fn(),
      onApplyCustomCss: jest.fn(),
    };
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    if (isFileInfoSheetOpen()) closeFileInfoSheet();
    delete window.specdown;
  });

  it('shows the absolute path immediately and fills disk metadata from the bridge', async () => {
    createTab('notes.md', '# Notes', '/Users/me/.hidden/notes.md');
    openFileInfoSheet();

    // Path is known synchronously; the rest is "Loading…" until the fetch lands.
    const locationCell = document.querySelector('[data-info-value="location"]');
    expect(locationCell.textContent).toBe('/Users/me/.hidden/notes.md');
    expect(document.querySelector('[data-info-value="size"]').textContent).toBe('Loading…');
    expect(window.specdown.getFileMetadata).toHaveBeenCalledWith('/Users/me/.hidden/notes.md');

    await flush();

    expect(document.querySelector('[data-info-value="size"]').textContent).toBe('4.0 KB');
    expect(document.querySelector('[data-info-value="created"]').textContent).not.toBe('Loading…');
    expect(document.querySelector('[data-info-value="modified"]').textContent).not.toBe('Loading…');
    expect(document.querySelector('[data-info-value="owner"]').textContent).toBe('me');
  });

  it('offers a Copy path button for a file-backed tab', () => {
    createTab('notes.md', '# Notes', '/Users/me/.hidden/notes.md');
    openFileInfoSheet();
    const copyBtn = document.querySelector('.file-info-copy');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn.textContent).toBe('Copy path');
  });

  it('shows "Unavailable" when the bridge cannot stat the file', async () => {
    window.specdown.getFileMetadata = jest.fn(() => Promise.resolve(null));
    createTab('gone.md', '# Gone', '/tmp/gone.md');
    openFileInfoSheet();
    await flush();
    expect(document.querySelector('[data-info-value="size"]').textContent).toBe('Unavailable');
    expect(document.querySelector('[data-info-value="owner"]').textContent).toBe('Unavailable');
  });

  it('does not write metadata into a sheet that was closed mid-fetch', async () => {
    createTab('notes.md', '# Notes', '/Users/me/.hidden/notes.md');
    openFileInfoSheet();
    closeFileInfoSheet();
    await flush();
    // Nothing to assert on the DOM (overlay is gone) — the guard just must not throw.
    expect(isFileInfoSheetOpen()).toBe(false);
  });
});
