/**
 * Unit tests for view toggle (preview/raw markdown) functionality
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('View Toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  describe('initial state', () => {
    it('should default to preview mode', () => {
      expect(currentViewMode).toBe('preview');
    });

    it('should have empty raw markdown initially', () => {
      expect(currentRawMarkdown).toBe('');
    });

    it('should render toggle button with Raw label', () => {
      const label = document.querySelector('.view-toggle-label');
      expect(label.textContent).toBe('Raw');
    });

    it('should not have active class on toggle button initially', () => {
      const btn = document.getElementById('view-toggle');
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  describe('toggleViewMode', () => {
    it('should do nothing when no markdown is loaded', () => {
      currentRawMarkdown = '';
      toggleViewMode();
      expect(currentViewMode).toBe('preview');
    });

    it('should switch to raw mode and display escaped markdown', async () => {
      const mdContent = '# Hello\n\nSome **bold** text with <html> tags';
      await renderMarkdown(mdContent, 'test.md');

      toggleViewMode();

      expect(currentViewMode).toBe('raw');
      const pre = document.querySelector('.raw-markdown');
      expect(pre).not.toBeNull();
      // HTML should be escaped
      expect(pre.innerHTML).toContain('&lt;html&gt;');
      expect(pre.innerHTML).toContain('# Hello');
    });

    it('should add active class to button in raw mode', async () => {
      await renderMarkdown('# Test', 'test.md');
      toggleViewMode();

      const btn = document.getElementById('view-toggle');
      expect(btn.classList.contains('active')).toBe(true);
    });

    it('should show Preview label in raw mode', async () => {
      await renderMarkdown('# Test', 'test.md');
      toggleViewMode();

      const label = document.querySelector('.view-toggle-label');
      expect(label.textContent).toBe('Preview');
    });

    it('should switch back to preview mode', async () => {
      await renderMarkdown('# Test', 'test.md');
      toggleViewMode(); // -> raw
      toggleViewMode(); // -> preview

      expect(currentViewMode).toBe('preview');
      const btn = document.getElementById('view-toggle');
      expect(btn.classList.contains('active')).toBe(false);
    });

    it('should show Raw label after switching back to preview', async () => {
      await renderMarkdown('# Test', 'test.md');
      toggleViewMode(); // -> raw
      toggleViewMode(); // -> preview

      const label = document.querySelector('.view-toggle-label');
      expect(label.textContent).toBe('Raw');
    });
  });

  describe('renderMarkdown stores raw content', () => {
    it('should store the raw markdown content', async () => {
      const md = '# Title\n\nParagraph';
      await renderMarkdown(md, 'doc.md');
      expect(currentRawMarkdown).toBe(md);
    });

    it('should reset view mode to preview on new render', async () => {
      await renderMarkdown('# First', 'first.md');
      toggleViewMode(); // -> raw
      await renderMarkdown('# Second', 'second.md');
      expect(currentViewMode).toBe('preview');
    });
  });

  describe('showDropZone resets state', () => {
    it('should clear raw markdown and reset view mode', async () => {
      await renderMarkdown('# Test', 'test.md');
      toggleViewMode();

      showDropZone();

      expect(currentRawMarkdown).toBe('');
      expect(currentViewMode).toBe('preview');
    });
  });
});
