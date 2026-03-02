/**
 * Unit tests for the GitHub repository file browser
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('GitHub Repo Browser', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);

    // Remove any leftover modal between tests
    const modal = document.getElementById('repo-browser-modal');
    if (modal) modal.remove();
  });

  afterEach(() => {
    // Restore fetch to the default mock set up in tests/setup.js
    global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
  });

  // ===========================
  // fetchGitHubRepoFiles
  // ===========================
  describe('fetchGitHubRepoFiles', () => {
    it('returns null for a non-GitHub URL', async () => {
      const result = await fetchGitHubRepoFiles('https://example.com/foo/bar');
      expect(result).toBeNull();
    });

    it('returns null for a GitHub URL that is not a bare repo (e.g. a file path)', async () => {
      const result = await fetchGitHubRepoFiles('https://github.com/owner/repo/blob/main/README.md');
      expect(result).toBeNull();
    });

    it('returns null when the fetch response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });

      const result = await fetchGitHubRepoFiles('https://github.com/owner/repo');
      expect(result).toBeNull();
    });

    it('returns null when fetch throws an error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await fetchGitHubRepoFiles('https://github.com/owner/repo');
      expect(result).toBeNull();
    });

    it('returns an empty array when the API returns no items', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await fetchGitHubRepoFiles('https://github.com/owner/repo');
      expect(result).toEqual([]);
    });

    it('returns file objects with path, url, and rawUrl', async () => {
      const items = [
        { path: 'README.md', html_url: 'https://github.com/owner/repo/blob/main/README.md' },
        { path: 'docs/guide.md', html_url: 'https://github.com/owner/repo/blob/main/docs/guide.md' },
      ];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items }),
      });

      const result = await fetchGitHubRepoFiles('https://github.com/owner/repo');

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('README.md');
      expect(result[0].rawUrl).toBe('https://raw.githubusercontent.com/owner/repo/HEAD/README.md');
      expect(result[1].path).toBe('docs/guide.md');
      expect(result[1].rawUrl).toBe('https://raw.githubusercontent.com/owner/repo/HEAD/docs/guide.md');
    });

    it('strips a trailing .git from the repo name', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ path: 'README.md', html_url: 'https://github.com/owner/repo/blob/main/README.md' }],
        }),
      });

      const result = await fetchGitHubRepoFiles('https://github.com/owner/repo.git');

      // The rawUrl should reference 'repo' without '.git'
      expect(result).not.toBeNull();
      expect(result[0].rawUrl).toBe('https://raw.githubusercontent.com/owner/repo/HEAD/README.md');
    });

    it('accepts a URL with a trailing slash', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await fetchGitHubRepoFiles('https://github.com/owner/repo/');
      expect(result).toEqual([]);
    });
  });

  // ===========================
  // showRepoBrowser
  // ===========================
  describe('showRepoBrowser', () => {
    const sampleFiles = [
      { path: 'README.md', url: 'https://github.com/owner/repo/blob/main/README.md', rawUrl: 'https://raw.githubusercontent.com/owner/repo/HEAD/README.md' },
      { path: 'docs/guide.md', url: 'https://github.com/owner/repo/blob/main/docs/guide.md', rawUrl: 'https://raw.githubusercontent.com/owner/repo/HEAD/docs/guide.md' },
    ];

    it('creates and displays the repo browser modal', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const modal = document.getElementById('repo-browser-modal');
      expect(modal).not.toBeNull();
      expect(modal.style.display).toBe('flex');
    });

    it('shows the repo name in the header', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const modal = document.getElementById('repo-browser-modal');
      expect(modal.querySelector('.repo-browser-title').textContent).toBe('owner/repo');
    });

    it('renders one list item per file', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const items = document.querySelectorAll('.repo-browser-item');
      expect(items.length).toBe(2);
    });

    it('each list item shows the file path', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const items = document.querySelectorAll('.repo-browser-item');
      expect(items[0].querySelector('.repo-file-path').textContent).toBe('README.md');
      expect(items[1].querySelector('.repo-file-path').textContent).toBe('docs/guide.md');
    });

    it('each list item has a data-raw-url attribute', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const items = document.querySelectorAll('.repo-browser-item');
      expect(items[0].getAttribute('data-raw-url')).toBe(sampleFiles[0].rawUrl);
    });

    it('close button hides the modal', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const closeBtn = document.querySelector('.repo-browser-close');
      closeBtn.click();

      const modal = document.getElementById('repo-browser-modal');
      expect(modal.style.display).toBe('none');
    });

    it('clicking the modal backdrop (outside content) hides the modal', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const modal = document.getElementById('repo-browser-modal');
      // Simulate a click directly on the modal overlay (target === modal)
      const evt = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(evt, 'target', { value: modal, configurable: true });
      modal.dispatchEvent(evt);

      expect(modal.style.display).toBe('none');
    });

    it('filter input hides non-matching items', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const filterInput = document.querySelector('.repo-browser-filter');
      filterInput.value = 'guide';
      filterInput.dispatchEvent(new Event('input'));

      const items = document.querySelectorAll('.repo-browser-item');
      const visibleItems = Array.from(items).filter((i) => i.style.display !== 'none');
      expect(visibleItems.length).toBe(1);
      expect(visibleItems[0].querySelector('.repo-file-path').textContent).toBe('docs/guide.md');
    });

    it('filter input is case-insensitive', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const filterInput = document.querySelector('.repo-browser-filter');
      filterInput.value = 'README';
      filterInput.dispatchEvent(new Event('input'));

      const items = document.querySelectorAll('.repo-browser-item');
      const visibleItems = Array.from(items).filter((i) => i.style.display !== 'none');
      expect(visibleItems.length).toBe(1);
      expect(visibleItems[0].querySelector('.repo-file-path').textContent).toBe('README.md');
    });

    it('re-uses the existing modal element on subsequent calls', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const modals = document.querySelectorAll('#repo-browser-modal');
      expect(modals.length).toBe(1);
    });
  });

  // ===========================
  // handleRepoUrl
  // ===========================
  describe('handleRepoUrl', () => {
    it('returns false for a non-GitHub URL', async () => {
      global.fetch = jest.fn(); // should not be called
      const result = await handleRepoUrl('https://example.com/not-a-repo');
      expect(result).toBe(false);
    });

    it('returns false when fetchGitHubRepoFiles returns null (fetch failed)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });

      const result = await handleRepoUrl('https://github.com/owner/repo');
      expect(result).toBe(false);
    });

    it('returns true and shows error when repo has no markdown files', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await handleRepoUrl('https://github.com/owner/repo');
      expect(result).toBe(true);
    });

    it('returns true and shows the repo browser when files are found', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ path: 'README.md', html_url: 'https://github.com/owner/repo/blob/main/README.md' }],
        }),
      });

      const result = await handleRepoUrl('https://github.com/owner/repo');
      expect(result).toBe(true);

      const modal = document.getElementById('repo-browser-modal');
      expect(modal).not.toBeNull();
      expect(modal.style.display).toBe('flex');
    });
  });
});
