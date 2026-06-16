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
    // The interaction (double-click a block) isn't discoverable on its own, so
    // tell the user how to use the mode they just turned on.
    showToast('Annotation mode on — double-click any paragraph or heading to add a note.', {
      type: 'info',
    });
  } else {
    detachAnnotationHandlers();
  }
}

// All block types a note can attach to. Both rendering and the double-click
// handlers index by this exact selector, so element positions line up.
const ANNOTATABLE_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote';

/**
 * Assign a stable positional `data-annot-idx` to every annotatable block. Done
 * on every render (not just in annotation mode) so saved badges can resolve
 * their anchor element even when the user isn't actively annotating.
 * @param {Element} root
 * @returns {NodeListOf<Element>}
 */
function indexAnnotatableElements(root) {
  const els = root.querySelectorAll(ANNOTATABLE_SELECTOR);
  els.forEach((el, idx) => el.setAttribute('data-annot-idx', String(idx)));
  return els;
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

  // Index the blocks first so badges render whether or not annotation mode is
  // on (previously badges only appeared while actively annotating).
  indexAnnotatableElements(markdownContent);

  const annotations = loadAnnotations(key);
  Object.entries(annotations).forEach(([idx, text]) => {
    const el = markdownContent.querySelectorAll('[data-annot-idx]')[parseInt(idx, 10)];
    if (el) attachAnnotationBadge(el, parseInt(idx, 10), text);
  });

  // Re-arm double-click handlers if the user is currently annotating.
  if (annotationMode) attachAnnotationHandlers();

  // Refresh the side panel + toolbar toggle for this document.
  renderAnnotationPanel();
}

