/**
 * Unit tests for annotation mode (durable anchoring, schema v2).
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
  // Storage (v2 + v1 migration)
  // ===========================
  describe('store helpers', () => {
    it('returns an empty v2 store when localStorage is empty', () => {
      expect(annReadStore()).toEqual({ version: 2, files: {} });
    });

    it('reads a legacy v1 store as migrated v2 notes (anchor null, index kept)', () => {
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ 'a.md': { 0: 'x', 2: 'y' } }));
      const store = annReadStore();
      expect(store.version).toBe(2);
      expect(store.files['a.md'].map((n) => n.text)).toEqual(['x', 'y']);
      expect(store.files['a.md'][0].legacyIdx).toBe(0);
      expect(store.files['a.md'][1].legacyIdx).toBe(2);
      expect(store.files['a.md'][0].anchor).toBeNull();
    });

    it('returns an empty v2 store on malformed JSON', () => {
      localStorage.setItem(ANNOTATIONS_KEY, 'NOT_JSON');
      expect(() => annReadStore()).not.toThrow();
      expect(annReadStore()).toEqual({ version: 2, files: {} });
    });

    it('annFileNotes returns the notes array for a key', () => {
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ 'a.md': { 0: 'x' } }));
      expect(annFileNotes('a.md').map((n) => n.text)).toEqual(['x']);
      expect(annFileNotes('missing.md')).toEqual([]);
    });

    it('annPutFileNotes writes v2 and drops empty files', () => {
      annPutFileNotes('a.md', [{ id: 'n', text: 't', anchor: null, legacyIdx: 0 }]);
      let store = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY));
      expect(store.version).toBe(2);
      expect(store.files['a.md'][0].text).toBe('t');

      annPutFileNotes('a.md', []);
      store = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY));
      expect(store.files['a.md']).toBeUndefined();
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

    it('adds/removes active class on the annotation-toggle button', () => {
      const btn = document.getElementById('annotation-toggle');
      toggleAnnotationMode();
      expect(btn.classList.contains('active')).toBe(true);
      toggleAnnotationMode();
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  // ===========================
  // renderAnnotations
  // ===========================
  describe('renderAnnotations', () => {
    it('sets annotationKey to the given key', () => {
      renderAnnotations('test.md');
      expect(annotationKey).toBe('test.md');
    });

    it('removes old annotation badges before rendering', () => {
      const mc = document.getElementById('markdown-content');
      const stale = document.createElement('span');
      stale.className = 'annotation-badge';
      mc.appendChild(stale);

      renderAnnotations('test.md');

      expect(mc.querySelectorAll('.annotation-badge').length).toBe(0);
    });

    it('renders saved badges when annotation mode is OFF (indexes blocks itself)', () => {
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ 'doc.md': { 1: 'second-block note' } }));
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<p>Block zero</p><p>Block one</p>';

      renderAnnotations('doc.md');

      const badges = mc.querySelectorAll('.annotation-badge');
      expect(badges.length).toBe(1);
      expect(mc.querySelectorAll('p')[1].querySelector('.annotation-badge')).not.toBeNull();
      expect(mc.querySelectorAll('p')[0].querySelector('.annotation-badge')).toBeNull();
    });

    it('migrates a legacy v1 note and upgrades it to a durable anchor on render', () => {
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ 'm.md': { 1: 'legacy note' } }));
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<p>Zero</p><p>One</p>';

      renderAnnotations('m.md');

      const store = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY));
      expect(store.version).toBe(2);
      const note = store.files['m.md'][0];
      expect(note.text).toBe('legacy note');
      expect(note.anchor).not.toBeNull();
      expect(typeof note.anchor.fp).toBe('string');
      expect(note.legacyIdx).toBe(1);
    });
  });

  // ===========================
  // Durable re-anchoring (the point of this feature)
  // ===========================
  describe('durable anchoring', () => {
    it('follows the note to its content when blocks are reordered', () => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<p>Alpha</p><p>Beta</p><p>Gamma</p>';
      renderAnnotations('reorder.md');

      const beta = [...mc.querySelectorAll('p')].find((p) => p.textContent === 'Beta');
      commitAnnotation({ element: beta }, 'note on beta');
      expect(beta.querySelector('.annotation-badge')).not.toBeNull();

      // Move Beta from index 1 to index 2.
      mc.innerHTML = '<p>Gamma</p><p>Alpha</p><p>Beta</p>';
      renderAnnotations('reorder.md');

      const ps = [...mc.querySelectorAll('p')];
      const badged = ps.filter((p) => p.querySelector('.annotation-badge'));
      expect(badged.length).toBe(1);
      // The single badge is on the "Beta" block (textContent includes the ✎ badge).
      expect(badged[0].textContent.replace('✎', '').trim()).toBe('Beta');
      // The block now sitting at Beta's *old* index 1 is Alpha — no badge there.
      expect(ps[1].textContent).toBe('Alpha');
    });

    it('disambiguates duplicate text by heading path', () => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML =
        '<h2>First</h2><p>same text</p><h2>Second</h2><p>same text</p>';
      renderAnnotations('dupe.md');

      // Annotate the "same text" under the "Second" heading (the 2nd paragraph).
      const secondPara = mc.querySelectorAll('p')[1];
      commitAnnotation({ element: secondPara }, 'second one');

      // Re-render; the badge must stay on the paragraph under "Second".
      renderAnnotations('dupe.md');
      const paras = mc.querySelectorAll('p');
      expect(paras[0].querySelector('.annotation-badge')).toBeNull();
      expect(paras[1].querySelector('.annotation-badge')).not.toBeNull();
    });

    it('falls back to the stored index and flags the note when its text is edited', () => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<p>Alpha</p><p>Beta</p>';
      renderAnnotations('edited.md');
      const beta = [...mc.querySelectorAll('p')].find((p) => p.textContent === 'Beta');
      commitAnnotation({ element: beta }, 'n');

      // Rewrite Beta's text so the fingerprint no longer matches.
      mc.innerHTML = '<p>Alpha</p><p>Beta, heavily rewritten now</p>';
      renderAnnotations('edited.md');

      const second = mc.querySelectorAll('p')[1];
      expect(second.querySelector('.annotation-badge')).not.toBeNull();
      expect(second.classList.contains('annotation-orphaned')).toBe(true);
    });
  });

  // ===========================
  // attachAnnotationBadge
  // ===========================
  describe('attachAnnotationBadge', () => {
    const note = (text, id = 'n1') => ({ id, text, anchor: null, legacyIdx: 0 });
    function makeParagraph() {
      const mc = document.getElementById('markdown-content');
      const p = document.createElement('p');
      p.textContent = 'Test paragraph';
      mc.appendChild(p);
      return p;
    }

    it('appends a badge and tags the element with the note id', () => {
      const p = makeParagraph();
      attachAnnotationBadge(p, note('Test note'), false);
      expect(p.querySelector('.annotation-badge')).not.toBeNull();
      expect(p.getAttribute('data-annot-id')).toBe('n1');
      expect(p.classList.contains('has-annotation')).toBe(true);
    });

    it('sets the badge title to the annotation text', () => {
      const p = makeParagraph();
      attachAnnotationBadge(p, note('My annotation'), false);
      expect(p.querySelector('.annotation-badge').title).toBe('My annotation');
    });

    it('replaces an existing badge rather than adding a second one', () => {
      const p = makeParagraph();
      attachAnnotationBadge(p, note('First'), false);
      attachAnnotationBadge(p, note('Second'), false);
      const badges = p.querySelectorAll('.annotation-badge');
      expect(badges.length).toBe(1);
      expect(badges[0].title).toBe('Second');
    });

    it('marks an orphaned (best-guess) badge', () => {
      const p = makeParagraph();
      attachAnnotationBadge(p, note('x'), true);
      expect(p.classList.contains('annotation-orphaned')).toBe(true);
      expect(p.querySelector('.annotation-badge').classList.contains('annotation-badge-orphaned')).toBe(true);
    });
  });

  // ===========================
  // attach / detach handlers
  // ===========================
  describe('attachAnnotationHandlers / detachAnnotationHandlers', () => {
    beforeEach(() => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<h1>Heading</h1><p>Para one.</p><p>Para two.</p>';
    });

    it('adds annotatable class and data-annot-idx', () => {
      attachAnnotationHandlers();
      expect(document.querySelectorAll('.annotatable').length).toBeGreaterThan(0);
      const els = document.querySelectorAll('[data-annot-idx]');
      expect(els[0].getAttribute('data-annot-idx')).toBe('0');
    });

    it('removes annotatable class on detach', () => {
      attachAnnotationHandlers();
      detachAnnotationHandlers();
      expect(document.querySelectorAll('.annotatable').length).toBe(0);
    });
  });
});

describe('Annotation export / import', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  it('exports the store as v2 (migrating legacy data)', () => {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ 'a.md': { 0: 'note' } }));
    const parsed = JSON.parse(getAnnotationsJSON());
    expect(parsed.version).toBe(2);
    expect(parsed.files['a.md'][0].text).toBe('note');
  });

  it('returns an empty v2 store JSON when there are no annotations', () => {
    expect(JSON.parse(getAnnotationsJSON())).toEqual({ version: 2, files: {} });
  });

  it('imports a v2 payload, merging across files', () => {
    annPutFileNotes('a.md', [{ id: 'x', text: 'keep', anchor: null, legacyIdx: 0 }]);
    const ok = importAnnotations(
      JSON.stringify({
        version: 2,
        files: {
          'a.md': [{ id: 'y', text: 'add', anchor: null, legacyIdx: 1 }],
          'b.md': [{ id: 'z', text: 'new', anchor: null, legacyIdx: 0 }],
        },
      })
    );
    expect(ok).toBe(true);
    const store = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY));
    expect(store.files['a.md'].map((n) => n.text).sort()).toEqual(['add', 'keep']);
    expect(store.files['b.md'][0].text).toBe('new');
  });

  it('imports a legacy v1 payload by migrating it', () => {
    const ok = importAnnotations(JSON.stringify({ 'a.md': { 0: 'from v1' } }));
    expect(ok).toBe(true);
    const store = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY));
    expect(store.version).toBe(2);
    expect(store.files['a.md'][0].text).toBe('from v1');
  });

  it('does not duplicate an identical re-import', () => {
    const payload = JSON.stringify({
      version: 2,
      files: { 'a.md': [{ id: 'x', text: 'once', anchor: null, legacyIdx: 0 }] },
    });
    importAnnotations(payload);
    importAnnotations(payload);
    const store = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY));
    expect(store.files['a.md'].length).toBe(1);
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
    const store = JSON.parse(localStorage.getItem('specdown-annotations'));
    expect(store.files['doc.md'][0].text).toBe('My note');
    expect(store.files['doc.md'][0].anchor).not.toBeNull();
    expect(backdrop.style.display).toBe('none');
  });

  it('renders the panel rows + toolbar count, in document order', () => {
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
