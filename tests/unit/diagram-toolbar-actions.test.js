const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

function toolbarDiagramFixture() {
  const container = createDiagramContainer(
    '<svg viewBox="0 0 200 100"><text>A to B</text></svg>',
    'toolbar-fixture',
    'graph LR\nA-->B'
  );
  document.getElementById('markdown-content').append(container);
  initializeInlineDiagram('toolbar-fixture');
  return container;
}

describe('supported diagram toolbar actions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.setItem('visualTheme', 'default');
    loadHTML(document);
  });
  afterEach(() => {
    closeFullscreen({ restoreFocus: false });
    exitPresentation({ restoreFocus: false });
    delete window.specdown;
    delete window.iosNative;
    delete window.webkit;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test.each(['web', 'desktop', 'ios'])(
    '%s has no diagram-link action inline, fullscreen or after reopening',
    (surface) => {
      if (surface === 'desktop') {
        window.specdown = { isDesktop: true, platform: 'darwin' };
      } else if (surface === 'ios') {
        window.iosNative = true;
        window.webkit = {
          messageHandlers: { specdown: { postMessage: jest.fn() } },
        };
      }
      loadApp(document);
      const container = toolbarDiagramFixture();
      expect(container.querySelectorAll('button')).toHaveLength(1);
      expect(container.querySelector('.diagram-expand')).not.toBeNull();

      for (let pass = 0; pass < 2; pass += 1) {
        container.querySelector('.diagram-expand').click();
        const overlay = document.getElementById('fullscreen-overlay');
        expect(overlay.style.display).toBe('flex');
        expect(
          document.querySelector(
            '.share-diagram, [title="Copy shareable link"], [aria-label="Copy shareable link"], #share-toast'
          )
        ).toBeNull();
        expect(overlay.querySelector('.export-svg').textContent).toBe('SVG');
        expect(overlay.querySelector('.export-png').textContent).toBe('PNG');
        overlay.querySelector('.close-fullscreen').click();
        expect(overlay.style.display).toBe('none');
      }
    }
  );

  test.each([
    ['SVG', '.export-svg', 'downloadDiagramSvg'],
    ['PNG', '.export-png', 'downloadDiagramPng'],
  ])(
    '%s control still dispatches the existing export',
    (_name, selector, fn) => {
      loadApp(document);
      toolbarDiagramFixture();
      const exporter = jest.spyOn(global, fn).mockImplementation(() => {});
      try {
        openFullscreen('toolbar-fixture');
        document.querySelector('#fullscreen-overlay ' + selector).click();
        expect(exporter).toHaveBeenCalledTimes(1);
        expect(exporter).toHaveBeenCalledWith('toolbar-fixture');
      } finally {
        exporter.mockRestore();
      }
    }
  );

  test('presentation keeps navigation and zoom without a link action', () => {
    loadApp(document);
    toolbarDiagramFixture();
    startPresentation();
    const overlay = document.querySelector('.presentation-overlay');
    expect(overlay.querySelectorAll('button')).toHaveLength(6);
    expect(
      overlay.querySelector(
        '.share-diagram, [aria-label="Copy shareable link"]'
      )
    ).toBeNull();
    expect(overlay.querySelector('.presentation-zoom-in')).not.toBeNull();
    expect(overlay.querySelector('.presentation-zoom-out')).not.toBeNull();
    expect(overlay.querySelector('.presentation-zoom-fit')).not.toBeNull();
    overlay.querySelector('.presentation-close').click();
    expect(isPresentationOpen()).toBe(false);
  });
});