function attachAnnotationHandlers() {
  const root = content();
  if (!root) return;
  // Index (idempotent) then make each block interactive.
  const els = indexAnnotatableElements(root);
  els.forEach((el) => {
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
  if (!Number.isNaN(idx)) openAnnotationEditor(idx);
}

/**
 * The annotatable block at a given positional index, or null.
 * @param {number} idx
 */
function annotatedElement(idx) {
  const root = content();
  if (!root) return null;
  const el = root.querySelectorAll('[data-annot-idx]')[idx];
  return el || null;
}

/**
 * Add / edit / remove the note at `idx` and refresh the badge + panel.
 * @param {number} idx
 * @param {string} rawText
 */
function commitAnnotation(idx, rawText) {
  const text = String(rawText || '').trim();
  const el = annotatedElement(idx);
  const annotations = loadAnnotations(annotationKey);

  if (!text) {
    delete annotations[idx];
    if (el) {
      const badge = el.querySelector('.annotation-badge');
      if (badge) badge.remove();
      el.classList.remove('has-annotation');
    }
  } else {
    annotations[idx] = text;
    if (el) attachAnnotationBadge(el, idx, text);
  }
  saveAnnotations(annotationKey, annotations);
  renderAnnotationPanel();
}

// ===========================
// In-app note editor
// ===========================
// Replaces window.prompt(), which Electron does not implement (so desktop
// annotation editing silently did nothing). A small modal works on every
// surface and is nicer than a native prompt.

/** @type {(() => void) | null} */
let editorCleanup = null;

function ensureEditor() {
  let backdrop = document.getElementById('annotation-editor-backdrop');
  if (backdrop) return backdrop;

  backdrop = document.createElement('div');
  backdrop.id = 'annotation-editor-backdrop';
  backdrop.className = 'annotation-editor-backdrop';
  backdrop.innerHTML =
    '<div class="annotation-editor" role="dialog" aria-modal="true" aria-label="Edit note">' +
    '<textarea class="annotation-editor-input" rows="4" placeholder="Write a note…"></textarea>' +
    '<div class="annotation-editor-actions">' +
    '<button type="button" class="annotation-editor-delete">Delete</button>' +
    '<span class="annotation-editor-spacer"></span>' +
    '<button type="button" class="annotation-editor-cancel">Cancel</button>' +
    '<button type="button" class="annotation-editor-save">Save</button>' +
    '</div></div>';
  document.body.appendChild(backdrop);
  return backdrop;
}

/**
 * Open the note editor for the block at `idx`.
 * @param {number} idx
 */
function openAnnotationEditor(idx) {
  const backdrop = ensureEditor();
  const textarea = /** @type {HTMLTextAreaElement} */ (backdrop.querySelector('.annotation-editor-input'));
  const deleteBtn = /** @type {HTMLButtonElement} */ (backdrop.querySelector('.annotation-editor-delete'));
  const saveBtn = /** @type {HTMLButtonElement} */ (backdrop.querySelector('.annotation-editor-save'));
  const cancelBtn = /** @type {HTMLButtonElement} */ (backdrop.querySelector('.annotation-editor-cancel'));

  const existing = loadAnnotations(annotationKey)[idx] || '';
  textarea.value = existing;
  deleteBtn.style.display = existing ? '' : 'none';
  backdrop.style.display = 'flex';
  setTimeout(() => textarea.focus(), 0);

  const close = () => {
    backdrop.style.display = 'none';
    if (editorCleanup) editorCleanup();
    editorCleanup = null;
  };
  const save = () => {
    commitAnnotation(idx, textarea.value);
    close();
  };
  const remove = () => {
    commitAnnotation(idx, '');
    close();
  };
  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  };
  /** @param {Event} e */
  const onBackdrop = (e) => {
    if (e.target === backdrop) close();
  };

  saveBtn.addEventListener('click', save);
  deleteBtn.addEventListener('click', remove);
  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('mousedown', onBackdrop);
  document.addEventListener('keydown', onKey);

  editorCleanup = () => {
    saveBtn.removeEventListener('click', save);
    deleteBtn.removeEventListener('click', remove);
    cancelBtn.removeEventListener('click', close);
    backdrop.removeEventListener('mousedown', onBackdrop);
    document.removeEventListener('keydown', onKey);
  };
}

// ===========================
// Annotations panel (list)
// ===========================

/**
 * Scroll to the annotated block and briefly flash it.
 * @param {number} idx
 */
function jumpToAnnotation(idx) {
  const el = /** @type {HTMLElement | null} */ (annotatedElement(idx));
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('annotation-flash');
  setTimeout(() => el.classList.remove('annotation-flash'), 1200);
}

/**
 * Render the annotations side panel (one row per note, in document order) and
 * sync the toolbar toggle's visibility + count.
 */
export function renderAnnotationPanel() {
  const list = document.getElementById('annotation-list');
  const toggle = document.getElementById('annotation-list-toggle');
  const annotations = loadAnnotations(annotationKey);
  const indexes = Object.keys(annotations)
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  if (toggle) {
    toggle.style.display = indexes.length ? '' : 'none';
    const count = toggle.querySelector('.annotation-list-count');
    if (count) count.textContent = String(indexes.length);
  }

  // An open-but-now-empty panel should close itself.
  if (indexes.length === 0) {
    const panel = document.getElementById('annotation-panel');
    if (panel) {
      panel.style.display = 'none';
      panel.classList.remove('open');
    }
    if (toggle) toggle.classList.remove('active');
  }

  if (!list) return;
  list.innerHTML = '';
  for (const idx of indexes) {
    const el = annotatedElement(idx);
    let snippet = '';
    if (el) {
      // Read the block's text without the appended ✎ badge.
      const clone = /** @type {HTMLElement} */ (el.cloneNode(true));
      clone.querySelectorAll('.annotation-badge').forEach((b) => b.remove());
      snippet = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    }

    const li = document.createElement('li');
    li.className = 'annotation-list-item';

    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'annotation-list-jump';
    const note = document.createElement('span');
    note.className = 'annotation-list-note';
    note.textContent = annotations[idx];
    const ctx = document.createElement('span');
    ctx.className = 'annotation-list-context';
    ctx.textContent = snippet || '(text not found)';
    jump.append(note, ctx);
    jump.addEventListener('click', () => jumpToAnnotation(idx));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'annotation-list-edit';
    edit.title = 'Edit note';
    edit.setAttribute('aria-label', 'Edit note');
    edit.textContent = '✎';
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      openAnnotationEditor(idx);
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'annotation-list-delete';
    del.title = 'Delete note';
    del.setAttribute('aria-label', 'Delete note');
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      commitAnnotation(idx, '');
    });

    li.append(jump, edit, del);
    list.appendChild(li);
  }
}

/** Show/hide the annotations panel. */
export function toggleAnnotationPanel() {
  const panel = document.getElementById('annotation-panel');
  if (!panel) return;
  const toggle = document.getElementById('annotation-list-toggle');
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    panel.style.display = 'none';
    if (toggle) toggle.classList.remove('active');
  } else {
    renderAnnotationPanel();
    panel.classList.add('open');
    panel.style.display = '';
    if (toggle) toggle.classList.add('active');
  }
}

/** Open the annotations panel (idempotent). */
export function openAnnotationPanel() {
  const panel = document.getElementById('annotation-panel');
  if (!panel) return;
  renderAnnotationPanel();
  panel.classList.add('open');
  panel.style.display = '';
  const toggle = document.getElementById('annotation-list-toggle');
  if (toggle) toggle.classList.add('active');
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
