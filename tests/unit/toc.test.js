/**
 * Unit tests for the Table of Contents sidebar
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Table of Contents', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  // ===========================
  // buildToc
  // ===========================
  describe('buildToc', () => {
    it('creates one TOC link per heading', async () => {
      await renderMarkdown('# One\n\n## Two\n\n### Three\n\nParagraph.', 'test.md');

      const links = document.querySelectorAll('#toc-nav .toc-link');
      expect(links.length).toBe(3);
    });

    it('sets TOC link text to heading text content', async () => {
      await renderMarkdown('# My Heading\n\n## Sub Heading', 'test.md');

      const links = [...document.querySelectorAll('#toc-nav .toc-link')];
      const texts = links.map((l) => l.textContent);
      expect(texts).toContain('My Heading');
      expect(texts).toContain('Sub Heading');
    });

    it('assigns correct toc-level-N class', async () => {
      // The marked mock only supports h1/h2/h3 — test those levels
      await renderMarkdown('# H1\n\n## H2\n\n### H3', 'test.md');

      const links = document.querySelectorAll('#toc-nav .toc-link');
      expect(links[0].classList.contains('toc-level-1')).toBe(true);
      expect(links[1].classList.contains('toc-level-2')).toBe(true);
      expect(links[2].classList.contains('toc-level-3')).toBe(true);
    });

    it('auto-assigns id to headings that lack one', async () => {
      await renderMarkdown('# No Id Heading', 'test.md');

      const heading = document.querySelector('#markdown-content h1');
      expect(heading.id).toBeTruthy();
    });

    it('preserves existing heading ids', async () => {
      // Inject a heading with an existing id via innerHTML directly
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<h1 id="my-existing-id">Title</h1>';
      buildToc();

      const link = document.querySelector('#toc-nav .toc-link');
      expect(link.getAttribute('href')).toBe('#my-existing-id');
    });

    it('hides the TOC toggle button when there are no headings', async () => {
      await renderMarkdown('Just a paragraph, no headings.', 'test.md');

      // The mock marked.js doesn't produce headings from plain paragraphs
      // so tocToggle should be hidden
      const btn = document.getElementById('toc-toggle');
      // buildToc hides the button when headings.length === 0
      // (the marked mock only converts # lines to headings)
      // paragraphs-only → no heading elements → button hidden
      expect(btn.style.display).toBe('none');
    });

    it('shows the TOC toggle button when headings exist', async () => {
      await renderMarkdown('# Title', 'test.md');

      const btn = document.getElementById('toc-toggle');
      expect(btn.style.display).not.toBe('none');
    });

    it('rebuilds the TOC on each renderMarkdown call', async () => {
      await renderMarkdown('# First Doc\n\n## Section', 'first.md');
      await renderMarkdown('# Second Doc', 'second.md');

      const links = document.querySelectorAll('#toc-nav .toc-link');
      expect(links.length).toBe(1);
      expect(links[0].textContent).toBe('Second Doc');
    });

    it('does not include h5/h6 in the TOC', async () => {
      // The marked mock converts # to <h1>, ## to <h2>, ### to <h3>
      // but doesn't handle h5/h6 from markdown. We inject manually:
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<h1>H1</h1><h5>H5</h5><h6>H6</h6>';
      buildToc();

      const links = document.querySelectorAll('#toc-nav .toc-link');
      // buildToc only queries h1,h2,h3,h4
      expect(links.length).toBe(1);
    });
  });

  // ===========================
  // toggleToc
  // ===========================
  describe('toggleToc', () => {
    it('shows the TOC sidebar when toggled on', () => {
      const sidebar = document.getElementById('toc-sidebar');
      sidebar.style.display = 'none';

      toggleToc(); // turn on

      expect(sidebar.style.display).not.toBe('none');
    });

    it('hides the TOC sidebar when toggled off', () => {
      toggleToc(); // on
      toggleToc(); // off

      const sidebar = document.getElementById('toc-sidebar');
      expect(sidebar.style.display).toBe('none');
    });

    it('adds active class to TOC button when toggled on', () => {
      toggleToc();

      const btn = document.getElementById('toc-toggle');
      expect(btn.classList.contains('active')).toBe(true);
    });

    it('removes active class from TOC button when toggled off', () => {
      toggleToc(); // on
      toggleToc(); // off

      const btn = document.getElementById('toc-toggle');
      expect(btn.classList.contains('active')).toBe(false);
    });

    it('updates tocVisible state correctly', () => {
      expect(tocVisible).toBe(false);
      toggleToc();
      expect(tocVisible).toBe(true);
      toggleToc();
      expect(tocVisible).toBe(false);
    });
  });

  // ===========================
  // TOC link href anchors
  // ===========================
  describe('TOC link anchors', () => {
    it('each TOC link href matches the heading id', async () => {
      await renderMarkdown('# Alpha\n\n## Beta', 'test.md');

      const links = [...document.querySelectorAll('#toc-nav .toc-link')];
      const headings = [...document.querySelectorAll('#markdown-content h1, #markdown-content h2')];

      links.forEach((link, i) => {
        expect(link.getAttribute('href')).toBe('#' + headings[i].id);
      });
    });
  });

  // ===========================
  // TOC resets with showDropZone
  // ===========================
  describe('showDropZone resets TOC', () => {
    it('hides the TOC sidebar when returning to drop zone', async () => {
      await renderMarkdown('# Title', 'test.md');
      toggleToc(); // open it

      showDropZone();

      const sidebar = document.getElementById('toc-sidebar');
      expect(sidebar.style.display).toBe('none');
    });

    it('resets tocVisible to false', async () => {
      await renderMarkdown('# Title', 'test.md');
      toggleToc();
      expect(tocVisible).toBe(true);

      showDropZone();

      expect(tocVisible).toBe(false);
    });
  });
});
