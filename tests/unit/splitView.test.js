/**
 * Unit tests for the side-by-side split view feature
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Split View', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  // ===========================
  // toggleSplitView
  // ===========================
  describe('toggleSplitView', () => {
    it('starts inactive by default', () => {
      expect(splitViewActive).toBe(false);
    });

    it('sets splitViewActive to true on first toggle', () => {
      toggleSplitView();
      expect(splitViewActive).toBe(true);
    });

    it('sets splitViewActive back to false on second toggle', () => {
      toggleSplitView();
      toggleSplitView();
      expect(splitViewActive).toBe(false);
    });

    it('adds active class to the split toggle button when enabled', () => {
      toggleSplitView();
      const btn = document.getElementById('split-toggle');
      expect(btn.classList.contains('active')).toBe(true);
    });

    it('removes active class from the split toggle button when disabled', () => {
      toggleSplitView();
      toggleSplitView();
      const btn = document.getElementById('split-toggle');
      expect(btn.classList.contains('active')).toBe(false);
    });

    it('shows the split raw pane when enabled', () => {
      toggleSplitView();
      const pane = document.getElementById('split-raw-pane');
      expect(pane.style.display).not.toBe('none');
    });

    it('hides the split raw pane when disabled', () => {
      toggleSplitView();
      toggleSplitView();
      const pane = document.getElementById('split-raw-pane');
      expect(pane.style.display).toBe('none');
    });

    it('adds split-active class to content-main when enabled', () => {
      toggleSplitView();
      const main = document.getElementById('content-main');
      expect(main.classList.contains('split-active')).toBe(true);
    });

    it('removes split-active class from content-main when disabled', () => {
      toggleSplitView();
      toggleSplitView();
      const main = document.getElementById('content-main');
      expect(main.classList.contains('split-active')).toBe(false);
    });
  });

  // ===========================
  // updateSplitRawPane
  // ===========================
  describe('updateSplitRawPane', () => {
    it('populates the raw pane with the markdown content', () => {
      const md = '# Hello\n\nSome **content** here.';
      updateSplitRawPane(md);

      const pane = document.getElementById('split-raw-content');
      expect(pane.textContent).toContain('# Hello');
    });

    it('HTML-escapes the markdown content', () => {
      updateSplitRawPane('<script>alert("xss")</script>');

      const pane = document.getElementById('split-raw-content');
      expect(pane.innerHTML).toContain('&lt;script&gt;');
      expect(pane.innerHTML).not.toContain('<script>');
    });

    it('escapes ampersands', () => {
      updateSplitRawPane('A & B');

      const pane = document.getElementById('split-raw-content');
      expect(pane.innerHTML).toContain('&amp;');
    });
  });

  // ===========================
  // Split pane syncs on renderMarkdown
  // ===========================
  describe('renderMarkdown keeps split pane in sync', () => {
    it('populates the split pane when split view is active', async () => {
      toggleSplitView(); // enable split before rendering
      const md = '# Test\n\nParagraph.';
      await renderMarkdown(md, 'test.md');

      const pane = document.getElementById('split-raw-content');
      expect(pane.textContent).toContain('# Test');
    });

    it('does not populate the split pane when split view is inactive', async () => {
      // splitViewActive is false by default
      const md = '# Test\n\nParagraph.';
      await renderMarkdown(md, 'test.md');

      const pane = document.getElementById('split-raw-content');
      // Should be empty (the pane is not updated when splitViewActive is false)
      expect(pane.innerHTML).toBe('');
    });
  });

  // ===========================
  // showDropZone resets split view
  // ===========================
  describe('showDropZone resets split view', () => {
    it('disables split view when returning to drop zone', async () => {
      await renderMarkdown('# Test', 'test.md');
      toggleSplitView();
      expect(splitViewActive).toBe(true);

      showDropZone();

      expect(splitViewActive).toBe(false);
    });

    it('hides the raw pane when returning to drop zone', async () => {
      await renderMarkdown('# Test', 'test.md');
      toggleSplitView();

      showDropZone();

      const pane = document.getElementById('split-raw-pane');
      expect(pane.style.display).toBe('none');
    });
  });
});
