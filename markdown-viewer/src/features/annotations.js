// @ts-check
// Sticky-note annotations stored in localStorage, keyed by filename. Users
// double-click any paragraph/heading to add a note. State is private to this
// module.
//
// Durable anchoring (store schema v2): each note records a content
// *fingerprint* (hash of the block's normalized text) plus a heading-path hash
// and an occurrence ordinal, with the positional block index kept only as a
// last-resort fallback. So a note follows its block when the document is edited
// or reordered, instead of drifting with a raw index. Legacy v1 stores
// (`{ file: { idx: text } }`) are read transparently and upgraded in place the
// first time their blocks resolve.

import { showToast } from './toast.js';

const ANNOTATIONS_KEY = 'specdown-annotations';
const STORE_VERSION = 2;

/** @typedef {{ fp: string, path: string, ordinal: number }} Anchor */
/** @typedef {{ id: string, text: string, anchor: Anchor | null, legacyIdx: number }} Note */
/** @typedef {{ version: number, files: Record<string, Note[]> }} Store */
/** @typedef {{ root: HTMLElement, blocks: Element[], fps: string[], byFp: Map<string, number[]> }} BlockContext */

let annotationMode = false;
let annotationKey = '';
let annNoteSeq = 0;

const content = () => document.getElementById('markdown-content');

// All block types a note can attach to. Rendering and the double-click handlers
// index by this exact selector, so element positions line up.
const ANNOTATABLE_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote';

// ===========================
// Hashing + ids
// ===========================
/**
 * FNV-1a 32-bit hash → base36. Small + stable; collisions are tolerable because
 * the heading-path + ordinal disambiguate and the index is a final fallback.
 * @param {string} str
 */
function annHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return (h >>> 0).toString(36);
}

function annNoteId() {
  annNoteSeq += 1;
  return `an-${Date.now().toString(36)}-${annNoteSeq}`;
}

/**
 * A block's text with whitespace collapsed and any appended badge removed —
 * the basis for its content fingerprint.
 * @param {Element} element
 */
