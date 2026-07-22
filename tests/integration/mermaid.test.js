/**
 * Integration tests for mermaid diagram processing
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Mermaid Diagram Processing', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
    mermaid.render.mockClear();
    mermaid.initialize.mockClear();
    Panzoom.mockClear();
  });

  // Mermaid is loaded (and initialized once) on demand via loadMermaid rather
  // than eagerly at startup, so these assert the lazy loader applies the right
  // config the first time it runs.
  describe('loadMermaid', () => {
    it('should configure mermaid with correct theme for light mode', async () => {
      localStorage.getItem.mockReturnValue('light');

      await loadMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'default'
        })
      );
    });

    it('should configure mermaid with correct theme for dark mode', async () => {
      // Reset and configure for dark mode
      document.documentElement.setAttribute('data-theme', 'dark');
      state.currentTheme = 'dark';

      await loadMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'dark'
        })
      );
    });

    it('should set security level to strict', async () => {
      await loadMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          securityLevel: 'strict'
        })
      );
    });

    it('should configure font family', async () => {
      await loadMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          fontFamily: expect.stringContaining('apple-system')
        })
      );
    });
  });

  describe('processMermaidDiagrams', () => {
    it('should return early when no diagrams present', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = '<p>No diagrams here</p>';

      await processMermaidDiagrams();

      expect(mermaid.render).not.toHaveBeenCalled();
    });

    it('should find all mermaid code blocks', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
        <pre><code class="language-mermaid">flowchart LR\nStart --> End</code></pre>
      `;

      await processMermaidDiagrams();

      expect(mermaid.render).toHaveBeenCalledTimes(2);
    });

    it('should render valid mermaid syntax', async () => {
      const markdownContent = document.getElementById('markdown-content');
      const mermaidCode = 'graph TD\nA --> B';
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">${mermaidCode}</code></pre>
      `;

      await processMermaidDiagrams();

      expect(mermaid.render).toHaveBeenCalledWith(
        expect.stringContaining('mermaid-diagram'),
        mermaidCode
      );
    });

    it('should handle invalid mermaid syntax with error display', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">invalid syntax</code></pre>
      `;

      // Mock render to throw error
      mermaid.render.mockRejectedValueOnce(new Error('Mermaid syntax error'));

      await processMermaidDiagrams();

      // Check if error div was added
      const errorDiv = markdownContent.querySelector('.mermaid-error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toContain('Error rendering diagram');
    });

    it('should replace code block with diagram container', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;

      await processMermaidDiagrams();

      // Original pre element should be replaced
      expect(markdownContent.querySelector('pre')).toBeNull();
      // Diagram container should exist
      expect(markdownContent.querySelector('.diagram-container')).toBeTruthy();
    });

    it('should not initialize panzoom for inline diagrams', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;

      await processMermaidDiagrams();

      // Inline diagrams are static; panzoom only exists in fullscreen
      expect(Panzoom).not.toHaveBeenCalled();
    });

    it('should generate unique IDs for each diagram', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
        <pre><code class="language-mermaid">graph TD\nC --> D</code></pre>
      `;

      await processMermaidDiagrams();

      const calls = mermaid.render.mock.calls;
      const id1 = calls[0][0];
      const id2 = calls[1][0];

      expect(id1).not.toBe(id2);
    });

    it('should preserve original code block on render error', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">invalid</code></pre>
      `;

      mermaid.render.mockRejectedValueOnce(new Error('Syntax error'));

      await processMermaidDiagrams();

      // Pre element should still exist
      expect(markdownContent.querySelector('pre')).toBeTruthy();
    });

    it('should store mermaid source on SVG element', async () => {
      const markdownContent = document.getElementById('markdown-content');
      const mermaidCode = 'graph TD\nA --> B';
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">${mermaidCode}</code></pre>
      `;

      await processMermaidDiagrams();

      const svgElement = markdownContent.querySelector('.diagram-wrapper svg');
      expect(svgElement).toBeTruthy();
      expect(svgElement.getAttribute('data-mermaid-source')).toBe(mermaidCode);
    });
  });

  describe('createDiagramContainer', () => {
    it('should create container with diagram-container class', () => {
      const svg = '<svg><text>test</text></svg>';
      const diagramId = 'test-diagram-123';

      const container = createDiagramContainer(svg, diagramId);

      expect(container.className).toBe('diagram-container');
    });

    it('should set data-diagram-id attribute', () => {
      const svg = '<svg><text>test</text></svg>';
      const diagramId = 'test-diagram-123';

      const container = createDiagramContainer(svg, diagramId);

      expect(container.getAttribute('data-diagram-id')).toBe(diagramId);
    });

    it('should create a single expand button instead of a toolbar', () => {
      const svg = '<svg><text>test</text></svg>';
      const diagramId = 'test-diagram-123';

      const container = createDiagramContainer(svg, diagramId);

      const expandBtn = container.querySelector('.diagram-expand');
      expect(expandBtn).toBeTruthy();
      expect(expandBtn.getAttribute('aria-label')).toContain('Expand diagram');
      // The old inline control cluster must be gone
      expect(container.querySelector('.diagram-controls')).toBeNull();
      expect(container.querySelector('.zoom-in')).toBeNull();
      expect(container.querySelector('.zoom-range')).toBeNull();
    });

    it('should create wrapper with correct ID', () => {
      const svg = '<svg><text>test</text></svg>';
      const diagramId = 'test-diagram-123';

      const container = createDiagramContainer(svg, diagramId);

      const wrapper = container.querySelector('.diagram-wrapper');
      expect(wrapper.id).toBe(`wrapper-${diagramId}`);
    });

    it('should inject SVG into wrapper', () => {
      const svg = '<svg><text>test diagram</text></svg>';
      const diagramId = 'test-diagram-123';

      const container = createDiagramContainer(svg, diagramId);

      const svgEl = container.querySelector('.diagram-wrapper svg');
      expect(svgEl).toBeTruthy();
      expect(svgEl.textContent).toBe('test diagram');
    });

    it('should give the SVG an intrinsic pixel size from its viewBox', () => {
      // Mermaid emits width/height of "100%" and an inline max-width style;
      // static inline layout replaces those with the natural pixel size and
      // lets the stylesheet cap oversized diagrams.
      const svg =
        '<svg viewBox="0 0 800 600" width="100%" height="100%" style="max-width: 800px;"><text>big</text></svg>';

      const container = createDiagramContainer(svg, 'test-diagram-123');

      const svgEl = container.querySelector('.diagram-wrapper svg');
      expect(svgEl.getAttribute('width')).toBe('800');
      expect(svgEl.getAttribute('height')).toBe('600');
      expect(svgEl.style.maxWidth).toBe('');
      expect(svgEl.getAttribute('viewBox')).toBe('0 0 800 600');
    });
  });

  describe('getSvgNaturalDimensions', () => {
    it('should extract dimensions from viewBox attribute', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 1200 800');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 1200, height: 800 });
    });

    it('should handle viewBox with non-zero origin (3rd/4th values are width/height)', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '50 100 1200 800');

      const dims = getSvgNaturalDimensions(svg);

      // viewBox format is "min-x min-y width height" - 3rd and 4th ARE the dimensions
      expect(dims).toEqual({ width: 1200, height: 800 });
    });

    it('should handle viewBox with negative origin', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '-50 -10 913 642');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 913, height: 642 });
    });

    it('should fall back to width/height attributes when no viewBox', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '600');
      svg.setAttribute('height', '400');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 600, height: 400 });
    });

    it('should skip percentage width/height attributes', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toBeNull();
    });

    it('should return null when no dimensions available', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toBeNull();
    });

    it('should prefer viewBox over width/height', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 1200 800');
      svg.setAttribute('width', '600');
      svg.setAttribute('height', '400');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 1200, height: 800 });
    });
  });

  describe('fitDiagramToContainer', () => {
    it('should return default state when SVG has no dimensions', () => {
      const wrapper = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      wrapper.appendChild(svg);

      const panzoom = Panzoom(svg, {});

      const result = fitDiagramToContainer(wrapper, svg, panzoom);

      expect(result).toEqual({ scale: 1, x: 0, y: 0 });
    });

    it('should return default state when container has no dimensions', () => {
      // jsdom reports 0 for clientWidth/clientHeight
      const wrapper = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 800 600');
      wrapper.appendChild(svg);

      const panzoom = Panzoom(svg, {});

      const result = fitDiagramToContainer(wrapper, svg, panzoom);

      // clientWidth/Height are 0 in jsdom, so default is returned
      expect(result).toEqual({ scale: 1, x: 0, y: 0 });
    });

    it('should set SVG dimensions from natural size', () => {
      const wrapper = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 800 600');
      wrapper.appendChild(svg);

      // Mock container dimensions
      Object.defineProperty(wrapper, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(wrapper, 'clientHeight', { value: 500, configurable: true });

      const panzoom = Panzoom(svg, {});
      fitDiagramToContainer(wrapper, svg, panzoom);

      expect(svg.style.width).toBe('800px');
      expect(svg.style.height).toBe('600px');
    });

    it('should clear mermaid inline styles and set position absolute', () => {
      const wrapper = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 800 600');
      // Simulate mermaid-set inline styles
      svg.style.cssText = 'max-width: 800px;';
      svg.setAttribute('width', '100%');
      wrapper.appendChild(svg);

      Object.defineProperty(wrapper, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(wrapper, 'clientHeight', { value: 500, configurable: true });

      const panzoom = Panzoom(svg, {});
      fitDiagramToContainer(wrapper, svg, panzoom);

      // Mermaid max-width should be cleared
      expect(svg.style.maxWidth).toBe('');
      // width attribute should be removed
      expect(svg.getAttribute('width')).toBeNull();
      // Position should be absolute for layout isolation
      expect(svg.style.position).toBe('absolute');
    });

    it('should calculate fit scale based on container and SVG dimensions', () => {
      const wrapper = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 1000 500');
      wrapper.appendChild(svg);

      Object.defineProperty(wrapper, 'clientWidth', { value: 800, configurable: true });
      Object.defineProperty(wrapper, 'clientHeight', { value: 600, configurable: true });

      const panzoom = Panzoom(svg, {});
      const result = fitDiagramToContainer(wrapper, svg, panzoom);

      // scaleX = 800/1000 = 0.8, scaleY = 600/500 = 1.2
      // fitScale = min(0.8, 1.2) * 0.9 = 0.72
      expect(result.scale).toBeCloseTo(0.72, 2);
    });

    it('should center the diagram in the container', () => {
      const wrapper = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 1000 500');
      wrapper.appendChild(svg);

      Object.defineProperty(wrapper, 'clientWidth', { value: 800, configurable: true });
      Object.defineProperty(wrapper, 'clientHeight', { value: 600, configurable: true });

      const panzoom = Panzoom(svg, {});
      const result = fitDiagramToContainer(wrapper, svg, panzoom);

      // fitScale = 0.72, scaledWidth = 720, scaledHeight = 360
      // x = (800 - 720) / 2 = 40
      // y = (600 - 360) / 2 = 120
      expect(result.x).toBeCloseTo(40, 0);
      expect(result.y).toBeCloseTo(120, 0);
    });

    it('should call panzoom zoom and pan with correct values', () => {
      const wrapper = document.createElement('div');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 1000 500');
      wrapper.appendChild(svg);

      Object.defineProperty(wrapper, 'clientWidth', { value: 800, configurable: true });
      Object.defineProperty(wrapper, 'clientHeight', { value: 600, configurable: true });

      const panzoom = Panzoom(svg, {});
      const zoomSpy = jest.spyOn(panzoom, 'zoom');
      const panSpy = jest.spyOn(panzoom, 'pan');

      fitDiagramToContainer(wrapper, svg, panzoom);

      expect(zoomSpy).toHaveBeenCalledWith(expect.closeTo(0.72, 1), { animate: false });
      expect(panSpy).toHaveBeenCalledWith(expect.closeTo(40, 0), expect.closeTo(120, 0), { animate: false });
    });
  });

  describe('resetToFit', () => {
    it('should restore panzoom to home state with animation', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const panzoom = Panzoom(svg, {});

      const homeState = { scale: 0.5, x: 100, y: 50 };

      // Simulate user zoomed in
      panzoom.zoom(2);
      panzoom.pan(300, 400);

      resetToFit(panzoom, homeState);

      expect(panzoom.getScale()).toBe(0.5);
      expect(panzoom.getPan()).toEqual({ x: 100, y: 50 });
    });

    it('should pass animate: true for smooth transition', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const panzoom = Panzoom(svg, {});
      const zoomSpy = jest.spyOn(panzoom, 'zoom');
      const panSpy = jest.spyOn(panzoom, 'pan');

      const homeState = { scale: 0.8, x: 20, y: 30 };
      resetToFit(panzoom, homeState);

      expect(zoomSpy).toHaveBeenCalledWith(0.8, { animate: true });
      expect(panSpy).toHaveBeenCalledWith(20, 30, { animate: true });
    });
  });

  describe('inline diagram affordance', () => {
    async function renderOneDiagram() {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();
      return markdownContent.querySelector('.diagram-container');
    }

    it('expand button opens the fullscreen overlay', async () => {
      const container = await renderOneDiagram();

      container.querySelector('.diagram-expand').click();

      const overlay = document.getElementById('fullscreen-overlay');
      expect(overlay.style.display).toBe('flex');
      expect(overlay.panzoomInstance).toBeTruthy();
    });

    it('clicking a scaled-down diagram opens fullscreen', async () => {
      const container = await renderOneDiagram();
      container.classList.add('diagram-scaled');

      container.querySelector('.diagram-wrapper').click();

      const overlay = document.getElementById('fullscreen-overlay');
      expect(overlay.style.display).toBe('flex');
    });

    it('clicking a diagram that fits inline does not open fullscreen', async () => {
      const container = await renderOneDiagram();

      container.querySelector('.diagram-wrapper').click();

      const overlay = document.getElementById('fullscreen-overlay');
      expect(overlay.style.display).toBe('none');
    });

    it('tap-anywhere opens fullscreen on coarse-pointer (touch) devices', async () => {
      const container = await renderOneDiagram();
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = jest.fn(() => ({ matches: true }));

      try {
        container.querySelector('.diagram-wrapper').click();

        const overlay = document.getElementById('fullscreen-overlay');
        expect(overlay.style.display).toBe('flex');
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });

    it('fullscreen share button copies a diagram deep link', async () => {
      const container = await renderOneDiagram();
      const writeSpy = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeSpy },
        configurable: true,
      });

      const diagramId = container.getAttribute('data-diagram-id');
      openFullscreen(diagramId);
      document.querySelector('#fullscreen-overlay .share-diagram').click();

      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('?diagram='));
    });
  });

  describe('markDiagramScaledState', () => {
    async function renderOneDiagram() {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();
      return markdownContent.querySelector('.diagram-container');
    }

    /** Natural size from the mock SVG's viewBox is 800x600. */
    function setRenderedSize(container, width, height) {
      const svg = container.querySelector('.diagram-wrapper svg');
      Object.defineProperty(svg, 'clientWidth', { value: width, configurable: true });
      Object.defineProperty(svg, 'clientHeight', { value: height, configurable: true });
    }

    it('flags containers whose SVG was scaled down by the CSS caps', async () => {
      const container = await renderOneDiagram();
      setRenderedSize(container, 400, 300);

      markDiagramScaledState(container);

      expect(container.classList.contains('diagram-scaled')).toBe(true);
    });

    it('clears the flag when the SVG renders at natural size', async () => {
      const container = await renderOneDiagram();
      container.classList.add('diagram-scaled');
      setRenderedSize(container, 800, 600);

      markDiagramScaledState(container);

      expect(container.classList.contains('diagram-scaled')).toBe(false);
    });

    it('leaves the state alone before layout (clientWidth 0)', async () => {
      const container = await renderOneDiagram();
      container.classList.add('diagram-scaled');
      // jsdom default clientWidth/clientHeight is 0 — no layout information

      markDiagramScaledState(container);

      expect(container.classList.contains('diagram-scaled')).toBe(true);
    });
  });

  describe('fullscreen diagram fit', () => {
    it('should show overlay before initializing panzoom for dimension calculation', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();

      const diagramId = markdownContent.querySelector('.diagram-container').getAttribute('data-diagram-id');
      openFullscreen(diagramId);

      const overlay = document.getElementById('fullscreen-overlay');
      expect(overlay.style.display).toBe('flex');
      expect(overlay.panzoomInstance).toBeTruthy();
    });

    it('should store mutable fullscreenState on fullscreen overlay', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();

      const diagramId = markdownContent.querySelector('.diagram-container').getAttribute('data-diagram-id');
      openFullscreen(diagramId);

      const overlay = document.getElementById('fullscreen-overlay');
      expect(overlay.fullscreenState).toBeDefined();
      expect(overlay.fullscreenState.homeState).toBeDefined();
      expect(overlay.fullscreenState.homeState).toHaveProperty('scale');
      expect(overlay.fullscreenState.homeState).toHaveProperty('x');
      expect(overlay.fullscreenState.homeState).toHaveProperty('y');
    });

    it('should initialize fullscreen panzoom with extended scale range', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();

      Panzoom.mockClear();

      const diagramId = markdownContent.querySelector('.diagram-container').getAttribute('data-diagram-id');
      openFullscreen(diagramId);

      expect(Panzoom).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          maxScale: 20,
          minScale: 0.05
        })
      );
    });
  });

  describe('reRenderMermaidDiagrams', () => {
    it('should update mermaid config with new theme', async () => {
      // Set up a diagram
      const markdownContent = document.getElementById('markdown-content');
      const mermaidCode = 'graph TD\nA --> B';
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">${mermaidCode}</code></pre>
      `;
      await processMermaidDiagrams();

      // Clear previous calls
      mermaid.initialize.mockClear();

      // Change theme and re-render
      state.currentTheme = 'dark';
      await reRenderMermaidDiagrams();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'dark'
        })
      );
    });

    it('should re-render all diagrams', async () => {
      // Set up diagrams
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
        <pre><code class="language-mermaid">graph TD\nC --> D</code></pre>
      `;
      await processMermaidDiagrams();

      // Clear previous render calls
      mermaid.render.mockClear();

      // Re-render
      await reRenderMermaidDiagrams();

      expect(mermaid.render).toHaveBeenCalledTimes(2);
    });

    it('should skip diagrams without mermaid source', async () => {
      const markdownContent = document.getElementById('markdown-content');

      // Manually create a diagram container without source
      const container = document.createElement('div');
      container.className = 'diagram-container';
      container.setAttribute('data-diagram-id', 'test-123');

      const wrapper = document.createElement('div');
      wrapper.className = 'diagram-wrapper';
      wrapper.innerHTML = '<svg></svg>';

      container.appendChild(wrapper);
      markdownContent.appendChild(container);

      mermaid.render.mockClear();

      await reRenderMermaidDiagrams();

      // Should not try to render diagram without source
      expect(mermaid.render).not.toHaveBeenCalled();
    });

    it('should handle re-render errors gracefully', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();

      // Mock render to fail on re-render
      mermaid.render.mockRejectedValueOnce(new Error('Re-render error'));

      // Should not throw
      await expect(reRenderMermaidDiagrams()).resolves.not.toThrow();
    });

    it('should keep the static inline sizing on the re-rendered SVG', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();

      await reRenderMermaidDiagrams();

      const svgEl = markdownContent.querySelector('.diagram-wrapper svg');
      expect(svgEl.getAttribute('width')).toBe('800');
      expect(svgEl.getAttribute('height')).toBe('600');
      expect(svgEl.getAttribute('data-mermaid-source')).toBeTruthy();
    });
  });

  describe('render-generation guard (tab-switch race)', () => {
    beforeEach(() => {
      // Yielding to timers runs jsdom's rAF queue, which reaches the minimap's
      // canvas/blob code — stub the URL APIs jsdom doesn't implement.
      URL.createObjectURL = jest.fn(() => 'blob:mock');
      URL.revokeObjectURL = jest.fn();
    });

    it('a superseded diagram pass stops mutating the DOM', async () => {
      const markdownContent = document.getElementById('markdown-content');

      // Doc A: its mermaid.render is deferred so the pass stalls mid-render.
      markdownContent.innerHTML =
        '<pre><code class="language-mermaid">graph A</code></pre>';
      let resolveStale;
      mermaid.render.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve;
        })
      );
      const stalePass = processMermaidDiagrams();
      // Let the stale pass advance past loadMermaid() and into mermaid.render.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mermaid.render).toHaveBeenCalledTimes(1);

      // Doc B replaces the content (tab switch) and renders to completion.
      markdownContent.innerHTML =
        '<pre><code class="language-mermaid">graph B</code></pre>';
      await processMermaidDiagrams();
      const domAfterCurrent = markdownContent.innerHTML;

      // The stale pass now finishes its render — and must change nothing.
      resolveStale({
        svg: '<svg viewBox="0 0 800 600" width="800" height="600"><text>graph A</text></svg>',
        bindFunctions: jest.fn(),
      });
      await stalePass;

      expect(markdownContent.innerHTML).toBe(domAfterCurrent);
    });

    it('a new document render invalidates an in-flight theme re-render', async () => {
      const markdownContent = document.getElementById('markdown-content');

      // Render a document with a diagram normally.
      markdownContent.innerHTML =
        '<pre><code class="language-mermaid">graph A</code></pre>';
      await processMermaidDiagrams();

      // Start a theme re-render whose mermaid.render is deferred.
      let resolveStale;
      mermaid.render.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve;
        })
      );
      const staleRerender = reRenderMermaidDiagrams();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // A fresh document render supersedes it.
      markdownContent.innerHTML =
        '<pre><code class="language-mermaid">graph B</code></pre>';
      await processMermaidDiagrams();
      const domAfterCurrent = markdownContent.innerHTML;

      resolveStale({
        svg: '<svg viewBox="0 0 800 600" width="800" height="600"><text>stale</text></svg>',
        bindFunctions: jest.fn(),
      });
      await staleRerender;

      // The stale re-render must not have replaced doc B's diagram markup
      // after it was superseded.
      expect(markdownContent.innerHTML).toBe(domAfterCurrent);
    });
  });
});
