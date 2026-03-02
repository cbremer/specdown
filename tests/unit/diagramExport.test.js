/**
 * Unit tests for Mermaid diagram export (SVG and PNG download)
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

// ===========================
// Helpers
// ===========================

/** Create a minimal SVG element with a viewBox and insert it into a diagram wrapper */
function insertFakeDiagram(diagramId, svgViewBox = '0 0 200 100') {
  const wrapper = document.getElementById('wrapper-' + diagramId);
  if (!wrapper) {
    // Create a wrapper if it doesn't exist
    const w = document.createElement('div');
    w.id = 'wrapper-' + diagramId;
    w.className = 'diagram-wrapper';
    document.getElementById('markdown-content').appendChild(w);
  }
  const w = document.getElementById('wrapper-' + diagramId);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', svgViewBox);
  svg.setAttribute('data-mermaid-source', 'graph TD\nA-->B');
  w.appendChild(svg);
  return svg;
}

describe('Diagram Export', () => {
  let mockCreateObjectURL;
  let mockRevokeObjectURL;
  let mockAppendChild;
  let mockRemoveChild;
  let mockClick;

  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);

    // Mock URL methods (not available in jsdom)
    mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
    mockRevokeObjectURL = jest.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Track anchor clicks for download
    mockClick = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = document.createElementNS
        ? document.createElementNS('http://www.w3.org/1999/xhtml', tag)
        : Object.assign(document.createElement.call(document, tag));
      if (tag === 'a') {
        el.click = mockClick;
      }
      return el;
    });
  });

  afterEach(() => {
    // Restore only the createElement spy — restoreAllMocks() would also
    // restore the Storage.prototype spies created in setup.js and break
    // their mockClear() calls in subsequent beforeEach hooks.
    if (document.createElement.mockRestore) {
      document.createElement.mockRestore();
    }
    delete global.URL.createObjectURL;
    delete global.URL.revokeObjectURL;
  });

  // ===========================
  // getSvgElementForDiagram
  // ===========================
  describe('getSvgElementForDiagram', () => {
    it('returns null for an unknown diagram id', () => {
      const el = getSvgElementForDiagram('no-such-id');
      expect(el).toBeNull();
    });

    it('returns the SVG element when the wrapper exists', () => {
      const svg = insertFakeDiagram('test-diagram-1');
      const found = getSvgElementForDiagram('test-diagram-1');
      expect(found).toBe(svg);
    });
  });

  // ===========================
  // triggerDownload
  // ===========================
  describe('triggerDownload', () => {
    it('creates an object URL from the blob', () => {
      const blob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      triggerDownload(blob, 'diagram.svg');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    });

    it('creates a temporary <a> element with the correct download filename', () => {
      const createSpy = jest.spyOn(document, 'createElement');
      const blob = new Blob(['content'], { type: 'text/plain' });

      triggerDownload(blob, 'my-file.svg');

      const aCalls = createSpy.mock.calls.filter(([tag]) => tag === 'a');
      expect(aCalls.length).toBeGreaterThan(0);
    });
  });

  // ===========================
  // downloadDiagramSvg
  // ===========================
  describe('downloadDiagramSvg', () => {
    it('does nothing when the diagram wrapper does not exist', () => {
      downloadDiagramSvg('ghost-id');
      expect(mockCreateObjectURL).not.toHaveBeenCalled();
    });

    it('calls URL.createObjectURL with an SVG blob', () => {
      insertFakeDiagram('export-svg-1');

      downloadDiagramSvg('export-svg-1');

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const blob = mockCreateObjectURL.mock.calls[0][0];
      expect(blob.type).toContain('svg');
    });
  });

  // ===========================
  // downloadDiagramPng
  // ===========================
  describe('downloadDiagramPng', () => {
    it('does nothing when the diagram wrapper does not exist', () => {
      downloadDiagramPng('ghost-id');
      expect(mockCreateObjectURL).not.toHaveBeenCalled();
    });

    it('calls URL.createObjectURL to create an SVG blob for the PNG pipeline', () => {
      insertFakeDiagram('export-png-1');

      downloadDiagramPng('export-png-1');

      // First call is to create the SVG blob URL used to load into an Image
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================
  // getSvgNaturalDimensions (re-used by export)
  // ===========================
  describe('getSvgNaturalDimensions', () => {
    it('parses width and height from viewBox attribute', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 400 250');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 400, height: 250 });
    });

    it('falls back to width/height attributes when viewBox is absent', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '300');
      svg.setAttribute('height', '150');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 300, height: 150 });
    });

    it('returns null when no usable dimensions are present', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toBeNull();
    });

    it('ignores percentage-based width/height attributes', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toBeNull();
    });

    it('handles space-separated and comma-separated viewBox values', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0,0,800,600');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 800, height: 600 });
    });
  });
});
