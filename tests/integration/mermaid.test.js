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
    Panzoom.mockClear();
  });

  describe('configureMermaid', () => {
    it('should configure mermaid with correct theme for light mode', () => {
      localStorage.getItem.mockReturnValue('light');

      configureMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'default'
        })
      );
    });

    it('should configure mermaid with correct theme for dark mode', () => {
      // Reset and configure for dark mode
      document.documentElement.setAttribute('data-theme', 'dark');
      global.currentTheme = 'dark';

      configureMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'dark'
        })
      );
    });

    it('should set security level to strict', () => {
      configureMermaid();

      expect(mermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          securityLevel: 'strict'
        })
      );
    });

    it('should configure font family', () => {
      configureMermaid();

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

    it('should initialize panzoom for each diagram', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;

      await processMermaidDiagrams();

      // Panzoom should be initialized
      expect(Panzoom).toHaveBeenCalled();
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

      const svgElement = markdownContent.querySelector('svg');
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

    it('should create control buttons', () => {
      const svg = '<svg><text>test</text></svg>';
      const diagramId = 'test-diagram-123';

      const container = createDiagramContainer(svg, diagramId);

      const controls = container.querySelector('.diagram-controls');
      expect(controls.querySelector('.zoom-in')).toBeTruthy();
      expect(controls.querySelector('.zoom-out')).toBeTruthy();
      expect(controls.querySelector('.reset')).toBeTruthy();
      expect(controls.querySelector('.fullscreen')).toBeTruthy();
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

      const wrapper = container.querySelector('.diagram-wrapper');
      expect(wrapper.innerHTML).toBe(svg);
    });
  });

  describe('getSvgNaturalDimensions', () => {
    it('should extract dimensions from viewBox attribute', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 1200 800');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 1200, height: 800 });
    });

    it('should handle viewBox with non-zero origin', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '50 100 1200 800');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 1200, height: 800 });
    });

    it('should fall back to width/height attributes when no viewBox', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '600');
      svg.setAttribute('height', '400');

      const dims = getSvgNaturalDimensions(svg);

      expect(dims).toEqual({ width: 600, height: 400 });
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

  describe('panzoom initialization with fit', () => {
    it('should initialize panzoom with wider scale range', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;

      await processMermaidDiagrams();

      expect(Panzoom).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          maxScale: 10,
          minScale: 0.1
        })
      );
    });

    it('should not use contain option for free panning', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;

      await processMermaidDiagrams();

      const panzoomOptions = Panzoom.mock.calls[0][1];
      expect(panzoomOptions.contain).toBeUndefined();
    });

    it('should store homeState in panzoom instance data', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;

      await processMermaidDiagrams();

      // currentPanzoomInstances should have homeState
      expect(currentPanzoomInstances.length).toBeGreaterThan(0);
      expect(currentPanzoomInstances[0].homeState).toBeDefined();
      expect(currentPanzoomInstances[0].homeState).toHaveProperty('scale');
      expect(currentPanzoomInstances[0].homeState).toHaveProperty('x');
      expect(currentPanzoomInstances[0].homeState).toHaveProperty('y');
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

    it('should store homeState on fullscreen overlay', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();

      const diagramId = markdownContent.querySelector('.diagram-container').getAttribute('data-diagram-id');
      openFullscreen(diagramId);

      const overlay = document.getElementById('fullscreen-overlay');
      expect(overlay.homeState).toBeDefined();
      expect(overlay.homeState).toHaveProperty('scale');
      expect(overlay.homeState).toHaveProperty('x');
      expect(overlay.homeState).toHaveProperty('y');
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
      global.currentTheme = 'dark';
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

    it('should cleanup old panzoom instance before re-render', async () => {
      const markdownContent = document.getElementById('markdown-content');
      markdownContent.innerHTML = `
        <pre><code class="language-mermaid">graph TD\nA --> B</code></pre>
      `;
      await processMermaidDiagrams();

      // Get the panzoom instance that was created
      const panzoomCalls = Panzoom.mock.results;
      expect(panzoomCalls.length).toBeGreaterThan(0);
      
      const firstInstance = panzoomCalls[0].value;
      const destroySpy = jest.spyOn(firstInstance, 'destroy');

      await reRenderMermaidDiagrams();

      // Verify that the old panzoom instance was destroyed
      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
