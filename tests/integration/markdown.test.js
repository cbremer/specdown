/**
 * Integration tests for markdown rendering
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Markdown Rendering', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  describe('configureMarked', () => {
    it('should configure marked with GFM enabled', () => {
      configureMarked();

      expect(marked.use).toHaveBeenCalled();
      const config = marked.use.mock.calls[0][0];
      expect(config.gfm).toBe(true);
    });

    it('should enable line breaks', () => {
      configureMarked();

      const config = marked.use.mock.calls[0][0];
      expect(config.breaks).toBe(true);
    });

    it('should configure a custom renderer for syntax highlighting', () => {
      configureMarked();

      const config = marked.use.mock.calls[0][0];
      expect(config.renderer).toBeDefined();
      expect(typeof config.renderer.code).toBe('function');
    });
  });

  describe('renderMarkdown', () => {
    beforeEach(() => {
      // Clear any previous mock calls
      marked.parse.mockClear();
    });

    it('should parse markdown to HTML', async () => {
      const content = '# Test Heading\n\nParagraph text';
      const filename = 'test.md';

      await renderMarkdown(content, filename);

      expect(marked.parse).toHaveBeenCalledWith(content);
    });

    it('should update filename display', async () => {
      const content = '# Test';
      const filename = 'my-document.md';

      await renderMarkdown(content, filename);

      const fileNameElement = document.getElementById('file-name');
      expect(fileNameElement.textContent).toBe(filename);
    });

    it('should show content area and hide drop zone', async () => {
      const content = '# Test';
      const filename = 'test.md';

      await renderMarkdown(content, filename);

      const contentArea = document.getElementById('content-area');
      const dropZone = document.getElementById('drop-zone');

      expect(contentArea.style.display).toBe('flex');
      expect(dropZone.style.display).toBe('none');
    });

    it('should inject HTML into markdown content element', async () => {
      const content = '# Test Heading';
      const filename = 'test.md';

      // Mock will convert to <h1>Test Heading</h1>
      await renderMarkdown(content, filename);

      const markdownContent = document.getElementById('markdown-content');
      expect(markdownContent.innerHTML).toContain('Test Heading');
    });

    it('should cleanup existing panzoom instances', async () => {
      const cleanupSpy = jest.fn();
      global.cleanupPanzoomInstances = cleanupSpy;

      await renderMarkdown('# Test', 'test.md');

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should call processMermaidDiagrams', async () => {
      const processSpy = jest.fn().mockResolvedValue(undefined);
      global.processMermaidDiagrams = processSpy;

      await renderMarkdown('# Test', 'test.md');

      expect(processSpy).toHaveBeenCalled();
    });

    it('should handle parsing errors with alert', async () => {
      marked.parse.mockImplementation(() => {
        throw new Error('Parse error');
      });

      await renderMarkdown('# Test', 'test.md');

      expect(global.alert).toHaveBeenCalledWith(
        'Error rendering markdown content. Please check the file format.'
      );
    });

    it('should reset scroll position', async () => {
      const content = '# Test';
      const filename = 'test.md';

      await renderMarkdown(content, filename);

      const markdownContent = document.getElementById('markdown-content');
      expect(markdownContent.scrollTop).toBe(0);
    });
  });

  describe('Syntax Highlighting Integration', () => {
    it('should highlight code blocks via renderer.code', () => {
      configureMarked();

      const config = marked.use.mock.calls[0][0];
      const codeRenderer = config.renderer.code;

      codeRenderer('console.log("test")', 'javascript');

      expect(hljs.highlight).toHaveBeenCalledWith('console.log("test")', {
        language: 'javascript'
      });
    });

    it('should handle highlight errors gracefully', () => {
      configureMarked();

      const config = marked.use.mock.calls[0][0];
      const codeRenderer = config.renderer.code;

      hljs.highlight.mockImplementation(() => {
        throw new Error('Highlight error');
      });

      const result = codeRenderer('code', 'invalidlang');

      // Should return escaped code in pre/code tags
      expect(result).toContain('<pre><code');
      expect(result).toContain('code');
    });

    it('should return escaped code for unknown languages', () => {
      configureMarked();

      const config = marked.use.mock.calls[0][0];
      const codeRenderer = config.renderer.code;

      // Mock getLanguage to return undefined for unknown language
      hljs.getLanguage = jest.fn(() => undefined);

      const result = codeRenderer('code', 'unknown');

      // Should return escaped code wrapped in pre/code tags
      expect(result).toContain('<pre><code');
      expect(result).toContain('code');
    });
  });
});
