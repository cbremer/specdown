/**
 * Unit tests for annotation mode
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const ANNOTATIONS_KEY = 'specdown-annotations';

describe('Annotation Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  // ===========================
  // loadAnnotations
  // ===========================
  describe('loadAnnotations', () => {
    it('returns an empty object when localStorage has no annotations', () => {
      const result = loadAnnotations('test.md');
      expect(result).toEqual({});
    });

    it('returns the stored annotations for the given key', () => {
      const data = { 'test.md': { 0: 'Note A', 3: 'Note B' } };
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(data));

      const result = loadAnnotations('test.md');
      expect(result).toEqual({ 0: 'Note A', 3: 'Note B' });
    });

    it('returns empty object for a key that does not exist', () => {
      const data = { 'other.md': { 0: 'Note' } };
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(data));

      const result = loadAnnotations('missing.md');
      expect(result).toEqual({});
    });

    it('returns empty object on malformed JSON', () => {
      localStorage.setItem(ANNOTATIONS_KEY, 'NOT_JSON');
      expect(() => loadAnnotations('test.md')).not.toThrow();
      const result = loadAnnotations('test.md');
      expect(result).toEqual({});
    });
  });

  // ===========================
  // saveAnnotations
  // ===========================
  describe('saveAnnotations', () => {
    it('persists annotations to localStorage', () => {
      saveAnnotations('test.md', { 0: 'Hello' });

      const raw = localStorage.getItem(ANNOTATIONS_KEY);
      const all = JSON.parse(raw);
      expect(all['test.md']).toEqual({ 0: 'Hello' });
    });

    it('merges with existing annotations for other keys', () => {
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ 'other.md': { 1: 'Existing' } }));

      saveAnnotations('test.md', { 0: 'New' });

      const raw = localStorage.getItem(ANNOTATIONS_KEY);
      const all = JSON.parse(raw);
      expect(all['other.md']).toEqual({ 1: 'Existing' });
      expect(all['test.md']).toEqual({ 0: 'New' });
    });

    it('removes the key from storage when annotations object is empty', () => {
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ 'test.md': { 0: 'Old note' } }));

      saveAnnotations('test.md', {});

      const raw = localStorage.getItem(ANNOTATIONS_KEY);
      const all = JSON.parse(raw);
      expect(all['test.md']).toBeUndefined();
    });
  });

  // ===========================
  // toggleAnnotationMode
  // ===========================
  describe('toggleAnnotationMode', () => {
    it('toggles annotationMode from false to true', () => {
      expect(annotationMode).toBe(false);
      toggleAnnotationMode();
      expect(annotationMode).toBe(true);
    });

    it('toggles annotationMode back to false', () => {
      toggleAnnotationMode();
      toggleAnnotationMode();
      expect(annotationMode).toBe(false);
    });

    it('adds active class to the annotation-toggle button when enabled', () => {
      const btn = document.getElementById('annotation-toggle');
      toggleAnnotationMode();
      expect(btn.classList.contains('active')).toBe(true);
    });

    it('removes active class from the annotation-toggle button when disabled', () => {
      const btn = document.getElementById('annotation-toggle');
      toggleAnnotationMode();
      toggleAnnotationMode();
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  // ===========================
  // renderAnnotations
  // ===========================
  describe('renderAnnotations', () => {
    beforeEach(async () => {
      await renderMarkdown('# Title\n\nFirst paragraph.\n\nSecond paragraph.', 'test.md');
    });

    it('sets annotationKey to the given key', () => {
      renderAnnotations('test.md');
      expect(annotationKey).toBe('test.md');
    });

    it('removes old annotation badges before rendering', () => {
      // Manually insert a stale badge
      const mc = document.getElementById('markdown-content');
      const stale = document.createElement('span');
      stale.className = 'annotation-badge';
      mc.appendChild(stale);

      renderAnnotations('test.md');

      expect(mc.querySelectorAll('.annotation-badge').length).toBe(0);
    });

    it('renders badges for stored annotations', () => {
      const data = { 'test.md': { 0: 'My note' } };
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(data));

      // Insert elements with data-annot-idx directly so renderAnnotations
      // can find them (marked mock doesn't produce block elements)
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<p data-annot-idx="0">Para 0</p><p data-annot-idx="1">Para 1</p>';

      renderAnnotations('test.md');

      const badges = document.querySelectorAll('.annotation-badge');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================
  // attachAnnotationBadge
  // ===========================
  describe('attachAnnotationBadge', () => {
    function makeParagraph() {
      const mc = document.getElementById('markdown-content');
      const p = document.createElement('p');
      p.textContent = 'Test paragraph';
      mc.appendChild(p);
      return p;
    }

    it('appends a badge element to the target element', () => {
      const p = makeParagraph();

      attachAnnotationBadge(p, 0, 'Test note');

      const badge = p.querySelector('.annotation-badge');
      expect(badge).not.toBeNull();
    });

    it('sets the badge title to the annotation text', () => {
      const p = makeParagraph();

      attachAnnotationBadge(p, 0, 'My annotation');

      const badge = p.querySelector('.annotation-badge');
      expect(badge.title).toBe('My annotation');
    });

    it('adds has-annotation class to the element', () => {
      const p = makeParagraph();

      attachAnnotationBadge(p, 0, 'Note');

      expect(p.classList.contains('has-annotation')).toBe(true);
    });

    it('replaces an existing badge rather than adding a second one', () => {
      const p = makeParagraph();

      attachAnnotationBadge(p, 0, 'First');
      attachAnnotationBadge(p, 0, 'Second');

      const badges = p.querySelectorAll('.annotation-badge');
      expect(badges.length).toBe(1);
      expect(badges[0].title).toBe('Second');
    });
  });

  // ===========================
  // attachAnnotationHandlers / detachAnnotationHandlers
  // ===========================
  describe('attachAnnotationHandlers', () => {
    beforeEach(() => {
      // Insert annotatable elements directly since the marked mock
      // doesn't produce semantic block elements
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<h1>Heading</h1><p>Para one.</p><p>Para two.</p>';
    });

    it('adds annotatable class to paragraphs and headings', () => {
      attachAnnotationHandlers();

      const annotatable = document.querySelectorAll('.annotatable');
      expect(annotatable.length).toBeGreaterThan(0);
    });

    it('assigns data-annot-idx attributes starting from 0', () => {
      attachAnnotationHandlers();

      const els = document.querySelectorAll('[data-annot-idx]');
      expect(els.length).toBeGreaterThan(0);
      expect(els[0].getAttribute('data-annot-idx')).toBe('0');
    });
  });

  describe('detachAnnotationHandlers', () => {
    beforeEach(() => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<h1>Heading</h1><p>Para one.</p>';
      attachAnnotationHandlers();
    });

    it('removes annotatable class from all elements', () => {
      detachAnnotationHandlers();

      const annotatable = document.querySelectorAll('.annotatable');
      expect(annotatable.length).toBe(0);
    });
  });
});