function annBlockText(element) {
  const clone = /** @type {Element} */ (element.cloneNode(true));
  clone.querySelectorAll('.annotation-badge').forEach((b) => b.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * The trail of enclosing headings above an element (e.g. "Intro / Setup"),
 * hashed by the caller. Disambiguates blocks that share identical text.
 * @param {Element} target
 * @param {Element} root
 */
function annHeadingTrail(target, root) {
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  /** @type {{ level: number, text: string }[]} */
  const stack = [];
  for (const h of headings) {
    if (h === target) break;
    // Only headings positioned before the target contribute to its path.
    if (!(target.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
    const level = Number(h.tagName.charAt(1));
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({ level, text: annBlockText(h) });
  }
  return stack.map((s) => s.text).join(' / ');
}

// ===========================
// Block context + anchoring
// ===========================
/**
 * Snapshot the annotatable blocks once per operation: assign positional
 * `data-annot-idx`, fingerprint each, and bucket indices by fingerprint.
 * @param {Element} root
 * @returns {BlockContext}
 */
function annContext(root) {
  const blocks = Array.from(root.querySelectorAll(ANNOTATABLE_SELECTOR));
  /** @type {string[]} */
  const fps = [];
  /** @type {Map<string, number[]>} */
  const byFp = new Map();
  blocks.forEach((element, idx) => {
    element.setAttribute('data-annot-idx', String(idx));
    const fp = annHash(annBlockText(element));
    fps[idx] = fp;
    const bucket = byFp.get(fp);
    if (bucket) bucket.push(idx);
    else byFp.set(fp, [idx]);
  });
  return { root: /** @type {HTMLElement} */ (root), blocks, fps, byFp };
}

/**
 * Build the durable anchor for the block at `idx`.
 * @param {BlockContext} ctx
 * @param {number} idx
 * @returns {Anchor}
 */
function annAnchorFor(ctx, idx) {
  const fp = ctx.fps[idx];
  const bucket = ctx.byFp.get(fp) || [idx];
  return {
    fp,
    path: annHash(annHeadingTrail(ctx.blocks[idx], ctx.root)),
    ordinal: Math.max(0, bucket.indexOf(idx)),
  };
}

/**
 * Resolve a note to a block index using its anchor, degrading gracefully:
 *  - 'fp'       matched by fingerprint (durable hit)
 *  - 'legacy'   no anchor yet (v1 note) → positioned by stored index
 *  - 'fallback' had an anchor but the text changed → best-guess by index
 *  - 'missing'  could not resolve to any block
 * @param {BlockContext} ctx
 * @param {Note} note
 * @returns {{ idx: number, reason: 'fp' | 'legacy' | 'fallback' | 'missing' }}
 */
function annResolve(ctx, note) {
  const a = note.anchor;
  if (a && a.fp) {
    const bucket = ctx.byFp.get(a.fp);
    if (bucket && bucket.length) {
      if (bucket.length === 1) return { idx: bucket[0], reason: 'fp' };
      // Several blocks share the text — narrow by heading path, then ordinal.
      const pathMatches = bucket.filter(
        (i) => annHash(annHeadingTrail(ctx.blocks[i], ctx.root)) === a.path
      );
      const pool = pathMatches.length ? pathMatches : bucket;
      if (typeof a.ordinal === 'number' && a.ordinal >= 0 && a.ordinal < pool.length) {
        return { idx: pool[a.ordinal], reason: 'fp' };
      }
      return { idx: pool[0], reason: 'fp' };
    }
    // Anchor existed but the fingerprint is gone — the block's text was edited.
    if (annValidIdx(ctx, note.legacyIdx)) return { idx: note.legacyIdx, reason: 'fallback' };
    return { idx: -1, reason: 'missing' };
  }
  // v1 note (no anchor): position it, then renderAnnotations upgrades it.
  if (annValidIdx(ctx, note.legacyIdx)) return { idx: note.legacyIdx, reason: 'legacy' };
  return { idx: -1, reason: 'missing' };
}

/**
 * @param {BlockContext} ctx
 * @param {number} idx
 */
function annValidIdx(ctx, idx) {
  return typeof idx === 'number' && idx >= 0 && idx < ctx.blocks.length;
}

// ===========================
// Storage (schema v2 + v1 migration)
// ===========================
/**
 * Read the whole annotation store, transparently migrating a legacy v1 map to
 * the v2 shape in memory (persisted on the next write).
 * @returns {Store}
 */
function annReadStore() {
  let raw;
  try {
    raw = localStorage.getItem(ANNOTATIONS_KEY);
  } catch {
    return { version: STORE_VERSION, files: {} };
  }
  if (!raw) return { version: STORE_VERSION, files: {} };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { version: STORE_VERSION, files: {} };
  }
  if (parsed && parsed.version === STORE_VERSION && parsed.files && typeof parsed.files === 'object') {
    return /** @type {Store} */ (parsed);
  }
  return annMigrate(parsed);
}

/**
 * Convert a legacy v1 store (`{ file: { idx: text } }`) to v2.
 * @param {any} parsed
 * @returns {Store}
 */
function annMigrate(parsed) {
  /** @type {Store} */
  const store = { version: STORE_VERSION, files: {} };
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [file, notes] of Object.entries(parsed)) {
      if (!notes || typeof notes !== 'object') continue;
      const arr = annLegacyToNotes(/** @type {Record<string, string>} */ (notes));
      if (arr.length) store.files[file] = arr;
    }
  }
  return store;
}

/**
 * @param {Record<string, string>} obj v1 `{ idx: text }`
 * @returns {Note[]}
 */
function annLegacyToNotes(obj) {
  /** @type {Note[]} */
  const out = [];
  for (const [idx, text] of Object.entries(obj)) {
    const n = Number(idx);
    const t = String(text || '');
    if (Number.isNaN(n) || !t) continue;
    out.push({ id: annNoteId(), text: t, anchor: null, legacyIdx: n });
  }
  out.sort((a, b) => a.legacyIdx - b.legacyIdx);
  return out;
}

/** @param {Store} store */
function annWriteStore(store) {
  try {
    /** @type {Record<string, Note[]>} */
    const files = {};
    for (const [file, notes] of Object.entries(store.files || {})) {
      if (Array.isArray(notes) && notes.length) files[file] = notes;
    }
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ version: STORE_VERSION, files }));
  } catch {
    // localStorage quota exceeded — silently ignore.
  }
}

