/**
 * Unit tests for the cross-surface starfield toggle (starfield.js).
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Starfield toggle', () => {
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

  it('defaults on for the web surface and mounts the sky canvas', () => {
    loadApp(document);

    expect(state.starfieldEnabled).toBe(true);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('on');
    expect(document.getElementById('starfield-canvas')).not.toBeNull();
    expect(document.getElementById('starfield-cursor-core')).not.toBeNull();
    expect(
      document.getElementById('starfield-toggle').getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('defaults off on desktop so the compact drop card stays', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    loadApp(document);

    expect(state.starfieldEnabled).toBe(false);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('off');
    expect(document.getElementById('starfield-canvas')).toBeNull();
    expect(
      document.getElementById('drop-zone').classList.contains('web-showcase')
    ).toBe(false);
  });

  it('defaults off on iOS and still exposes the action-sheet control', () => {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadApp(document);

    expect(state.starfieldEnabled).toBe(false);
    expect(document.getElementById('starfield-canvas')).toBeNull();
    expect(document.getElementById('ios-starfield-button')).not.toBeNull();
    expect(document.getElementById('ios-starfield-button').textContent).toBe(
      'Turn Starfield On'
    );
  });

  it('toggles on for desktop, persists, and mounts the canvas', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    loadApp(document);

    toggleStarfield();

    expect(state.starfieldEnabled).toBe(true);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('on');
    expect(localStorage.setItem).toHaveBeenCalledWith('starfield', '1');
    expect(document.getElementById('starfield-canvas')).not.toBeNull();
    expect(
      document.getElementById('starfield-toggle').getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('honors a stored off preference on the web surface', () => {
    localStorage.getItem.mockImplementation((key) =>
      key === 'starfield' ? '0' : null
    );
    loadApp(document);

    expect(state.starfieldEnabled).toBe(false);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('off');
    expect(document.getElementById('starfield-canvas')).toBeNull();
  });

  it('honors a stored on preference on desktop', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    localStorage.getItem.mockImplementation((key) =>
      key === 'starfield' ? '1' : null
    );
    loadApp(document);

    expect(state.starfieldEnabled).toBe(true);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('on');
    expect(document.getElementById('starfield-canvas')).not.toBeNull();
  });

  it('setStarfieldEnabled applies an explicit on/off state', () => {
    loadApp(document);
    setStarfieldEnabled(false);
    expect(state.starfieldEnabled).toBe(false);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('off');
    setStarfieldEnabled(true);
    expect(state.starfieldEnabled).toBe(true);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('on');
  });

  it('turns the sky off from the header button on web', () => {
    loadApp(document);
    document.getElementById('starfield-toggle').click();

    expect(state.starfieldEnabled).toBe(false);
    expect(document.documentElement.getAttribute('data-starfield')).toBe('off');
    expect(localStorage.setItem).toHaveBeenCalledWith('starfield', '0');
  });
});
