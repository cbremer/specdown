const { TextEncoder, TextDecoder } = require('node:util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
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
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
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
  const sha = 'a'.repeat(40);
  const treeSha = 'b'.repeat(40);
  function apiResponse(data, status = 200) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let read = false;
    return {
      ok: status === 200,
      status,
      headers: new Headers(),
      body: {
        cancel: jest.fn().mockResolvedValue(undefined),
        getReader: () => ({
          read: async () =>
            read
              ? { done: true }
              : ((read = true), { done: false, value: bytes }),
          cancel: jest.fn().mockResolvedValue(undefined),
          releaseLock: jest.fn(),
        }),
      },
    };
  }
  function publicRepo(
    tree = [{ path: 'README.md', type: 'blob', mode: '100644' }]
  ) {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(apiResponse({ default_branch: 'trunk' }))
      .mockResolvedValueOnce(
        apiResponse({ sha, commit: { tree: { sha: treeSha } } })
      )
      .mockResolvedValueOnce(apiResponse({ tree, truncated: false }));
  }

  describe('fetchGitHubRepoFiles', () => {
    it.each([
      'https://example.com/foo/bar',
      'https://github.com/owner/repo/blob/main/README.md',
      'http://github.com/owner/repo',
      'https://user:pass@github.com/owner/repo',
      'https://github.com/owner/repo?token=secret',
      'https://github.com/owner%2frepo/other',
    ])('does not recognize unsafe or nonrepository input %s', async (url) => {
      global.fetch = jest.fn();
      expect(await fetchGitHubRepoFiles(url)).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('lists public markdown without authenticated code search and pins raw URLs to the selected commit', async () => {
      publicRepo([
        { path: 'README.md', type: 'blob', mode: '100644' },
        { path: 'docs/a #?%.markdown', type: 'blob', mode: '100644' },
        { path: 'skip.md', type: 'blob', mode: '120000' },
        { path: 'index.js', type: 'blob', mode: '100644' },
      ]);
      const result = await fetchGitHubRepoFiles(
        'https://github.com/owner/repo.git/'
      );
      expect(result.map((f) => f.path)).toEqual([
        'docs/a #?%.markdown',
        'README.md',
      ]);
      expect(result[0].rawUrl).toBe(
        `https://raw.githubusercontent.com/owner/repo/${sha}/docs/a%20%23%3F%25.markdown`
      );
      expect(global.fetch.mock.calls.map((c) => c[0])).toEqual([
        'https://api.github.com/repos/owner/repo',
        'https://api.github.com/repos/owner/repo/commits/trunk',
        `https://api.github.com/repos/owner/repo/git/trees/${treeSha}?recursive=1`,
      ]);
      for (const [, options] of global.fetch.mock.calls) {
        expect(options.credentials).toBe('omit');
        expect(options.redirect).toBe('error');
      }
    });

    it('resolves a slash-containing branch without rewriting the raw snapshot', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          apiResponse({ sha, commit: { tree: { sha: treeSha } } })
        )
        .mockResolvedValueOnce(
          apiResponse({
            tree: [
              { path: 'docs/guide.md', type: 'blob', mode: '100644' },
              { path: 'other.md', type: 'blob', mode: '100644' },
            ],
            truncated: false,
          })
        );
      const files = await fetchGitHubRepoFiles(
        'https://github.com/o/r/tree/feature%2Fdocs/docs'
      );
      expect(global.fetch.mock.calls[0][0]).toBe(
        'https://api.github.com/repos/o/r/commits/feature%2Fdocs%2Fdocs'
      );
      // The longest ref exists in this fixture; no subtree remains.
      expect(files).toHaveLength(2);
    });

    it('disambiguates branch/path with bounded 404-only ref lookup', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(apiResponse({}, 404))
        .mockResolvedValueOnce(
          apiResponse({ sha, commit: { tree: { sha: treeSha } } })
        )
        .mockResolvedValueOnce(
          apiResponse({
            tree: [
              { path: 'docs/guide.md', type: 'blob', mode: '100644' },
              { path: 'other.md', type: 'blob', mode: '100644' },
            ],
            truncated: false,
          })
        );
      const files = await fetchGitHubRepoFiles(
        'https://github.com/o/r/tree/feature%2Fdocs/docs'
      );
      expect(files.map((f) => f.path)).toEqual(['docs/guide.md']);
      expect(global.fetch.mock.calls[1][0]).toBe(
        'https://api.github.com/repos/o/r/commits/feature%2Fdocs'
      );
    });

    it('treats GitHub missing-ref 422 as a ref miss, but does not hide other validation failures', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          apiResponse({ message: 'No commit found for SHA: main/docs' }, 422)
        )
        .mockResolvedValueOnce(
          apiResponse({ sha, commit: { tree: { sha: treeSha } } })
        )
        .mockResolvedValueOnce(
          apiResponse({
            tree: [{ path: 'docs/guide.md', type: 'blob', mode: '100644' }],
            truncated: false,
          })
        );
      expect(
        (
          await fetchGitHubRepoFiles('https://github.com/o/r/tree/main/docs')
        ).map((f) => f.path)
      ).toEqual(['docs/guide.md']);
      global.fetch = jest
        .fn()
        .mockResolvedValue(apiResponse({ message: 'Validation Failed' }, 422));
      await expect(
        fetchGitHubRepoFiles('https://github.com/o/r/tree/main/docs')
      ).rejects.toThrow(/validation/i);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns an empty list for an empty repository', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(apiResponse({ default_branch: 'main' }))
        .mockResolvedValueOnce(apiResponse({}, 409));
      expect(await fetchGitHubRepoFiles('https://github.com/o/r')).toEqual([]);
    });

    it.each([403, 429, 404, 500])(
      'surfaces API %i without falling through to HTML fetch',
      async (status) => {
        global.fetch = jest.fn().mockResolvedValue(apiResponse({}, status));
        await expect(
          fetchGitHubRepoFiles('https://github.com/o/r')
        ).rejects.toThrow();
        const h = {
          clearError: jest.fn(),
          showError: jest.fn(),
          onSelectFile: jest.fn(),
        };
        expect(await handleRepoUrl('https://github.com/o/r', h)).toBe(true);
        expect(h.showError).toHaveBeenCalledWith(
          expect.stringMatching(
            status === 403 || status === 429
              ? /rate limit/i
              : /unavailable|GitHub/i
          )
        );
      }
    );

    it('traverses complete nonrecursive subtrees when recursive response is truncated', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(apiResponse({ default_branch: 'main' }))
        .mockResolvedValueOnce(
          apiResponse({ sha, commit: { tree: { sha: treeSha } } })
        )
        .mockResolvedValueOnce(apiResponse({ tree: [], truncated: true }))
        .mockResolvedValueOnce(
          apiResponse({
            tree: [
              {
                type: 'tree',
                mode: '040000',
                path: 'docs',
                sha: 'c'.repeat(40),
              },
            ],
            truncated: false,
          })
        )
        .mockResolvedValueOnce(
          apiResponse({
            tree: [{ type: 'blob', mode: '100644', path: 'guide.md' }],
            truncated: false,
          })
        );
      expect(
        (await fetchGitHubRepoFiles('https://github.com/o/r')).map(
          (f) => f.path
        )
      ).toEqual(['docs/guide.md']);
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    it('rejects truncated fallback instead of advertising incomplete results', async () => {
      publicRepo();
      global.fetch
        .mockReset()
        .mockResolvedValueOnce(apiResponse({ default_branch: 'main' }))
        .mockResolvedValueOnce(
          apiResponse({ sha, commit: { tree: { sha: treeSha } } })
        )
        .mockImplementation(async () =>
          apiResponse({ tree: [], truncated: true })
        );
      await expect(
        fetchGitHubRepoFiles('https://github.com/o/r')
      ).rejects.toThrow(/large|incomplete|limit/i);
    });

    it('rejects malformed paths and never follows supplied API URLs', async () => {
      publicRepo([
        {
          path: '../secret.md',
          type: 'blob',
          mode: '100644',
          url: 'https://evil.example',
        },
      ]);
      await expect(
        fetchGitHubRepoFiles('https://github.com/o/r')
      ).rejects.toThrow(/invalid/i);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('rejects oversized response before reading it', async () => {
      const response = apiResponse({});
      response.headers.set('content-length', '999999999');
      response.body.getReader = jest.fn();
      global.fetch = jest.fn().mockResolvedValue(response);
      await expect(
        fetchGitHubRepoFiles('https://github.com/o/r')
      ).rejects.toThrow(/large|limit/i);
      expect(response.body.getReader).not.toHaveBeenCalled();
    });

    it('recognizes deep tree URLs and reports capacity without fetching repository HTML', async () => {
      const url = 'https://github.com/o/r/tree/main/a/b/c/d/e/f/g/h/i';
      const h = {
        clearError: jest.fn(),
        showError: jest.fn(),
        onSelectFile: jest.fn(),
      };
      global.fetch = jest.fn();
      expect(await handleRepoUrl(url, h)).toBe(true);
      expect(h.showError).toHaveBeenCalledWith(expect.stringMatching(/limit/i));
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('bounds streamed bytes even without Content-Length and cancels the reader', async () => {
      const cancel = jest.fn().mockResolvedValue(undefined);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: {
          getReader: () => ({
            read: async () => ({
              done: false,
              value: new Uint8Array(8 * 1024 * 1024 + 1),
            }),
            cancel,
            releaseLock: jest.fn(),
          }),
        },
      });
      await expect(
        fetchGitHubRepoFiles('https://github.com/o/r')
      ).rejects.toThrow(/size limit/i);
      expect(cancel).toHaveBeenCalled();
    });

    it('bounds file count without returning a partial list', async () => {
      publicRepo(
        Array.from({ length: 2001 }, (_, i) => ({
          path: `${i}.md`,
          type: 'blob',
          mode: '100644',
        }))
      );
      await expect(
        fetchGitHubRepoFiles('https://github.com/o/r')
      ).rejects.toThrow(/file limit/i);
    });

    it('bounds fallback traversal requests instead of recursively exhausting the API', async () => {
      let count = 0;
      global.fetch = jest.fn(async () => {
        count++;
        if (count === 1) return apiResponse({ default_branch: 'main' });
        if (count === 2)
          return apiResponse({ sha, commit: { tree: { sha: treeSha } } });
        if (count === 3) return apiResponse({ tree: [], truncated: true });
        return apiResponse({
          tree: [
            { path: 'nested', type: 'tree', mode: '040000', sha: treeSha },
          ],
          truncated: false,
        });
      });
      await expect(
        fetchGitHubRepoFiles('https://github.com/o/r')
      ).rejects.toThrow(/limit/i);
      expect(global.fetch).toHaveBeenCalledTimes(32);
    });

    it('ignores a late result after the accepted document is replaced', async () => {
      let resolve;
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() => new Promise((r) => (resolve = r)));
      const h = {
        clearError: jest.fn(),
        showError: jest.fn(),
        onSelectFile: jest.fn(),
      };
      const pending = handleRepoUrl('https://github.com/o/r', h);
      invalidateDocumentContext();
      resolve(apiResponse({}, 404));
      expect(await pending).toBe(true);
      expect(h.showError).not.toHaveBeenCalled();
    });

    it('ignores a late repo response after another URL starts', async () => {
      let resolve;
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() => new Promise((r) => (resolve = r)));
      const first = {
        clearError: jest.fn(),
        showError: jest.fn(),
        onSelectFile: jest.fn(),
      };
      const pending = handleRepoUrl('https://github.com/o/r', first);
      await handleRepoUrl('https://example.com/raw.md', first);
      resolve(apiResponse({}, 404));
      expect(await pending).toBe(true);
      expect(first.showError).not.toHaveBeenCalled();
    });
  });

  // ===========================
  // showRepoBrowser
  // ===========================
  describe('showRepoBrowser', () => {
    const sampleFiles = [
      {
        path: 'README.md',
        url: 'https://github.com/owner/repo/blob/main/README.md',
        rawUrl: 'https://raw.githubusercontent.com/owner/repo/HEAD/README.md',
      },
      {
        path: 'docs/guide.md',
        url: 'https://github.com/owner/repo/blob/main/docs/guide.md',
        rawUrl:
          'https://raw.githubusercontent.com/owner/repo/HEAD/docs/guide.md',
      },
    ];

    it('opens the selected file with the keyboard', () => {
      const selected = jest.fn();
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo', selected);
      const item = document.querySelector('.repo-browser-item');
      expect(item.getAttribute('tabindex')).toBe('0');
      item.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      expect(selected).toHaveBeenCalledWith(sampleFiles[0].rawUrl);
      expect(document.getElementById('repo-browser-modal').style.display).toBe(
        'none'
      );
    });

    it('creates and displays the repo browser modal', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const modal = document.getElementById('repo-browser-modal');
      expect(modal).not.toBeNull();
      expect(modal.style.display).toBe('flex');
    });

    it('shows the repo name in the header', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const modal = document.getElementById('repo-browser-modal');
      expect(modal.querySelector('.repo-browser-title').textContent).toBe(
        'owner/repo'
      );
    });

    it('renders one list item per file', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const items = document.querySelectorAll('.repo-browser-item');
      expect(items.length).toBe(2);
    });

    it('each list item shows the file path', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const items = document.querySelectorAll('.repo-browser-item');
      expect(items[0].querySelector('.repo-file-path').textContent).toBe(
        'README.md'
      );
      expect(items[1].querySelector('.repo-file-path').textContent).toBe(
        'docs/guide.md'
      );
    });

    it('each list item has a data-raw-url attribute', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const items = document.querySelectorAll('.repo-browser-item');
      expect(items[0].getAttribute('data-raw-url')).toBe(sampleFiles[0].rawUrl);
    });

    it('backdrop click still closes after repeated opens (no listener stacking)', () => {
      // Regression: the backdrop listener used to be re-bound on every open of
      // the reused modal element, stacking handlers + captured focus-trap
      // closures. The listener is now bound once and delegates to the active
      // instance, so repeated opens keep exactly one close path.
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const modal = document.getElementById('repo-browser-modal');
      expect(modal.style.display).toBe('flex');

      // Click directly on the backdrop (target === modal) → closes.
      modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(modal.style.display).toBe('none');

      // A stray backdrop click while closed is a harmless no-op…
      expect(() =>
        modal.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      ).not.toThrow();

      // …and the browser still opens and closes normally afterwards.
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');
      expect(modal.style.display).toBe('flex');
      modal.querySelector('.repo-browser-close').click();
      expect(modal.style.display).toBe('none');
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
      Object.defineProperty(evt, 'target', {
        value: modal,
        configurable: true,
      });
      modal.dispatchEvent(evt);

      expect(modal.style.display).toBe('none');
    });

    it('filter input hides non-matching items', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const filterInput = document.querySelector('.repo-browser-filter');
      filterInput.value = 'guide';
      filterInput.dispatchEvent(new Event('input'));

      const items = document.querySelectorAll('.repo-browser-item');
      const visibleItems = Array.from(items).filter(
        (i) => i.style.display !== 'none'
      );
      expect(visibleItems.length).toBe(1);
      expect(visibleItems[0].querySelector('.repo-file-path').textContent).toBe(
        'docs/guide.md'
      );
    });

    it('filter input is case-insensitive', () => {
      showRepoBrowser(sampleFiles, 'https://github.com/owner/repo');

      const filterInput = document.querySelector('.repo-browser-filter');
      filterInput.value = 'README';
      filterInput.dispatchEvent(new Event('input'));

      const items = document.querySelectorAll('.repo-browser-item');
      const visibleItems = Array.from(items).filter(
        (i) => i.style.display !== 'none'
      );
      expect(visibleItems.length).toBe(1);
      expect(visibleItems[0].querySelector('.repo-file-path').textContent).toBe(
        'README.md'
      );
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
    const hooks = () => ({
      clearError: jest.fn(),
      showError: jest.fn(),
      onSelectFile: jest.fn(),
    });

    it('returns false for a non-GitHub URL', async () => {
      global.fetch = jest.fn(); // should not be called
      const result = await handleRepoUrl(
        'https://example.com/not-a-repo',
        hooks()
      );
      expect(result).toBe(false);
    });

    it('returns true and shows error when repo has no markdown files', async () => {
      publicRepo([]);

      const result = await handleRepoUrl(
        'https://github.com/owner/repo',
        hooks()
      );
      expect(result).toBe(true);
    });

    it('returns true and shows the repo browser when files are found', async () => {
      publicRepo();

      const result = await handleRepoUrl(
        'https://github.com/owner/repo',
        hooks()
      );
      expect(result).toBe(true);

      const modal = document.getElementById('repo-browser-modal');
      expect(modal).not.toBeNull();
      expect(modal.style.display).toBe('flex');
    });
  });
});
