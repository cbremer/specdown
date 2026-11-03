const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('native diagram exports', () => {
  beforeEach(() => {
    localStorage.clear();
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadHTML(document);
    loadApp(document);
    window.loadFileContent('<p>Synthetic</p>', 'a.md', { id: 'doc-a' });
    const wrapper = document.createElement('div');
    wrapper.id = 'wrapper-test-export';
    wrapper.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><text>synthetic</text></svg>';
    document.getElementById('markdown-content').appendChild(wrapper);
    global.URL.createObjectURL = jest.fn(() => 'blob:synthetic');
    global.URL.revokeObjectURL = jest.fn();
  });
  afterEach(() => {
    delete window.iosNative;
    delete window.webkit;
    delete global.URL.createObjectURL;
    delete global.URL.revokeObjectURL;
  });
  it('sends an actual SVG file to the native lifecycle with current view authority', () => {
    downloadDiagramSvg('test-export');
    expect(
      window.webkit.messageHandlers.specdown.postMessage
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'exportDiagram',
        data: expect.objectContaining({
          format: 'svg',
          payload: expect.stringContaining('<svg'),
          token: getIOSDocumentView().token,
        }),
      })
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('drops a delayed raster load after document navigation', () => {
    const NativeImage = global.Image;
    let pending;
    global.Image = class {
      constructor() {
        pending = this;
      }
    };
    try {
      downloadDiagramPng('test-export');
      const delayed = pending.onload;
      window.loadFileContent('<p>B</p>', 'b.md', { id: 'doc-b' });
      delayed();
      expect(
        window.webkit.messageHandlers.specdown.postMessage
      ).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'exportDiagram' })
      );
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
    } finally {
      global.Image = NativeImage;
    }
  });
  it('rejects huge raster dimensions before allocating a canvas or image', () => {
    document
      .querySelector('#wrapper-test-export svg')
      .setAttribute('viewBox', '0 0 999999 999999');
    downloadDiagramPng('test-export');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('never exports a different diagram from a fullscreen fallback', () => {
    const overlay = document.createElement('div');
    overlay.id = 'fullscreen-overlay';
    overlay.innerHTML = '<div class="fullscreen-diagram-wrapper"><svg/></div>';
    document.body.appendChild(overlay);
    expect(getSvgElementForDiagram('missing-diagram')).toBeNull();
    downloadDiagramSvg('missing-diagram');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(
      window.webkit.messageHandlers.specdown.postMessage
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'exportDiagram' })
    );
  });
});
