/**
 * Unit tests for shareable Mermaid diagram deep links
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Shareable Diagram Links', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);

    // Mock URL methods
    global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    delete global.URL.createObjectURL;
    delete global.URL.revokeObjectURL;
  });

  // ===========================
  // showShareToast
  // ===========================
  describe('showShareToast', () => {
    it('makes the share toast visible', () => {
      const toast = document.getElementById('share-toast');
      toast.style.display = 'none';

      showShareToast();

      expect(toast.style.display).not.toBe('none');
    });

    it('hides the toast after a timeout', () => {
      jest.useFakeTimers();
      const toast = document.getElementById('share-toast');

      showShareToast();
      expect(toast.style.display).not.toBe('none');

      jest.advanceTimersByTime(3000);
      expect(toast.style.display).toBe('none');

      jest.useRealTimers();
    });
  });

  // ===========================
  // shareDiagramLink
  // ===========================
  describe('shareDiagramLink', () => {
    function insertDiagramWithSource(diagramId, source) {
      const mc = document.getElementById('markdown-content');
      const wrapper = document.createElement('div');
      wrapper.id = 'wrapper-' + diagramId;
      wrapper.className = 'diagram-wrapper';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('data-mermaid-source', source);
      wrapper.appendChild(svg);
      mc.appendChild(wrapper);
    }

    it('does nothing when the wrapper does not exist', () => {
      const writeSpy = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeSpy },
        configurable: true,
      });

      shareDiagramLink('no-such-id');

      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('does nothing when the SVG has no data-mermaid-source', () => {
      const mc = document.getElementById('markdown-content');
      const wrapper = document.createElement('div');
      wrapper.id = 'wrapper-no-source';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      wrapper.appendChild(svg);
      mc.appendChild(wrapper);

      const writeSpy = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeSpy },
        configurable: true,
      });

      shareDiagramLink('no-source');

      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('writes a URL containing the encoded diagram source to the clipboard', async () => {
      const source = 'graph TD\nA-->B';
      insertDiagramWithSource('share-test-1', source);

      const writeSpy = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeSpy },
        configurable: true,
      });

      shareDiagramLink('share-test-1');

      await Promise.resolve(); // flush microtasks
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const url = writeSpy.mock.calls[0][0];
      expect(url).toContain('?diagram=');
    });

    it('the encoded URL can be decoded back to the original source', async () => {
      const source = 'graph LR\nX-->Y-->Z';
      insertDiagramWithSource('share-test-2', source);

      let capturedUrl = null;
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: (url) => { capturedUrl = url; return Promise.resolve(); } },
        configurable: true,
      });

      shareDiagramLink('share-test-2');
      await Promise.resolve();

      const encoded = new URL(capturedUrl).searchParams.get('diagram');
      const decoded = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
      expect(decoded).toBe(source);
    });

    it('falls back to execCommand when clipboard API is unavailable', () => {
      const source = 'graph TD\nA-->B';
      insertDiagramWithSource('share-test-3', source);

      // Remove clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });

      // jsdom doesn't define execCommand — assign a mock directly
      document.execCommand = jest.fn(() => true);

      shareDiagramLink('share-test-3');

      expect(document.execCommand).toHaveBeenCalledWith('copy');
      delete document.execCommand;
    });
  });

  // ===========================
  // checkForDiagramLink
  // ===========================
  describe('checkForDiagramLink', () => {
    it('does nothing when there is no ?diagram= param', () => {
      // window.location.search is '' in jsdom by default
      const initialTabs = tabs.length;
      checkForDiagramLink();
      expect(tabs.length).toBe(initialTabs);
    });

    it('creates a tab when a valid encoded diagram is in the URL', () => {
      const source = 'graph TD\nStart-->End';
      const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(source))));

      // Temporarily override window.location.search
      const originalSearch = window.location.search;
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?diagram=' + encoded },
        configurable: true,
        writable: true,
      });

      checkForDiagramLink();

      expect(tabs.length).toBeGreaterThan(0);
      const tab = tabs[tabs.length - 1];
      expect(tab.filename).toBe('shared-diagram.md');
      expect(tab.rawMarkdown).toContain(source);

      // Restore
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: originalSearch },
        configurable: true,
        writable: true,
      });
    });

    it('silently ignores a malformed diagram param', () => {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?diagram=NOT_VALID_BASE64!!!@@@' },
        configurable: true,
        writable: true,
      });

      expect(() => checkForDiagramLink()).not.toThrow();

      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '' },
        configurable: true,
        writable: true,
      });
    });
  });
});
