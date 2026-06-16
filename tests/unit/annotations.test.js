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

    it('renders saved badges when annotation mode is OFF (indexes blocks itself)', () => {
      // Regression: previously badges only resolved their anchor while
      // annotation mode was active, so saved notes were invisible on load.
      const data = { 'doc.md': { 1: 'second-block note' } };
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(data));

      const mc = document.getElementById('markdown-content');
      // No data-annot-idx attributes, not in annotation mode.
      mc.innerHTML = '<p>Block zero</p><p>Block one</p>';

      renderAnnotations('doc.md');

      const badges = mc.querySelectorAll('.annotation-badge');
      expect(badges.length).toBe(1);
      // The badge attaches to the second paragraph (index 1).
      expect(mc.querySelectorAll('p')[1].querySelector('.annotation-badge')).not.toBeNull();
      expect(mc.querySelectorAll('p')[0].querySelector('.annotation-badge')).toBeNull();
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

describe('Annotation export / import', () => {
  const KEY = 'specdown-annotations';

  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  it('exports the full store as pretty JSON', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'a.md': { 0: 'note' } }));
    const parsed = JSON.parse(getAnnotationsJSON());
    expect(parsed).toEqual({ 'a.md': { 0: 'note' } });
  });

  it('returns an empty object JSON when there are no annotations', () => {
    expect(JSON.parse(getAnnotationsJSON())).toEqual({});
  });

  it('merges imported annotations across files', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'a.md': { 0: 'keep' } }));
    const ok = importAnnotations(JSON.stringify({ 'a.md': { 1: 'add' }, 'b.md': { 0: 'new' } }));

    expect(ok).toBe(true);
    const store = JSON.parse(localStorage.getItem(KEY));
    expect(store).toEqual({
      'a.md': { 0: 'keep', 1: 'add' },
      'b.md': { 0: 'new' },
    });
  });

  it('lets incoming notes win on a key conflict', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'a.md': { 0: 'old' } }));
    importAnnotations(JSON.stringify({ 'a.md': { 0: 'new' } }));
    expect(JSON.parse(localStorage.getItem(KEY))['a.md']['0']).toBe('new');
  });

  it('rejects invalid JSON with an error toast', () => {
    const ok = importAnnotations('{ not json');
    expect(ok).toBe(false);
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.classList.contains('toast-error')).toBe(true);
  });

  it('rejects a non-object payload', () => {
    expect(importAnnotations(JSON.stringify([1, 2, 3]))).toBe(false);
  });
});

describe('Annotation editor + panel', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  it('adds a note via the in-app editor (no window.prompt needed)', () => {
    const mc = document.getElementById('markdown-content');
    mc.innerHTML = '<p>Block zero</p>';
    renderAnnotations('doc.md');
    toggleAnnotationMode(); // arms double-click handlers

    mc.querySelector('p').dispatchEvent(new Event('dblclick', { bubbles: true }));

    const backdrop = document.getElementById('annotation-editor-backdrop');
    expect(backdrop).not.toBeNull();
    expect(backdrop.style.display).toBe('flex');

    backdrop.querySelector('.annotation-editor-input').value = 'My note';
    backdrop.querySelector('.annotation-editor-save').dispatchEvent(new Event('click', { bubbles: true }));

    expect(mc.querySelector('p').querySelector('.annotation-badge')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('specdown-annotations'))['doc.md']['0']).toBe('My note');
    expect(backdrop.style.display).toBe('none');
  });

  it('renders the panel rows + toolbar count', () => {
    localStorage.setItem('specdown-annotations', JSON.stringify({ 'doc.md': { 0: 'note A', 1: 'note B' } }));
    const mc = document.getElementById('markdown-content');
    mc.innerHTML = '<p>Zero</p><p>One</p>';
    renderAnnotations('doc.md');

    const toggle = document.getElementById('annotation-list-toggle');
    expect(toggle.style.display).not.toBe('none');
    expect(toggle.querySelector('.annotation-list-count').textContent).toBe('2');

    const items = document.querySelectorAll('.annotation-list-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.annotation-list-note').textContent).toBe('note A');
    expect(items[0].querySelector('.annotation-list-context').textContent).toBe('Zero');
  });

  it('hides the toggle when there are no notes', () => {
    const mc = document.getElementById('markdown-content');
    mc.innerHTML = '<p>Zero</p>';
    renderAnnotations('doc.md');
    expect(document.getElementById('annotation-list-toggle').style.display).toBe('none');
  });

  it('opens and closes the panel', () => {
    localStorage.setItem('specdown-annotations', JSON.stringify({ 'doc.md': { 0: 'n' } }));
    const mc = document.getElementById('markdown-content');
    mc.innerHTML = '<p>Zero</p>';
    renderAnnotations('doc.md');

    const panel = document.getElementById('annotation-panel');
    openAnnotationPanel();
    expect(panel.classList.contains('open')).toBe(true);
    toggleAnnotationPanel();
    expect(panel.classList.contains('open')).toBe(false);
  });

  it('deleting the last note from the panel hides the toggle and closes the panel', () => {
    localStorage.setItem('specdown-annotations', JSON.stringify({ 'doc.md': { 0: 'n' } }));
    const mc = document.getElementById('markdown-content');
    mc.innerHTML = '<p>Zero</p>';
    renderAnnotations('doc.md');
    openAnnotationPanel();

    document.querySelector('.annotation-list-delete').dispatchEvent(new Event('click', { bubbles: true }));

    expect(document.getElementById('annotation-list-toggle').style.display).toBe('none');
    expect(document.getElementById('annotation-panel').classList.contains('open')).toBe(false);
  });
});
