/**
 * Unit tests for opening existing Mermaid diagram deep links
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
  // checkForDiagramLink
  // ===========================
  describe('checkForDiagramLink', () => {
    it('does nothing when there is no ?diagram= param', () => {
      // window.location.search is '' in jsdom by default
      const initialTabs = state.tabs.length;
      checkForDiagramLink();
      expect(state.tabs.length).toBe(initialTabs);
    });

    it('creates a tab when a valid encoded diagram is in the URL', () => {
      const source = 'graph TD\nStart-->End';
      const encoded = encodeURIComponent(
        btoa(unescape(encodeURIComponent(source)))
      );

      // Set window.location.search via the History API. jsdom (jest 30+)
      // makes window.location non-configurable, so redefining the property
      // throws; replaceState updates location.search without that.
      window.history.replaceState({}, '', '?diagram=' + encoded);

      checkForDiagramLink();

      expect(state.tabs.length).toBeGreaterThan(0);
      const tab = state.tabs[state.tabs.length - 1];
      expect(tab.filename).toBe('shared-diagram.md');
      expect(tab.rawMarkdown).toContain(source);

      // Restore
      window.history.replaceState({}, '', '/');
    });

    it('silently ignores a malformed diagram param', () => {
      window.history.replaceState({}, '', '?diagram=NOT_VALID_BASE64!!!@@@');

      expect(() => checkForDiagramLink()).not.toThrow();

      window.history.replaceState({}, '', '/');
    });
  });
});
