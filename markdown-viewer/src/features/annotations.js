// @ts-check
import { documentByteLength } from '../core/document-limits.js';
import { state } from '../core/state.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
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
/** @typedef {{ version: number, files: Record<string, Note[]> } & Record<string, unknown>} Store */
/** @typedef {{ status: 'missing' | 'valid', raw: string | null, store: Store } | { status: 'corrupt' | 'unsupported' | 'unavailable', raw: string | null, store: null }} AnnotationStoreRead */
/** @typedef {{ root: HTMLElement, blocks: Element[], fps: string[], headingPaths: string[], byFp: Map<string, number[]> }} BlockContext */
/** @typedef {{ key: string, document: import('../core/document-context.js').DocumentContext }} AnnotationContext */

let annotationMode = false;
let annotationKey = '';
/** @type {AnnotationContext | null} */
let annDocumentContext = null;
let annNoteSeq = 0;
const ANN_MAX_BYTES = 2 * 1024 * 1024;
const ANN_MAX_DOCUMENTS = 100;
const ANN_MAX_NOTES = 500;
const ANN_MAX_TOTAL_NOTES = 2000;
const ANN_MAX_TEXT = 16384;
/** @type {HTMLElement | null} */
let annEditorBackdrop = null;
let annReportedStoreProblem = '';

const content = () => document.getElementById('markdown-content');

/** @param {AnnotationContext | null} context */
function annIsContextCurrent(context) {
  return (
    !!context &&
    context.key === annotationKey &&
    isDocumentContextCurrent(context.document) &&
    state.currentViewMode === 'preview'
  );
}

function annRejectChangedContext() {
  showToast(
    'The document changed. No notes were changed; any open draft has been kept. Reopen the note before editing.',
    { type: 'warning' }
  );
}

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
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = '';
  let node;
  while ((node = walker.nextNode()) && text.length < ANN_MAX_TEXT) {
    if (node.parentElement?.closest('.annotation-badge')) continue;
    text += (node.textContent || '').slice(0, ANN_MAX_TEXT - text.length);
  }
  return text.replace(/\s+/g, ' ').trim();
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
  const blocks = Array.from(root.querySelectorAll(ANNOTATABLE_SELECTOR)).slice(
    0,
    5000
  );
  /** @type {string[]} */
  const fps = [];
  /** @type {string[]} */
  const headingPaths = [];
  /** @type {{level: number, text: string}[]} */
  const annHeadingStack = [];
  /** @type {Map<string, number[]>} */
  const byFp = new Map();
  blocks.forEach((element, idx) => {
    element.setAttribute('data-annot-idx', String(idx));
    const blockText = annBlockText(element);
    headingPaths[idx] = annHash(
      annHeadingStack.map((heading) => heading.text).join(' / ')
    );
    if (/^H[1-6]$/.test(element.tagName)) {
      const level = Number(element.tagName.charAt(1));
      while (
        annHeadingStack.length &&
        annHeadingStack[annHeadingStack.length - 1].level >= level
      )
        annHeadingStack.pop();
      annHeadingStack.push({ level, text: blockText.slice(0, 512) });
    }
    const fp = annHash(blockText);
    fps[idx] = fp;
    const bucket = byFp.get(fp);
    if (bucket) bucket.push(idx);
    else byFp.set(fp, [idx]);
  });
  return {
    root: /** @type {HTMLElement} */ (root),
    blocks,
    fps,
    headingPaths,
    byFp,
  };
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
    path: ctx.headingPaths[idx],
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
      const pathMatches = bucket.filter((i) => ctx.headingPaths[i] === a.path);
      const pool = pathMatches.length ? pathMatches : bucket;
      if (
        typeof a.ordinal === 'number' &&
        a.ordinal >= 0 &&
        a.ordinal < pool.length
      ) {
        return { idx: pool[a.ordinal], reason: 'fp' };
      }
      return { idx: pool[0], reason: 'fp' };
    }
    // Anchor existed but the fingerprint is gone — the block's text was edited.
    if (annValidIdx(ctx, note.legacyIdx))
      return { idx: note.legacyIdx, reason: 'fallback' };
    return { idx: -1, reason: 'missing' };
  }
  // v1 note (no anchor): position it, then renderAnnotations upgrades it.
  if (annValidIdx(ctx, note.legacyIdx))
    return { idx: note.legacyIdx, reason: 'legacy' };
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
 * Read without confusing missing data with data this version cannot safely
 * update. Keep the original bytes available for backup, including bad JSON.
 * @returns {AnnotationStoreRead}
 */
