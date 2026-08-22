/**
 * Unit tests for named visual themes (starfield.js).
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Visual themes', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
  });

  afterEach(() => {
    delete window.specdown;
    delete window.iosNative;
    delete window.webkit;
    localStorage.getItem.mockReset();
  });

  it('defaults to Starfield on the web surface and mounts the sky canvas', () => {
    loadApp(document);

    expect(state.visualTheme).toBe('starfield');
    expect(document.documentElement.getAttribute('data-visual-theme')).toBe(
      'starfield'
    );
    expect(document.getElementById('starfield-canvas')).not.toBeNull();
    expect(
      document.getElementById('visual-theme-toggle').getAttribute('aria-label')
    ).toBe('Theme: Starfield');
    expect(
      document.querySelector('#visual-theme-toggle .visual-theme-toggle-label')
        .textContent
    ).toBe('Theme');
    expect(
      document.querySelectorAll('#visual-theme-menu .visual-theme-option')
        .length
    ).toBe(visualThemeCatalog.length);
  });

  it('defaults to Default on desktop so the compact drop card stays', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    loadApp(document);

    expect(state.visualTheme).toBe('default');
    expect(document.documentElement.getAttribute('data-visual-theme')).toBe(
      'default'
    );
    expect(document.getElementById('starfield-canvas')).toBeNull();
    expect(
      document.getElementById('drop-zone').classList.contains('web-showcase')
    ).toBe(false);
  });

  it('defaults to Default on iOS and labels the sheet with the current theme', () => {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadApp(document);

    expect(state.visualTheme).toBe('default');
    expect(document.getElementById('starfield-canvas')).toBeNull();
    expect(document.getElementById('ios-visual-theme-button').textContent).toBe(
      'Theme: Default'
    );
  });

  it('picks Starfield from the header dropdown on desktop', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    loadApp(document);

    document.getElementById('visual-theme-toggle').click();
    const option = document.querySelector(
      '#visual-theme-menu [data-visual-theme="starfield"]'
    );
    option.click();

    expect(state.visualTheme).toBe('starfield');
    expect(document.documentElement.getAttribute('data-visual-theme')).toBe(
      'starfield'
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'visualTheme',
      'starfield'
    );
    expect(document.getElementById('starfield-canvas')).not.toBeNull();
  });

  it('honors a stored Default preference on the web surface', () => {
    localStorage.getItem.mockImplementation((key) =>
      key === 'visualTheme' ? 'default' : null
    );
    loadApp(document);

    expect(state.visualTheme).toBe('default');
    expect(document.getElementById('starfield-canvas')).toBeNull();
  });

  it('migrates the legacy starfield=1 flag', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    localStorage.getItem.mockImplementation((key) =>
      key === 'starfield' ? '1' : null
    );
    loadApp(document);

    expect(state.visualTheme).toBe('starfield');
    expect(document.getElementById('starfield-canvas')).not.toBeNull();
  });

  it('resolves catalog labels and rejects unknown ids', () => {
    expect(visualThemeIsKnown('starfield')).toBe(true);
    expect(visualThemeIsKnown('aurora')).toBe(true);
    expect(visualThemeIsKnown('blueprint')).toBe(true);
    expect(visualThemeIsKnown('not-a-theme')).toBe(false);
    expect(visualThemeLabel('starfield')).toBe('Starfield');
    expect(visualThemeLabel('aurora')).toBe('Aurora');
    expect(visualThemeLabel('blueprint')).toBe('Blueprint');
    expect(visualThemeLabel('not-a-theme')).toBe('Default');
  });

  it('notifies the desktop shell of the theme catalog', () => {
    window.specdown = {
      isDesktop: true,
      requestFileOpen: jest.fn(),
      notifyVisualThemeCatalog: jest.fn(),
      notifyVisualTheme: jest.fn(),
    };
    loadApp(document);

    expect(window.specdown.notifyVisualThemeCatalog).toHaveBeenCalledWith(
      visualThemeCatalog
    );
    expect(window.specdown.notifyVisualTheme).toHaveBeenCalledWith('default');
  });

  it('setVisualTheme applies a named look and ignores unknown ids', () => {
    loadApp(document);
    setVisualTheme('default');
    expect(state.visualTheme).toBe('default');
    setVisualTheme('not-a-theme');
    expect(state.visualTheme).toBe('default');
    setVisualTheme('starfield');
    expect(state.visualTheme).toBe('starfield');
  });

  it('applies Aurora and Blueprint without mounting the starfield canvas', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    loadApp(document);
    setVisualTheme('aurora');
    expect(state.visualTheme).toBe('aurora');
    expect(document.documentElement.getAttribute('data-visual-theme')).toBe(
      'aurora'
    );
    expect(document.getElementById('starfield-canvas')).toBeNull();
    setVisualTheme('blueprint');
    expect(state.visualTheme).toBe('blueprint');
    expect(document.documentElement.getAttribute('data-visual-theme')).toBe(
      'blueprint'
    );
    expect(document.getElementById('starfield-canvas')).toBeNull();
  });

  it('lists Aurora and Blueprint in the header Theme menu', () => {
    loadApp(document);
    const ids = [
      ...document.querySelectorAll('#visual-theme-menu .visual-theme-option'),
    ].map((option) => option.getAttribute('data-visual-theme'));
    expect(ids).toEqual(visualThemeCatalog.map((theme) => theme.id));
    expect(ids).toContain('aurora');
    expect(ids).toContain('blueprint');
  });

  it('cycles every catalog theme from the iOS sheet control', () => {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadApp(document);
    expect(state.visualTheme).toBe('default');
    for (let i = 1; i < visualThemeCatalog.length; i++) {
      cycleVisualTheme();
      expect(state.visualTheme).toBe(visualThemeCatalog[i].id);
    }
    cycleVisualTheme();
    expect(state.visualTheme).toBe('default');
  });
});