/**
 * @param {string} key
 * @returns {Note[]}
 */
function annFileNotes(key) {
  const store = annReadStore();
  return Array.isArray(store.files[key]) ? store.files[key] : [];
}

/**
 * @param {string} key
 * @param {Note[]} notes
 */
function annPutFileNotes(key, notes) {
  const store = annReadStore();
  if (!notes || notes.length === 0) delete store.files[key];
  else store.files[key] = notes;
  annWriteStore(store);
}

// ===========================
// Export / import
// ===========================
/** Pretty-printed JSON of the entire annotation store (v2). */
export function getAnnotationsJSON() {
  return JSON.stringify(annReadStore(), null, 2);
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
 * @param {any} raw
 * @returns {Note | null}
 */
function annNormalizeImportedNote(raw) {
  if (!raw || typeof raw.text !== 'string' || !raw.text) return null;
  const anchor =
    raw.anchor && typeof raw.anchor.fp === 'string'
      ? {
          fp: String(raw.anchor.fp),
          path: String(raw.anchor.path || ''),
          ordinal: Number(raw.anchor.ordinal) || 0,
        }
      : null;
  return {
    id: typeof raw.id === 'string' ? raw.id : annNoteId(),
    text: raw.text,
    anchor,
    legacyIdx: Number.isFinite(raw.legacyIdx) ? Number(raw.legacyIdx) : -1,
  };
}

/**
 * @param {Note} a
 * @param {Note} b
 */
function annSameNote(a, b) {
  if (a.text !== b.text) return false;
  if (a.anchor && b.anchor) return a.anchor.fp === b.anchor.fp && a.anchor.ordinal === b.anchor.ordinal;
  return a.legacyIdx === b.legacyIdx;
}

/**
 * Merge imported annotations into the store. Accepts both v2 (`{ version, files }`)
 * and legacy v1 (`{ file: { idx: text } }`) payloads. Existing notes are kept;
 * incoming notes are appended unless an exact duplicate already exists.
 * @param {string} jsonText
 * @returns {boolean}
 */
export function importAnnotations(jsonText) {
  let incoming;
  try {
    incoming = JSON.parse(jsonText);
  } catch {
    showToast('Import failed: the file is not valid JSON.', { type: 'error' });
    return false;
  }
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    showToast('Import failed: unexpected annotations format.', { type: 'error' });
    return false;
  }

  const incomingFiles =
    incoming.version === STORE_VERSION && incoming.files && typeof incoming.files === 'object'
      ? incoming.files
      : annMigrate(incoming).files;

  const store = annReadStore();
  let fileCount = 0;
  for (const [file, notes] of Object.entries(incomingFiles)) {
    if (!Array.isArray(notes)) continue;
    const merged = Array.isArray(store.files[file]) ? store.files[file].slice() : [];
    for (const candidate of notes) {
      const note = annNormalizeImportedNote(candidate);
      if (!note) continue;
      if (!merged.some((m) => annSameNote(m, note))) merged.push(note);
    }
    store.files[file] = merged;
    fileCount += 1;
  }

  try {
    annWriteStore(store);
  } catch {
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

// ===========================
// Mode toggle + handlers
// ===========================
/**
 * Toggle annotation mode. Callers handle any platform chrome sync (e.g. the iOS
 * action bar) after toggling.
 */
export function toggleAnnotationMode() {
  annotationMode = !annotationMode;
  const btn = document.getElementById('annotation-toggle');
  if (btn) btn.classList.toggle('active', annotationMode);

  if (annotationMode && annotationKey) {
    attachAnnotationHandlers();
    showToast('Annotation mode on — double-click any paragraph or heading to add a note.', {
      type: 'info',
    });
  } else {
    detachAnnotationHandlers();
  }
}

function attachAnnotationHandlers() {
  const root = content();
  if (!root) return;
  const blocks = Array.from(root.querySelectorAll(ANNOTATABLE_SELECTOR));
  blocks.forEach((element, idx) => {
    element.setAttribute('data-annot-idx', String(idx));
    element.classList.add('annotatable');
    element.addEventListener('dblclick', handleAnnotationDblClick);
  });
}

function detachAnnotationHandlers() {
  const root = content();
  if (!root) return;
  root.querySelectorAll('.annotatable').forEach((element) => {
    element.removeEventListener('dblclick', handleAnnotationDblClick);
    element.classList.remove('annotatable');
  });
}

/** @param {Event} e */
function handleAnnotationDblClick(e) {
  if (!annotationMode) return;
  const element = /** @type {HTMLElement} */ (e.currentTarget);
  const id = element.getAttribute('data-annot-id');
  if (id) openAnnotationEditor({ id });
  else openAnnotationEditor({ element });
}

// ===========================
// Rendering
// ===========================
/**
 * Render saved annotation badges for a document, keyed by filename.
 * @param {string} key
 */
export function renderAnnotations(key) {
  const root = content();
  annotationKey = key;
  if (!root) return;

  root.querySelectorAll('.annotation-badge').forEach((b) => b.remove());
  root.querySelectorAll('[data-annot-id]').forEach((element) => {
    element.removeAttribute('data-annot-id');
    element.classList.remove('has-annotation', 'annotation-orphaned');
  });

  const ctx = annContext(root);
  const notes = annFileNotes(key);
  let dirty = false;

  for (const note of notes) {
    const { idx, reason } = annResolve(ctx, note);
    if (idx < 0) continue;
    // Upgrade a v1 note to a durable anchor, and keep the positional fallback
    // current whenever the fingerprint relocates the note.
    if (reason === 'legacy') {
      note.anchor = annAnchorFor(ctx, idx);
      note.legacyIdx = idx;
      dirty = true;
    } else if (reason === 'fp' && note.legacyIdx !== idx) {
      note.legacyIdx = idx;
      dirty = true;
    }
    attachAnnotationBadge(ctx.blocks[idx], note, reason === 'fallback');
  }

  if (dirty) annPutFileNotes(key, notes);
  if (annotationMode) attachAnnotationHandlers();
  renderAnnotationPanel();
}

/**
 * @param {Element} element
 * @param {Note} note
 * @param {boolean} orphaned The text changed; this is a best-guess location.
 */
function attachAnnotationBadge(element, note, orphaned) {
  const existing = element.querySelector('.annotation-badge');
  if (existing) existing.remove();

  element.setAttribute('data-annot-id', note.id);
  element.classList.add('has-annotation');
  element.classList.toggle('annotation-orphaned', orphaned);

  const badge = document.createElement('span');
  badge.className = 'annotation-badge' + (orphaned ? ' annotation-badge-orphaned' : '');
  badge.title = orphaned
    ? `${note.text}\n(the anchored text changed — best-guess location)`
    : note.text;
  badge.textContent = '✎';
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    showAnnotationPopover(badge, note.text);
  });
  element.appendChild(badge);
}

