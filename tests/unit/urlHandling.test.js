/**
 * Unit tests for URL loading functionality
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('URL Handling', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
    // Clear call history from checkForUpdates() which runs during init()
    global.fetch.mockClear();
  });

  // ===========================
  // normalizeMarkdownUrl
  // ===========================
  describe('normalizeMarkdownUrl', () => {
    it('converts a GitHub blob URL to a raw githubusercontent URL', () => {
      const input = 'https://github.com/cbremer/specdown/blob/main/README.md';
      const expected = 'https://raw.githubusercontent.com/cbremer/specdown/main/README.md';
      expect(normalizeMarkdownUrl(input)).toBe(expected);
    });

    it('converts a GitHub blob URL with a deep path', () => {
      const input = 'https://github.com/user/repo/blob/feature-branch/docs/spec.md';
      const expected = 'https://raw.githubusercontent.com/user/repo/feature-branch/docs/spec.md';
      expect(normalizeMarkdownUrl(input)).toBe(expected);
    });

    it('returns a raw githubusercontent URL unchanged', () => {
      const url = 'https://raw.githubusercontent.com/user/repo/main/README.md';
      expect(normalizeMarkdownUrl(url)).toBe(url);
    });

    it('returns a non-GitHub URL unchanged', () => {
      const url = 'https://example.com/docs/file.md';
      expect(normalizeMarkdownUrl(url)).toBe(url);
    });

    it('handles http GitHub blob URLs', () => {
      const input = 'http://github.com/user/repo/blob/main/file.md';
      const expected = 'https://raw.githubusercontent.com/user/repo/main/file.md';
      expect(normalizeMarkdownUrl(input)).toBe(expected);
    });
  });

  // ===========================
  // getFilenameFromUrl
  // ===========================
  describe('getFilenameFromUrl', () => {
    it('extracts the filename from a raw githubusercontent URL', () => {
      const url = 'https://raw.githubusercontent.com/user/repo/main/README.md';
      expect(getFilenameFromUrl(url)).toBe('README.md');
    });

    it('extracts the filename from a deep path URL', () => {
      const url = 'https://example.com/docs/project/spec-v1.md';
      expect(getFilenameFromUrl(url)).toBe('spec-v1.md');
    });

    it('returns untitled.md for a bare domain URL', () => {
      const url = 'https://example.com/';
      expect(getFilenameFromUrl(url)).toBe('untitled.md');
    });

    it('returns untitled.md for an invalid URL', () => {
      expect(getFilenameFromUrl('not-a-url')).toBe('untitled.md');
    });

    it('returns untitled.md for a URL with no path segments', () => {
      const url = 'https://example.com';
      expect(getFilenameFromUrl(url)).toBe('untitled.md');
    });
  });

  // ===========================
  // handleUrl
  // ===========================
  describe('handleUrl', () => {
    it('shows an error and does not fetch for an empty string', async () => {
      await handleUrl('');
      expect(global.fetch).not.toHaveBeenCalled();
      const errorEl = document.getElementById('url-error');
      expect(errorEl.style.display).not.toBe('none');
      expect(errorEl.textContent).toMatch(/valid URL/);
    });

    it('shows an error and does not fetch for a non-http string', async () => {
      await handleUrl('file:///local/path.md');
      expect(global.fetch).not.toHaveBeenCalled();
      const errorEl = document.getElementById('url-error');
      expect(errorEl.style.display).not.toBe('none');
    });

    it('fetches the normalized URL on success and creates a tab', async () => {
      const markdown = '# Hello from URL';
      global.fetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(markdown),
      }));

      await handleUrl('https://raw.githubusercontent.com/user/repo/main/README.md');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/user/repo/main/README.md'
      );

      // Content area should be visible (tab was created)
      const contentArea = document.getElementById('content-area');
      expect(contentArea.style.display).not.toBe('none');
    });

    it('auto-converts a GitHub blob URL before fetching', async () => {
      global.fetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('# Spec'),
      }));

      await handleUrl('https://github.com/user/repo/blob/main/spec.md');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/user/repo/main/spec.md'
      );
    });

    it('shows an HTTP error message when response is not ok', async () => {
      global.fetch.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 404,
      }));

      await handleUrl('https://example.com/missing.md');

      const errorEl = document.getElementById('url-error');
      expect(errorEl.style.display).not.toBe('none');
      expect(errorEl.textContent).toMatch(/404/);
    });

    it('shows a CORS error message when fetch throws a network error', async () => {
      global.fetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));

      await handleUrl('https://example.com/file.md');

      const errorEl = document.getElementById('url-error');
      expect(errorEl.style.display).not.toBe('none');
      expect(errorEl.textContent).toMatch(/cross-origin/i);
    });

    it('clears a previous error when called with a valid URL that succeeds', async () => {
      // First call — produce an error
      await handleUrl('');
      const errorEl = document.getElementById('url-error');
      expect(errorEl.style.display).not.toBe('none');

      // Second call — should succeed and clear the error
      global.fetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('# Good'),
      }));
      await handleUrl('https://raw.githubusercontent.com/user/repo/main/README.md');
      expect(errorEl.style.display).toBe('none');
    });
  });
});
