/**
 * Unit tests for workspace (folder) mode — the desktop-only folder sidebar,
 * auto-open, and relative-link navigation wired in the renderer.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const file = (relPath, name) => ({ path: '/ws/' + relPath, relPath, name: name || relPath });

describe('Workspace (folder) mode', () => {
  beforeEach(() => {
    localStorage.clear();
    // isDesktop is resolved at module-load time, so the bridge must exist
    // before loadApp evals the graph.
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
      const btn = document.getElementById('open-folder-button');
      expect(btn.style.display).not.toBe('none');
    });

    it('asks the shell to pick a folder when Open Folder is clicked', () => {
      document.getElementById('open-folder-button').dispatchEvent(new Event('click', { bubbles: true }));
      expect(window.specdown.requestOpenFolder).toHaveBeenCalledTimes(1);
      // Must not also trip the drop-zone's click-to-browse (file open) handler.
      expect(window.specdown.requestFileOpen).not.toHaveBeenCalled();
    });
  });

  describe('sidebar', () => {
    it('renders one item per file and auto-opens the first when nothing is open', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md'), file('docs/b.md', 'b.md')] });

      const items = document.querySelectorAll('.workspace-file-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('a.md');
      expect(items[1].textContent).toBe('docs/b.md');

      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/ws/a.md');
      expect(document.getElementById('workspace-sidebar').style.display).not.toBe('none');
    });

    it('prefers a top-level README when auto-opening', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md'), file('README.md')] });
      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/ws/README.md');
    });

    it('opens a file by path when its sidebar item is clicked', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md'), file('b.md')] });
      window.specdown.requestOpenPath.mockClear();

      document.querySelectorAll('.workspace-file-item')[1].dispatchEvent(new Event('click', { bubbles: true }));
      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/ws/b.md');
    });

    it('hides the sidebar for an empty folder', () => {
      applyWorkspace({ root: '/ws', files: [] });
      expect(document.getElementById('workspace-sidebar').style.display).toBe('none');
    });

    it('toggles sidebar visibility', () => {
      applyWorkspace({ root: '/ws', files: [file('a.md')] });
      const sidebar = document.getElementById('workspace-sidebar');
      expect(sidebar.style.display).not.toBe('none');

      toggleWorkspaceSidebar();
      expect(sidebar.style.display).toBe('none');
      toggleWorkspaceSidebar();
      expect(sidebar.style.display).not.toBe('none');
    });
  });

  describe('relative links', () => {
    // Put a workspace + an active file-backed tab in place, then inject a link.
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
