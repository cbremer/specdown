// @ts-check
// Lightweight sticky-note annotations stored in localStorage, keyed by
// filename. Users can double-click any paragraph or heading to add/edit one.
// State is private to this module.

import { showToast } from './toast.js';

const ANNOTATIONS_KEY = 'specdown-annotations';

let annotationMode = false;
let annotationKey = '';

const content = () => document.getElementById('markdown-content');

/**
 * @param {string} key
 * @returns {Record<string, string>}
 */
function loadAnnotations(key) {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[key] || {};
  } catch (e) {
    return {};
  }
}

/**
 * @param {string} key
 * @param {Record<string, string>} annotations
 */
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
 * The full annotation store: filename → { elementIndex → note }.
 * @returns {Record<string, Record<string, string>>}
 */
function getAllAnnotations() {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Pretty-printed JSON of the entire annotation store (for export / inspection).
 * @returns {string}
 */
export function getAnnotationsJSON() {
  return JSON.stringify(getAllAnnotations(), null, 2);
}

/** Download all annotations as a JSON file. */
export function exportAnnotations() {
  const json = getAnnotationsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'specdown-annotations.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Merge imported annotations into the store. Per file, incoming notes win on a
 * key (element-index) conflict; other files/notes are preserved. Re-renders the
 * current document's badges. Returns whether the import succeeded.
 * @param {string} jsonText
 * @returns {boolean}
 */
export function importAnnotations(jsonText) {
  let incoming;
  try {
    incoming = JSON.parse(jsonText);
  } catch (e) {
    showToast('Import failed: the file is not valid JSON.', { type: 'error' });
    return false;
  }
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    showToast('Import failed: unexpected annotations format.', { type: 'error' });
    return false;
  }

  const existing = getAllAnnotations();
  let fileCount = 0;
  for (const [file, notes] of Object.entries(incoming)) {
    if (!notes || typeof notes !== 'object') continue;
    existing[file] = Object.assign({}, existing[file] || {}, notes);
    fileCount += 1;
  }

  try {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(existing));
  } catch (e) {
    showToast('Import failed: could not save (storage full?).', { type: 'error' });
    return false;
  }

  if (annotationKey) renderAnnotations(annotationKey);
  showToast(`Imported annotations for ${fileCount} document(s).`, { type: 'success' });
  return true;
}

/** Open a file picker and import the chosen annotations JSON. */
export function importAnnotationsFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importAnnotations(String(reader.result || ''));
    reader.onerror = () => showToast('Could not read the file.', { type: 'error' });
    reader.readAsText(file);
  });
  input.click();
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

/**
 * Render saved annotation badges for a document, keyed by filename.
 * @param {string} key
 */
export function renderAnnotations(key) {
  const markdownContent = content();
  annotationKey = key;
  if (!markdownContent) return;
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
  const root = content();
  if (!root) return;
  // Index all annotatable elements
  const els = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
  els.forEach((el, idx) => {
    el.setAttribute('data-annot-idx', String(idx));
    el.classList.add('annotatable');
    el.addEventListener('dblclick', handleAnnotationDblClick);
  });
}

function detachAnnotationHandlers() {
  const root = content();
  if (!root) return;
  root.querySelectorAll('.annotatable').forEach((el) => {
    el.removeEventListener('dblclick', handleAnnotationDblClick);
    el.classList.remove('annotatable');
  });
}

/** @param {Event} e */
function handleAnnotationDblClick(e) {
  if (!annotationMode) return;
  const el = /** @type {HTMLElement} */ (e.currentTarget);
  const idx = parseInt(el.getAttribute('data-annot-idx') || '', 10);
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

/**
 * @param {Element} el
 * @param {number} idx
 * @param {string} text
 */
function attachAnnotationBadge(el, idx, text) {
  // Remove existing badge first
  const existing = el.querySelector('.annotation-badge');
  if (existing) existing.remove();

  el.setAttribute('data-annot-idx', String(idx));
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

/**
 * @param {HTMLElement} anchor
 * @param {string} text
 */
function showAnnotationPopover(anchor, text) {
  let popover = document.getElementById('annotation-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'annotation-popover';
    popover.className = 'annotation-popover';
    document.body.appendChild(popover);
  }
  const box = popover;
  box.textContent = text;
  const rect = anchor.getBoundingClientRect();
  box.style.top = rect.bottom + window.scrollY + 4 + 'px';
  box.style.left = rect.left + window.scrollX + 'px';
  box.style.display = '';

  /** @param {Event} e */
  const hide = (e) => {
    const target = /** @type {Node} */ (e.target);
    if (!box.contains(target) && e.target !== anchor) {
      box.style.display = 'none';
      document.removeEventListener('click', hide);
    }
  };
  setTimeout(() => document.addEventListener('click', hide), 0);
}
