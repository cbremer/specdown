// Lightweight sticky-note annotations stored in localStorage, keyed by
// filename. Users can double-click any paragraph or heading to add/edit one.
// State is private to this module.

const ANNOTATIONS_KEY = 'specdown-annotations';

let annotationMode = false;
let annotationKey = '';

const content = () => document.getElementById('markdown-content');

function loadAnnotations(key) {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[key] || {};
  } catch (e) {
    return {};
  }
}

function saveAnnotations(key, annotations) {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    if (Object.keys(annotations).length === 0) {
      delete all[key];
    } else {
      all[key] = annotations;
    }
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));
  } catch (e) {
    // localStorage quota exceeded — silently ignore
  }
}

/**
 * Toggle annotation mode. Callers are responsible for any platform chrome
 * sync (e.g. the iOS action bar) after toggling.
 */
export function toggleAnnotationMode() {
  annotationMode = !annotationMode;
  const btn = document.getElementById('annotation-toggle');
  if (btn) btn.classList.toggle('active', annotationMode);

  if (annotationMode && annotationKey) {
    attachAnnotationHandlers();
  } else {
    detachAnnotationHandlers();
  }
}

/** Render saved annotation badges for a document, keyed by filename. */
export function renderAnnotations(key) {
  const markdownContent = content();
  annotationKey = key;
  // Remove old annotation badges
  markdownContent.querySelectorAll('.annotation-badge').forEach((b) => b.remove());

  const annotations = loadAnnotations(key);
  Object.entries(annotations).forEach(([idx, text]) => {
    const el = markdownContent.querySelectorAll('[data-annot-idx]')[parseInt(idx, 10)];
    if (el) attachAnnotationBadge(el, parseInt(idx, 10), text);
  });

  // Re-arm double-click handlers if the user is currently annotating.
  if (annotationMode) attachAnnotationHandlers();
}

function attachAnnotationHandlers() {
  // Index all annotatable elements
  const els = content().querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
  els.forEach((el, idx) => {
    el.setAttribute('data-annot-idx', idx);
    el.classList.add('annotatable');
    el.addEventListener('dblclick', handleAnnotationDblClick);
  });
}

function detachAnnotationHandlers() {
  content()
    .querySelectorAll('.annotatable')
    .forEach((el) => {
      el.removeEventListener('dblclick', handleAnnotationDblClick);
      el.classList.remove('annotatable');
    });
}

function handleAnnotationDblClick(e) {
  if (!annotationMode) return;
  const el = e.currentTarget;
  const idx = parseInt(el.getAttribute('data-annot-idx'), 10);
  const annotations = loadAnnotations(annotationKey);
  const existing = annotations[idx] || '';

  const note = prompt('Add annotation (leave blank to remove):', existing);
  if (note === null) return; // cancelled

  if (note.trim() === '') {
    delete annotations[idx];
    const badge = el.querySelector('.annotation-badge');
    if (badge) badge.remove();
  } else {
    annotations[idx] = note.trim();
    attachAnnotationBadge(el, idx, note.trim());
  }
  saveAnnotations(annotationKey, annotations);
}

function attachAnnotationBadge(el, idx, text) {
  // Remove existing badge first
  const existing = el.querySelector('.annotation-badge');
  if (existing) existing.remove();

  el.setAttribute('data-annot-idx', idx);
  el.classList.add('has-annotation');

  const badge = document.createElement('span');
  badge.className = 'annotation-badge';
  badge.title = text;
  badge.textContent = '✎';
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    showAnnotationPopover(badge, text);
  });
  el.appendChild(badge);
}

function showAnnotationPopover(anchor, text) {
  let popover = document.getElementById('annotation-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'annotation-popover';
    popover.className = 'annotation-popover';
    document.body.appendChild(popover);
  }
  popover.textContent = text;
  const rect = anchor.getBoundingClientRect();
  popover.style.top = rect.bottom + window.scrollY + 4 + 'px';
  popover.style.left = rect.left + window.scrollX + 'px';
  popover.style.display = '';

  const hide = (e) => {
    if (!popover.contains(e.target) && e.target !== anchor) {
      popover.style.display = 'none';
      document.removeEventListener('click', hide);
    }
  };
  setTimeout(() => document.addEventListener('click', hide), 0);
}