function annReadStore() {
  let raw;
  try {
    raw = localStorage.getItem(ANNOTATIONS_KEY);
  } catch {
    return { status: 'unavailable', raw: null, store: null };
  }
  if (raw === null)
    return {
      status: 'missing',
      raw,
      store: { version: STORE_VERSION, files: Object.create(null) },
    };
  return annDecodeStore(raw);
}

/** @param {any} value @returns {value is Record<string, any>} */
function annIsRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Validate shape only: existing stores may predate today's import limits.
 * @param {any} note
 * @param {boolean} [importing]
 */
function annIsNote(note, importing = false) {
  if (!annIsRecord(note) || typeof note.text !== 'string') return false;
  if (!(typeof note.id === 'string' || (importing && note.id === undefined)))
    return false;
  if (!(
    (Number.isSafeInteger(note.legacyIdx) && note.legacyIdx >= -1) ||
    (importing && note.legacyIdx === undefined)
  ))
    return false;
  const anchor = note.anchor;
  return (
    anchor === null ||
    (importing && anchor === undefined) ||
    (annIsRecord(anchor) &&
      typeof anchor.fp === 'string' &&
      (typeof anchor.path === 'string' ||
        (importing && anchor.path === undefined)) &&
      ((Number.isSafeInteger(anchor.ordinal) && anchor.ordinal >= 0) ||
        (importing && anchor.ordinal === undefined)))
  );
}

/** @param {string} raw @param {boolean} [importing] @returns {AnnotationStoreRead} */
function annDecodeStore(raw, importing = false) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', raw, store: null };
  }
  if (!annIsRecord(parsed)) return { status: 'corrupt', raw, store: null };
  if (Object.hasOwn(parsed, 'version')) {
    if (parsed.version !== STORE_VERSION)
      return { status: 'unsupported', raw, store: null };
    if (
      !annIsRecord(parsed.files) ||
      !Object.values(parsed.files).every(
        (notes) =>
          Array.isArray(notes) &&
          notes.every((note) => annIsNote(note, importing))
      )
    )
      return { status: 'corrupt', raw, store: null };
    return {
      status: 'valid',
      raw,
      store: {
        ...parsed,
        version: STORE_VERSION,
        files: Object.assign(Object.create(null), parsed.files),
      },
    };
  }
  // Only an actual v1 map may migrate. Unknown or malformed shapes must not
  // become an empty writable store or lose individual entries during migration.
  if (
    !Object.values(parsed).every(
      (notes) =>
        annIsRecord(notes) &&
        Object.entries(notes).every(
          ([idx, text]) =>
            /^\d+$/.test(idx) &&
            Number.isSafeInteger(Number(idx)) &&
            typeof text === 'string'
        )
    )
  )
    return { status: 'corrupt', raw, store: null };
  return { status: 'valid', raw, store: annMigrate(parsed) };
}

/** @param {AnnotationStoreRead['status']} status */
function annStoreProblemMessage(status) {
  if (status === 'unavailable')
    return 'Saved notes are unavailable. Saving and importing are paused until storage access returns.';
  if (status === 'unsupported')
    return 'Saved notes use an unsupported format. They have not been changed. Export a backup before recovery.';
  return 'Saved notes could not be read. They have not been changed. Export a backup before recovery.';
}

/** @param {AnnotationStoreRead} result */
function annReportStoreProblem(result) {
  if (result.store) {
    annReportedStoreProblem = '';
  } else if (annReportedStoreProblem !== result.status) {
    annReportedStoreProblem = result.status;
    showToast(annStoreProblemMessage(result.status), { type: 'error' });
  }
}

