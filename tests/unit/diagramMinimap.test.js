/**
 * Unit tests for the fullscreen diagram minimap.
 *
 * Regression guard: the minimap rasterizes the diagram SVG through an Image.
 * By the time it runs, panzoom has stamped an inline `transform` on the live
 * SVG. If that transform is serialized into the rasterized string, the
 * outermost <svg>'s CSS transform shoves the content outside the viewBox and
 * the minimap canvas renders empty (the "missing content" bug). updateMinimap
 * must serialize a clean clone with the transform stripped and explicit
 * natural dimensions set.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Diagram Minimap', () => {
  let serializeSpy;
  let capturedNodes;

  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);

    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    // Capture whatever gets handed to the serializer so we can inspect the
    // exact node the minimap rasterizes.
    capturedNodes = [];
    serializeSpy = jest
      .spyOn(XMLSerializer.prototype, 'serializeToString')
      .mockImplementation(function (node) {
        capturedNodes.push(node);
        return '<svg></svg>';
      });
  });

  afterEach(() => {
    serializeSpy.mockRestore();
    delete global.URL.createObjectURL;
    delete global.URL.revokeObjectURL;
  });

  /** Build an SVG carrying a panzoom-style inline transform. */
  function makeTransformedSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 731 80');
    svg.setAttribute('width', '100%');
    svg.style.maxWidth = '731px';
    svg.style.transform = 'scale(0.35) translate(120px, 80px)';
    svg.style.transformOrigin = '0px 0px';
    return svg;
  }

  it('strips the panzoom transform before serializing for the canvas', () => {
    updateMinimap(makeTransformedSvg());

    expect(capturedNodes.length).toBe(1);
    const serialized = capturedNodes[0];
    expect(serialized.style.transform).toBe('');
    expect(serialized.style.transformOrigin).toBe('');
  });

  it('pins explicit natural width/height from the viewBox', () => {
    updateMinimap(makeTransformedSvg());

    const serialized = capturedNodes[0];
    expect(serialized.getAttribute('width')).toBe('731');
    expect(serialized.getAttribute('height')).toBe('80');
    // The percentage width + max-width (which give an Image a 300px default
    // intrinsic size) must be gone.
    expect(serialized.style.maxWidth).toBe('');
  });

  it('does not mutate the live SVG element passed in', () => {
    const svg = makeTransformedSvg();
    updateMinimap(svg);

    // The original keeps its transform — only the clone is cleaned.
    expect(svg.style.transform).toBe('scale(0.35) translate(120px, 80px)');
    expect(capturedNodes[0]).not.toBe(svg);
  });

  it('hides the minimap when the SVG has no usable dimensions', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    updateMinimap(svg);

    expect(document.getElementById('fullscreen-minimap').style.display).toBe('none');
    expect(capturedNodes.length).toBe(0);
  });
});
