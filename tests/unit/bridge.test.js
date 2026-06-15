/**
 * Unit tests for the desktop bridge seam (platform/bridge.js) — the single
 * place the renderer talks to the native shell. Proxies when present, safe
 * no-ops when absent (web/iOS).
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Desktop bridge seam', () => {
  afterEach(() => {
    delete window.specdown;
  });

  describe('with a desktop bridge present', () => {
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
        watchFile: jest.fn(),
        unwatchFile: jest.fn(),
        onFileChanged: jest.fn(),
        saveSession: jest.fn(),
        onTriggerPrint: jest.fn(),
        onTriggerSearch: jest.fn(),
        onApplyCustomCss: jest.fn(),
      };
      loadHTML(document);
      loadApp(document);
    });

    it('reports the bridge is present', () => {
      expect(hasDesktopBridge()).toBe(true);
    });

    it('proxies command calls through to the bridge', () => {
      bridgeRequestFileOpen();
      bridgeRequestOpenPath('/a.md');
      bridgeRequestOpenFolder();
      bridgeRequestOpenRelative('/a.md', './b.md');
      bridgeWatchFile('/a.md');
      bridgeUnwatchFile('/a.md');
      bridgeSaveSession([{ filePath: '/a.md', filename: 'a.md' }]);

      expect(window.specdown.requestFileOpen).toHaveBeenCalled();
      expect(window.specdown.requestOpenPath).toHaveBeenCalledWith('/a.md');
      expect(window.specdown.requestOpenFolder).toHaveBeenCalled();
      expect(window.specdown.requestOpenRelative).toHaveBeenCalledWith('/a.md', './b.md');
      expect(window.specdown.watchFile).toHaveBeenCalledWith('/a.md');
      expect(window.specdown.unwatchFile).toHaveBeenCalledWith('/a.md');
      expect(window.specdown.saveSession).toHaveBeenCalledWith([{ filePath: '/a.md', filename: 'a.md' }]);
    });

    it('registers event callbacks with the bridge', () => {
      const cb = jest.fn();
      bridgeOnFileOpened(cb);
      bridgeOnWorkspaceOpened(cb);
      expect(window.specdown.onFileOpened).toHaveBeenCalledWith(cb);
      expect(window.specdown.onWorkspaceOpened).toHaveBeenCalledWith(cb);
    });
  });

  describe('without a desktop bridge (web / iOS)', () => {
    beforeEach(() => {
      localStorage.clear();
      delete window.specdown;
      loadHTML(document);
      loadApp(document);
    });

    it('reports no bridge and no-ops safely', () => {
      expect(hasDesktopBridge()).toBe(false);
      expect(() => {
        bridgeRequestFileOpen();
        bridgeRequestOpenPath('/a.md');
        bridgeRequestOpenFolder();
        bridgeOnFileOpened(() => {});
        bridgeSaveSession([]);
      }).not.toThrow();
    });
  });
});