/**
 * Convert a legacy v1 store (`{ file: { idx: text } }`) to v2.
 * @param {any} parsed
 * @returns {Store}
 */
function annMigrate(parsed) {
  /** @type {Store} */
  const store = { version: STORE_VERSION, files: Object.create(null) };
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [file, notes] of Object.entries(parsed)) {
      if (!notes || typeof notes !== 'object') continue;
      const arr = annLegacyToNotes(
        /** @type {Record<string, string>} */ (notes)
      );
      store.files[file] = arr;
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
    out.push({ id: annNoteId(), text, anchor: null, legacyIdx: n });
  }
  out.sort((a, b) => a.legacyIdx - b.legacyIdx);
  return out;
}

/** @param {Store} store */
function annWriteStore(store) {
  // Recheck at the persistence boundary too: no caller may overwrite a store
  // whose current contents are unreadable or from a different schema.
  if (!annReadStore().store) return false;
  try {
    const raw = JSON.stringify(store);
    if (!annDecodeStore(raw).store) return false;
    localStorage.setItem(ANNOTATIONS_KEY, raw);
  } catch {
    return false;
  }
  return true;
}

/**
 * @param {string} key
 * @returns {Note[]}
 */
function annFileNotes(key) {
  const result = annReadStore();
  annReportStoreProblem(result);
  if (!result.store) return [];
  const store = result.store;
  // Never truncate the persistence model: older versions allowed larger
  // collections, which must survive edits and anchor migration intact.
  return Object.hasOwn(store.files, key) ? store.files[key] : [];
}

/**
 * @param {string} key
 * @param {Note[]} notes
 */
function annPutFileNotes(key, notes) {
  const result = annReadStore();
  annReportStoreProblem(result);
  if (!result.store) return false;
  const store = result.store;
  if (!notes || notes.length === 0) delete store.files[key];
  else store.files[key] = notes;
  return annWriteStore(store);
}

// ===========================
// Export / import
// ===========================
/** Exact stored bytes for recovery, even for a corrupt or future-format store.
 * A missing store has an empty v2 backup; inaccessible storage must throw.
 */
export function getAnnotationsJSON() {
  const raw = localStorage.getItem(ANNOTATIONS_KEY);
  return raw === null
    ? JSON.stringify({ version: STORE_VERSION, files: {} }, null, 2)
    : raw;
}

/** Download all annotations as a JSON file. */
export function exportAnnotations() {
  let json;
  try {
    json = getAnnotationsJSON();
  } catch {
    showToast(
      'Could not access saved notes. No backup was created; try exporting again when storage access returns.',
      { type: 'error' }
    );
    return;
  }
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
 * @returns {Note}
 */
function annNormalizeImportedNote(raw) {
  if (!annIsNote(raw, true))
    throw new Error('An annotation has an invalid format.');
  if (
    raw.text.length > ANN_MAX_TEXT ||
    String(raw.id || '').length > 256 ||
    String(raw.anchor?.fp || '').length > 256 ||
    String(raw.anchor?.path || '').length > 1024
  ) {
    throw new Error('An annotation field exceeds the supported length.');
  }
  const anchor =
    raw.anchor && typeof raw.anchor.fp === 'string'
      ? {
          ...raw.anchor,
          fp: String(raw.anchor.fp),
          path: String(raw.anchor.path || ''),
          ordinal: Number(raw.anchor.ordinal) || 0,
        }
      : null;
  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : annNoteId(),
    text: raw.text,
    anchor,
    legacyIdx: Number.isFinite(raw.legacyIdx) ? Number(raw.legacyIdx) : -1,
  };
}

/** Extra fields must not disappear when the existing duplicate rules apply.
 * @param {any} note
 */
function annNoteExtensions(note) {
  const fields = Object.entries(note)
    .filter(([key]) => !['id', 'text', 'anchor', 'legacyIdx'].includes(key))
    .sort(([left], [right]) => left.localeCompare(right));
  const anchorFields = Object.entries(note.anchor || {})
    .filter(([key]) => !['fp', 'path', 'ordinal'].includes(key))
    .sort(([left], [right]) => left.localeCompare(right));
  return fields.length || anchorFields.length
    ? JSON.stringify([fields, anchorFields])
    : '';
}

