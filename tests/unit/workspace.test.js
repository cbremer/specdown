/**
 * Unit tests for workspace (folder) mode — the folder sidebar (collapsible
 * tree), auto-open, relative-link navigation, and both backends (desktop path
 * bridge + web File System Access).
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const file = (relPath, name) => ({ path: '/ws/' + relPath, relPath, name: name || relPath.split('/').pop() });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Workspace (folder) mode — desktop', () => {
  beforeEach(() => {
    localStorage.clear();
    window.specdown = {
      isDesktop: true,
      requestFileOpen: jest.fn(),
      requestOpenPath: jest.fn(),
      requestOpenFolder: jest.fn(),
      requestOpenRelative: jest.fn(),
      onWorkspaceOpened: jest.fn(),
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

  describe('entry points', () => {
    it('reveals the Open Folder button on desktop', () => {
      expect(document.getElementById('open-folder-button').style.display).not.toBe('none');
    });

    it('asks the shell to pick a folder when Open Folder is clicked', () => {
      document.getElementById('open-folder-button').dispatchEvent(new Event('click', { bubbles: true }));
      expect(window.specdown.requestOpenFolder).toHaveBeenCalledTimes(1);
      expect(window.specdown.requestFileOpen).not.toHaveBeenCalled();
    });
  });

  describe('tree sidebar', () => {
    it('renders files + folders and auto-opens the first file', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md'), file('docs/b.md')] });

      const files = [...document.querySelectorAll('.workspace-file-item')].map((b) => b.textContent);
      expect(files.sort()).toEqual(['a.md', 'b.md']); // basenames, not relPaths
      const dir = document.querySelector('.workspace-dir-item');
      expect(dir.textContent).toContain('docs');

      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/ws/a.md');
      expect(document.getElementById('workspace-sidebar').style.display).not.toBe('none');
    });

    it('prefers a top-level README when auto-opening', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md'), file('README.md')] });
      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/ws/README.md');
    });

    it('opens a file by path when its item is clicked', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md'), file('b.md')] });
      window.specdown.requestOpenPath.mockClear();

      const bItem = [...document.querySelectorAll('.workspace-file-item')].find((b) => b.textContent === 'b.md');
      bItem.dispatchEvent(new Event('click', { bubbles: true }));
      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/ws/b.md');
    });

    it('collapses and expands a folder', () => {
      applyWorkspace({ root: '/ws', files: [file('docs/b.md')] });
      const dir = document.querySelector('.workspace-dir-item');
      const childUl = dir.parentElement.querySelector('.workspace-tree');

      expect(childUl.style.display).not.toBe('none');
      dir.dispatchEvent(new Event('click', { bubbles: true }));
      expect(document.querySelector('.workspace-tree').style.display).toBe('none');
      document.querySelector('.workspace-dir-item').dispatchEvent(new Event('click', { bubbles: true }));
      expect(document.querySelector('.workspace-tree').style.display).not.toBe('none');
    });

    it('hides the sidebar for an empty folder', () => {
      applyWorkspace({ root: '/ws', files: [] });
      expect(document.getElementById('workspace-sidebar').style.display).toBe('none');
    });

    it('toggles sidebar visibility', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md')] });
      const sidebar = document.getElementById('workspace-sidebar');
      toggleWorkspaceSidebar();
      expect(sidebar.style.display).toBe('none');
      toggleWorkspaceSidebar();
      expect(sidebar.style.display).not.toBe('none');
    });
  });

  describe('relative links (desktop)', () => {
    function withActiveDoc(html) {
      applyWorkspace({ root: '/ws', files: [file('a.md')] });
      state.tabs.push({
        id: 1, filename: 'a.md', filePath: '/ws/a.md', rawMarkdown: '',
        viewMode: 'preview', scrollTop: 0, watching: false, hasUnseenChanges: false,
      });
      state.activeTabId = 1;
      const content = document.getElementById('markdown-content');
      content.innerHTML = html;
      return content;
    }

    it('routes a relative .md link to the shell, resolved against the active doc', () => {
      const content = withActiveDoc('<a href="./b.md">b</a>');
      content.querySelector('a').dispatchEvent(new Event('click', { bubbles: true }));
      expect(window.specdown.requestOpenRelative).toHaveBeenCalledWith('/ws/a.md', './b.md');
    });

    it('leaves external, anchor, and non-markdown links alone', () => {
      const content = withActiveDoc(
        '<a href="https://x.test/y.md">ext</a><a href="#h">anchor</a><a href="./pic.png">img</a>'
      );
      content.querySelectorAll('a').forEach((a) => a.dispatchEvent(new Event('click', { bubbles: true })));
      expect(window.specdown.requestOpenRelative).not.toHaveBeenCalled();
    });
  });
});

describe('Workspace pure helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  it('buildWorkspaceTree nests dirs (sorted) before files', () => {
    const tree = buildWorkspaceTree([
      { name: 'z.md', relPath: 'z.md' },
      { name: 'a.md', relPath: 'docs/a.md' },
      { name: 'b.md', relPath: 'docs/b.md' },
    ]);
    expect(tree[0].type).toBe('dir');
    expect(tree[0].name).toBe('docs');
    expect(tree[0].children.map((c) => c.name)).toEqual(['a.md', 'b.md']);
    expect(tree[1].type).toBe('file');
    expect(tree[1].name).toBe('z.md');
  });

  it('resolveRelativeRelPath normalizes . and ..', () => {
    expect(resolveRelativeRelPath('docs/a.md', './b.md')).toBe('docs/b.md');
    expect(resolveRelativeRelPath('docs/a.md', '../top.md')).toBe('top.md');
    expect(resolveRelativeRelPath('docs/guide/a.md', '../api/b.md')).toBe('docs/api/b.md');
    expect(resolveRelativeRelPath('a.md', './b.md#frag')).toBe('b.md');
  });
});

describe('Workspace (folder) mode — web', () => {
  // A minimal fake File System Access API.
  const fileHandle = (name, text) => ({ kind: 'file', name, getFile: jest.fn(async () => ({ text: async () => text })) });
  const dirHandle = (name, entries) => ({
    kind: 'directory', name,
    async *values() { for (const e of entries) yield e; },
  });

  beforeEach(() => {
    localStorage.clear();
    delete window.specdown;
    window.showDirectoryPicker = jest.fn(async () =>
      dirHandle('myfolder', [
        fileHandle('a.md', '# A'),
        dirHandle('docs', [fileHandle('b.md', '# B')]),
        fileHandle('notes.txt', 'ignored'),
        dirHandle('node_modules', [fileHandle('x.md', 'nope')]),
      ])
    );
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    delete window.showDirectoryPicker;
  });

  it('shows the Open Folder button when the API is available', () => {
    expect(document.getElementById('open-folder-button').style.display).not.toBe('none');
  });

  it('scans the picked folder (ignoring non-md + node_modules) into the tree', async () => {
    document.getElementById('open-folder-button').dispatchEvent(new Event('click', { bubbles: true }));
    await flush();
    await flush();

    const files = [...document.querySelectorAll('.workspace-file-item')].map((b) => b.textContent).sort();
    expect(files).toEqual(['a.md', 'b.md']); // notes.txt + node_modules/x.md excluded
    expect(document.querySelector('.workspace-dir-item').textContent).toContain('docs');
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
  });

  it('opens a web file by reading its handle', async () => {
    const handleA = fileHandle('a.md', '# A');
    applyWorkspace({ root: 'ws', files: [{ name: 'a.md', relPath: 'a.md', handle: handleA }] });
    await flush();
    expect(handleA.getFile).toHaveBeenCalled();
  });

  it('follows a relative link within the loaded web workspace', async () => {
    const handleA = fileHandle('a.md', '# A');
    const handleB = fileHandle('b.md', '# B');
    applyWorkspace({
      root: 'ws',
      files: [
        { name: 'a.md', relPath: 'a.md', handle: handleA },
        { name: 'b.md', relPath: 'b.md', handle: handleB },
      ],
    });
    await flush(); // auto-open a.md → sets the current relPath
    handleB.getFile.mockClear();

    const content = document.getElementById('markdown-content');
    content.innerHTML = '<a href="./b.md">b</a>';
    content.querySelector('a').dispatchEvent(new Event('click', { bubbles: true }));
    await flush();

    expect(handleB.getFile).toHaveBeenCalled();
  });
});
