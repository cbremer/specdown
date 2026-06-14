/**
 * Unit tests for theme management functionality
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Theme Management', () => {
  beforeEach(() => {
    // Clear localStorage before each test (call is already mocked in setup.js)
    localStorage.clear();

    // Load HTML structure
    loadHTML(document);
  });

  describe('setupTheme', () => {
    it('should apply theme from localStorage', () => {
      localStorage.getItem.mockReturnValue('dark');

      loadApp(document);

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should default to light theme when localStorage is empty', () => {
      localStorage.getItem.mockReturnValue(null);

      loadApp(document);

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should update theme icon correctly on init', () => {
      localStorage.getItem.mockReturnValue('dark');

      loadApp(document);

      const icon = document.querySelector('.theme-icon');
      expect(icon.textContent).toBe('☀️');
    });

    it('should show moon icon in light theme', () => {
      localStorage.getItem.mockReturnValue('light');

      loadApp(document);

      const icon = document.querySelector('.theme-icon');
      expect(icon.textContent).toBe('🌙');
    });
  });

  describe('toggleTheme', () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue('light');
      loadApp(document);
    });

    it('should toggle from light to dark', () => {
      toggleTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('cycles light → dark → auto → light', () => {
      toggleTheme(); // → dark
      expect(state.themePreference).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      toggleTheme(); // → auto (resolves to light with no matchMedia in jsdom)
      expect(state.themePreference).toBe('auto');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      toggleTheme(); // → light
      expect(state.themePreference).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should persist the preference to localStorage', () => {
      toggleTheme();

      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should update DOM attribute', () => {
      toggleTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should update theme icon across the cycle', () => {
      const icon = document.querySelector('.theme-icon');

      // Initially light (moon icon)
      expect(icon.textContent).toBe('🌙');

      // Toggle to dark (sun icon)
      toggleTheme();
      expect(icon.textContent).toBe('☀️');

      // Toggle to auto (half-moon icon)
      toggleTheme();
      expect(icon.textContent).toBe('🌗');

      // Toggle back to light (moon icon)
      toggleTheme();
      expect(icon.textContent).toBe('🌙');
    });

    it('should not re-render mermaid when content is hidden', () => {
      const contentArea = document.getElementById('content-area');
      contentArea.style.display = 'none';

      const reRenderSpy = jest.fn();
      global.reRenderMermaidDiagrams = reRenderSpy;

      toggleTheme();

      expect(reRenderSpy).not.toHaveBeenCalled();
    });

    it('should trigger mermaid re-render when content is visible', () => {
      const contentArea = document.getElementById('content-area');
      contentArea.style.display = 'flex';

      const reRenderSpy = jest.fn();
      global.reRenderMermaidDiagrams = reRenderSpy;

      toggleTheme();

      expect(reRenderSpy).toHaveBeenCalled();
    });
  });

  describe('updateThemeIcon', () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue('light');
      loadApp(document);
    });

    it('should show moon icon in light theme', () => {
      // currentTheme should be 'light'
      updateThemeIcon();

      const icon = document.querySelector('.theme-icon');
      expect(icon.textContent).toBe('🌙');
    });

    it('should show sun icon in dark theme', () => {
      // Toggle to dark first
      toggleTheme();

      const icon = document.querySelector('.theme-icon');
      expect(icon.textContent).toBe('☀️');
    });
  });

  describe('auto / system theme', () => {
    let changeHandler;

    function mockMatchMedia(prefersDark) {
      changeHandler = null;
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: prefersDark,
        media: query,
        addEventListener: (_evt, cb) => {
          changeHandler = cb;
        },
        removeEventListener: () => {},
        addListener: (cb) => {
          changeHandler = cb;
        },
        removeListener: () => {},
      }));
    }

    afterEach(() => {
      delete window.matchMedia;
    });

    it('resolves an "auto" preference to dark when the OS prefers dark', () => {
      mockMatchMedia(true);
      localStorage.getItem.mockReturnValue('auto');
      loadApp(document);

      expect(state.themePreference).toBe('auto');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('resolves an "auto" preference to light when the OS prefers light', () => {
      mockMatchMedia(false);
      localStorage.getItem.mockReturnValue('auto');
      loadApp(document);

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('defaults to "auto" when no preference is stored', () => {
      mockMatchMedia(true);
      localStorage.getItem.mockReturnValue(null);
      loadApp(document);

      expect(state.themePreference).toBe('auto');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('live-updates when the OS scheme changes while in auto mode', () => {
      mockMatchMedia(false);
      localStorage.getItem.mockReturnValue('auto');
      loadApp(document);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // The OS switches to dark; the registered listener re-resolves.
      window.matchMedia = jest
        .fn()
        .mockReturnValue({ matches: true, addEventListener() {}, addListener() {} });
      expect(typeof changeHandler).toBe('function');
      changeHandler();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('stops following the OS once an explicit preference is chosen', () => {
      mockMatchMedia(false);
      localStorage.getItem.mockReturnValue('auto');
      loadApp(document);

      toggleTheme(); // auto → light
      toggleTheme(); // light → dark
      expect(state.themePreference).toBe('dark');

      // OS flips to dark-preference; because we're no longer in auto, the
      // listener is a no-op and the explicit dark choice stands.
      window.matchMedia = jest
        .fn()
        .mockReturnValue({ matches: true, addEventListener() {}, addListener() {} });
      if (changeHandler) changeHandler();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