/**
 * Merge imported annotations into the store. Accepts both v2 (`{ version, files }`)
 * and legacy v1 (`{ file: { idx: text } }`) payloads. Existing notes are kept;
 * incoming notes are appended unless an exact duplicate already exists.
 * @param {string} jsonText
 * @returns {boolean}
 */
export function importAnnotations(jsonText) {
  if (
    typeof jsonText !== 'string' ||
    jsonText.length > ANN_MAX_BYTES ||
    documentByteLength(jsonText) > ANN_MAX_BYTES
  ) {
    showToast(
      'Import failed: annotation backups must be no larger than 2 MiB.',
      { type: 'error' }
    );
    return false;
  }
  const incoming = annDecodeStore(jsonText, true);
  if (!incoming.store) {
    showToast(
      incoming.status === 'unsupported'
        ? 'Import failed: unsupported annotations version. The backup has not been changed.'
        : 'Import failed: unexpected annotations format or invalid JSON.',
      {
        type: 'error',
      }
    );
    return false;
  }

  const incomingFiles = incoming.store.files;
  const existing = annReadStore();
  if (!existing.store) {
    showToast('Import failed: ' + annStoreProblemMessage(existing.status), {
      type: 'error',
    });
    return false;
  }
  const store = existing.store;
  let fileCount = 0;
  try {
    // Preserve extension metadata rather than silently dropping it on import.
    // Conflicting metadata needs a newer recovery path, not a last-write win.
    for (const [key, value] of Object.entries(incoming.store)) {
      if (key === 'version' || key === 'files') continue;
      if (
        Object.hasOwn(store, key) &&
        JSON.stringify(store[key]) !== JSON.stringify(value)
      )
        throw new Error(
          'Backup metadata conflicts with saved notes. Existing data was not changed.'
        );
      Object.defineProperty(store, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    if (Object.keys(incomingFiles).length > ANN_MAX_DOCUMENTS)
      throw new Error('Too many documents in this backup.');
    for (const [file, notes] of Object.entries(incomingFiles)) {
      if (file.length > 1024 || notes.length > ANN_MAX_NOTES)
        throw new Error('Too many annotations or an overlong document name.');
      const merged =
        Object.hasOwn(store.files, file) && Array.isArray(store.files[file])
          ? store.files[file].slice()
          : [];
      /** @type {Map<string, Set<string>>} */
      const duplicates = new Map();
      const addKeys = (/** @type {Note} */ note) => {
        const keys = [JSON.stringify(['legacy', note.text, note.legacyIdx])];
        keys.push(
          note.anchor
            ? JSON.stringify([
                'anchor',
                note.text,
                note.anchor.fp,
                note.anchor.ordinal,
              ])
            : JSON.stringify(['unanchored', note.text, note.legacyIdx])
        );
        const metadata = annNoteExtensions(note);
        for (const key of keys) {
          if (!duplicates.has(key)) duplicates.set(key, new Set());
          duplicates.get(key)?.add(metadata);
        }
      };
      merged.forEach(addKeys);
      for (const candidate of notes) {
        const note = annNormalizeImportedNote(candidate);
        const keys = note.anchor
          ? [
              JSON.stringify([
                'anchor',
                note.text,
                note.anchor.fp,
                note.anchor.ordinal,
              ]),
              JSON.stringify(['unanchored', note.text, note.legacyIdx]),
            ]
          : [JSON.stringify(['legacy', note.text, note.legacyIdx])];
        const matches = keys.map((key) => duplicates.get(key));
        const duplicate = matches.some(Boolean);
        const metadata = annNoteExtensions(note);
        if (
          duplicate &&
          metadata &&
          !matches.some((match) => match?.has(metadata))
        )
          throw new Error(
            'An imported duplicate has additional or conflicting metadata. Existing notes were not changed.'
          );
        if (!duplicate) {
          merged.push(note);
          addKeys(note);
        }
      }
      if (merged.length > ANN_MAX_NOTES)
        throw new Error('A document can have at most 500 annotations.');
      Object.defineProperty(store.files, file, {
        value: merged,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      fileCount += 1;
    }
    const collections = Object.values(store.files);
    if (
      collections.length > ANN_MAX_DOCUMENTS ||
      collections.reduce((sum, notes) => sum + notes.length, 0) >
        ANN_MAX_TOTAL_NOTES ||
      documentByteLength(JSON.stringify(store)) > ANN_MAX_BYTES
    )
      throw new Error('The combined annotation collection exceeds its limit.');
    if (!annWriteStore(store))
      throw new Error(
        'Could not save the annotations. Existing data was not changed.'
      );
  } catch (error) {
    showToast(
      'Import failed: ' +
        (error instanceof Error ? error.message : 'invalid annotations.'),
      { type: 'error' }
    );
    return false;
  }

  if (annIsContextCurrent(annDocumentContext) && annDocumentContext)
    renderAnnotations(annotationKey, annDocumentContext.document);
  showToast(`Imported annotations for ${fileCount} document(s).`, {
    type: 'success',
  });
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
    if (file.size > ANN_MAX_BYTES) {
      showToast(
        'Import failed: annotation backups must be no larger than 2 MiB.',
        { type: 'error' }
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => importAnnotations(String(reader.result || ''));
    reader.onerror = () =>
      showToast('Could not read the file.', { type: 'error' });
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

  if (annotationMode && annIsContextCurrent(annDocumentContext)) {
    attachAnnotationHandlers();
    showToast(
      'Annotation mode on — double-click any paragraph or heading to add a note.',
      {
        type: 'info',
      }
    );
  } else {
    detachAnnotationHandlers();
  }
}

function attachAnnotationHandlers() {
  const root = content();
  if (!root) return;
  const blocks = Array.from(root.querySelectorAll(ANNOTATABLE_SELECTOR)).slice(
    0,
    5000
  );
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
 * @param {import('../core/document-context.js').DocumentContext} [documentContext]
 */
export function renderAnnotations(
  key,
  documentContext = captureDocumentContext()
) {
  if (
    !isDocumentContextCurrent(documentContext) ||
    state.currentViewMode !== 'preview'
  )
    return;
  const root = content();
  annotationKey = key;
  annDocumentContext = { key, document: documentContext };
  if (!root) return;

  root.querySelectorAll('.annotation-badge').forEach((b) => b.remove());
  root.querySelectorAll('[data-annot-id]').forEach((element) => {
    element.removeAttribute('data-annot-id');
    element.classList.remove('has-annotation', 'annotation-orphaned');
  });

  const storedNotes = annFileNotes(key);
  const notes = storedNotes.slice(0, ANN_MAX_NOTES);
  if (notes.length === 0 && !annotationMode) {
    renderAnnotationPanel();
    return;
  }
  const ctx = annContext(root);
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

  if (dirty) annPutFileNotes(key, storedNotes);
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
  badge.className =
    'annotation-badge' + (orphaned ? ' annotation-badge-orphaned' : '');
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
  if (annEditorBackdrop?.isConnected) return annEditorBackdrop;
  const backdrop = document.createElement('div');
  annEditorBackdrop = backdrop;
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
 * @param {AnnotationContext | null} [context]
 */
function openAnnotationEditor(target, context = annDocumentContext) {
  if (
    !annIsContextCurrent(context) ||
    (target.element && !content()?.contains(target.element))
  ) {
    annRejectChangedContext();
    return;
  }
  if (editorCleanup) {
    showToast(
      'Finish or cancel the open note before editing another. Your draft has been kept.',
      { type: 'warning' }
    );
    return;
  }
  const result = annReadStore();
  annReportStoreProblem(result);
  if (!result.store) return;
  const notes = Object.hasOwn(result.store.files, annotationKey)
    ? result.store.files[annotationKey]
    : [];
  const existing = target.id
    ? notes.find((note) => note.id === target.id)
    : null;
  // An unread or missing note must never become a blank editor whose Save
  // action could delete the original after storage access recovers.
  if (target.id && !existing) return;
  const backdrop = ensureEditor();
  const textarea = /** @type {HTMLTextAreaElement} */ (
    backdrop.querySelector('.annotation-editor-input')
  );
  const deleteBtn = /** @type {HTMLButtonElement} */ (
    backdrop.querySelector('.annotation-editor-delete')
  );
  const saveBtn = /** @type {HTMLButtonElement} */ (
    backdrop.querySelector('.annotation-editor-save')
  );
  const cancelBtn = /** @type {HTMLButtonElement} */ (
    backdrop.querySelector('.annotation-editor-cancel')
  );

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
    if (commitAnnotation(target, textarea.value, context)) close();
  };
  const remove = () => {
    if (commitAnnotation(target, '', context)) close();
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
 * @param {AnnotationContext | null} [context]
 */
function commitAnnotation(target, rawText, context = annDocumentContext) {
  if (
    !annIsContextCurrent(context) ||
    !context ||
    (target.element && !content()?.contains(target.element))
  ) {
    annRejectChangedContext();
    return false;
  }
  const text = String(rawText || '').trim();
  if (text.length > ANN_MAX_TEXT) {
    showToast('Notes can contain at most 16,384 characters.', {
      type: 'error',
    });
    return false;
  }
  const result = annReadStore();
  annReportStoreProblem(result);
  if (!result.store) return false;
  const notes = Object.hasOwn(result.store.files, context.key)
    ? result.store.files[context.key]
    : [];

  if (target.id) {
    const note = notes.find((n) => n.id === target.id);
    if (!note) return false;
    if (!text) {
      notes.splice(notes.indexOf(note), 1);
    } else {
      note.text = text;
    }
  } else if (target.element && text) {
    if (notes.length >= ANN_MAX_NOTES) {
      showToast('A document can have at most 500 annotations.', {
        type: 'error',
      });
      return false;
    }
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

  if (!annPutFileNotes(context.key, notes)) {
    showToast(
      'Could not save this note. Existing notes were not changed. Your text is still in the editor.',
      { type: 'error' }
    );
    return false;
  }
  renderAnnotations(context.key, context.document);
  return true;
}

// ===========================
// Annotations panel (list)
// ===========================
/**
 * Scroll to a note's block and briefly flash it.
 * @param {string} id
 * @param {AnnotationContext | null} [context]
 */
function jumpToAnnotation(id, context = annDocumentContext) {
  if (!annIsContextCurrent(context)) return;
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
  const panelContext = annDocumentContext;
  const notes = annIsContextCurrent(panelContext)
    ? annFileNotes(annotationKey).slice(0, ANN_MAX_NOTES)
    : [];
  const ctx = root && notes.length ? annContext(root) : null;

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
    const r = ctx
      ? annResolve(ctx, note)
      : { idx: -1, reason: /** @type {const} */ ('missing') };
    return { note, idx: r.idx, reason: r.reason };
  });
  rows.sort(
    (a, b) => (a.idx < 0 ? Infinity : a.idx) - (b.idx < 0 ? Infinity : b.idx)
  );

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
    ctxEl.textContent =
      snippet ||
      (reason === 'missing' ? '(text not found)' : '(moved or edited)');
    if (reason === 'fallback' || reason === 'missing')
      ctxEl.classList.add('annotation-list-context-orphaned');
    jump.append(note_, ctxEl);
    jump.addEventListener('click', () =>
      jumpToAnnotation(note.id, panelContext)
    );

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'annotation-list-edit';
    edit.title = 'Edit note';
    edit.setAttribute('aria-label', 'Edit note');
    edit.textContent = '✎';
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      openAnnotationEditor({ id: note.id }, panelContext);
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'annotation-list-delete';
    del.title = 'Delete note';
    del.setAttribute('aria-label', 'Delete note');
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      commitAnnotation({ id: note.id }, '', panelContext);
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