// ===========================
// In-app note editor
// ===========================
// Replaces window.prompt(), which the native shells don't implement. A small
// modal works on every surface.

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
 * Open the note editor for an existing note (`{ id }`) or a new note on a block
 * (`{ element }`).
 * @param {{ id?: string, element?: HTMLElement }} target
 */
function openAnnotationEditor(target) {
  const backdrop = ensureEditor();
  const textarea = /** @type {HTMLTextAreaElement} */ (backdrop.querySelector('.annotation-editor-input'));
  const deleteBtn = /** @type {HTMLButtonElement} */ (backdrop.querySelector('.annotation-editor-delete'));
  const saveBtn = /** @type {HTMLButtonElement} */ (backdrop.querySelector('.annotation-editor-save'));
  const cancelBtn = /** @type {HTMLButtonElement} */ (backdrop.querySelector('.annotation-editor-cancel'));

  const existing = target.id ? annFileNotes(annotationKey).find((n) => n.id === target.id) : null;
  textarea.value = existing ? existing.text : '';
  deleteBtn.style.display = existing ? '' : 'none';
  backdrop.style.display = 'flex';
  setTimeout(() => textarea.focus(), 0);

  const close = () => {
    backdrop.style.display = 'none';
    if (editorCleanup) editorCleanup();
    editorCleanup = null;
  };
  const save = () => {
    commitAnnotation(target, textarea.value);
    close();
  };
  const remove = () => {
    commitAnnotation(target, '');
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

/**
 * Add / edit / remove a note, then re-render badges + panel.
 * @param {{ id?: string, element?: HTMLElement }} target
 * @param {string} rawText
 */
function commitAnnotation(target, rawText) {
  const text = String(rawText || '').trim();
  const notes = annFileNotes(annotationKey);

  if (target.id) {
    const note = notes.find((n) => n.id === target.id);
    if (!note) return;
    if (!text) {
      notes.splice(notes.indexOf(note), 1);
    } else {
      note.text = text;
    }
  } else if (target.element && text) {
    const root = content();
    const ctx = root ? annContext(root) : null;
    const idx = ctx ? ctx.blocks.indexOf(target.element) : -1;
    notes.push({
      id: annNoteId(),
      text,
      anchor: ctx && idx >= 0 ? annAnchorFor(ctx, idx) : null,
      legacyIdx: idx,
    });
  }

  annPutFileNotes(annotationKey, notes);
  renderAnnotations(annotationKey);
}

// ===========================
// Annotations panel (list)
// ===========================
/**
 * Scroll to a note's block and briefly flash it.
 * @param {string} id
 */
function jumpToAnnotation(id) {
  const root = content();
  if (!root) return;
  const ctx = annContext(root);
  const note = annFileNotes(annotationKey).find((n) => n.id === id);
  if (!note) return;
  const { idx } = annResolve(ctx, note);
  if (idx < 0) return;
  const target = /** @type {HTMLElement} */ (ctx.blocks[idx]);
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('annotation-flash');
  setTimeout(() => target.classList.remove('annotation-flash'), 1200);
}

/**
 * Render the annotations side panel (one row per note, in document order) and
 * sync the toolbar toggle's visibility + count.
 */
export function renderAnnotationPanel() {
  const list = document.getElementById('annotation-list');
  const toggle = document.getElementById('annotation-list-toggle');
  const root = content();
  const notes = annFileNotes(annotationKey);
  const ctx = root ? annContext(root) : null;

  if (toggle) {
    toggle.style.display = notes.length ? '' : 'none';
    const count = toggle.querySelector('.annotation-list-count');
    if (count) count.textContent = String(notes.length);
  }

  // An open-but-now-empty panel should close itself.
  if (notes.length === 0) {
    const panel = document.getElementById('annotation-panel');
    if (panel) {
      panel.style.display = 'none';
      panel.classList.remove('open');
    }
    if (toggle) toggle.classList.remove('active');
  }

  if (!list) return;
  list.innerHTML = '';

  // Resolve each note to a block, then order rows by document position
  // (unresolved notes sink to the bottom).
  const rows = notes.map((note) => {
    const r = ctx ? annResolve(ctx, note) : { idx: -1, reason: /** @type {const} */ ('missing') };
    return { note, idx: r.idx, reason: r.reason };
  });
  rows.sort((a, b) => (a.idx < 0 ? Infinity : a.idx) - (b.idx < 0 ? Infinity : b.idx));

  for (const row of rows) {
    const { note, idx, reason } = row;
    let snippet = '';
    if (ctx && idx >= 0) snippet = annBlockText(ctx.blocks[idx]).slice(0, 80);

    const li = document.createElement('li');
    li.className = 'annotation-list-item';

    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'annotation-list-jump';
    const note_ = document.createElement('span');
    note_.className = 'annotation-list-note';
    note_.textContent = note.text;
    const ctxEl = document.createElement('span');
    ctxEl.className = 'annotation-list-context';
    ctxEl.textContent = snippet || (reason === 'missing' ? '(text not found)' : '(moved or edited)');
    if (reason === 'fallback' || reason === 'missing') ctxEl.classList.add('annotation-list-context-orphaned');
    jump.append(note_, ctxEl);
    jump.addEventListener('click', () => jumpToAnnotation(note.id));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'annotation-list-edit';
    edit.title = 'Edit note';
    edit.setAttribute('aria-label', 'Edit note');
    edit.textContent = '✎';
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      openAnnotationEditor({ id: note.id });
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'annotation-list-delete';
    del.title = 'Delete note';
    del.setAttribute('aria-label', 'Delete note');
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      commitAnnotation({ id: note.id }, '');
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
