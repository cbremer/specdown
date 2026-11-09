// @ts-check
import {
  recoveryOpen,
  recoveryArchive,
  recoveryPreparedCommit,
  recoveryContentRevision,
} from './annotation-recovery.js';
import { annotationSourceForTab } from '../core/annotation-source.js';
import { openAnnotationRecovery } from './annotation-recovery-ui.js';
import { state } from '../core/state.js';
import { isIOSNative } from '../core/platform.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
// Active notes use a transactional authority and local document IDs. Legacy
// filename buckets remain immutable unassigned snapshots. Persistent identity
// never replaces the accepted-view generation guard. iOS stays disabled.

import { showToast } from './toast.js';

const ANNOTATIONS_KEY = 'specdown-annotations';
const STORE_VERSION = 2;

/** @typedef {{ fp: string, path: string, ordinal: number }} Anchor */
/** @typedef {{ id: string, text: string, anchor: Anchor | null, legacyIdx: number }} Note */
/** @typedef {{ version: number, files: Record<string, Note[]> } & Record<string, unknown>} Store */
/** @typedef {{ status: 'missing' | 'valid', raw: string | null, store: Store } | { status: 'corrupt' | 'unsupported' | 'unavailable', raw: string | null, store: null }} AnnotationStoreRead */
/** @typedef {{ root: HTMLElement, blocks: Element[], fps: string[], headingPaths: string[], byFp: Map<string, number[]> }} BlockContext */
/** @typedef {{ epoch: string, revision: number, documentRevision: number, operationId?: string, key: string, document: import('../core/document-context.js').DocumentContext }} AnnotationContext */

let annotationMode = false;
let annPanelPage = 0;
const annIdentityNotices = new WeakSet();
let annotationKey = '';
/** @type {AnnotationContext | null} */
let annDocumentContext = null;
const ANN_MAX_NOTES = 500;
const ANN_MAX_TEXT = 16384;
/** @type {HTMLElement | null} */
let annEditorBackdrop = null;

const content = () => document.getElementById('markdown-content');

/** @param {AnnotationContext | null} context */
function annIsContextCurrent(context) {
  return (
    !isIOSNative &&
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
 * @returns {{ idx: number, reason: 'fp' | 'legacy' | 'fallback' | 'missing' | 'ambiguous' }}
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
      if (pool.length === 1) return { idx: pool[0], reason: 'fp' };
      return { idx: -1, reason: 'ambiguous' };
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
/** @type {any} */
let annAuthority = null;
/** @type {any} */
let annRoot = null;
/** @type {Promise<any>|null} */
let annAuthorityOpening = null;
let annLegacyCaptured = '';

/** Never use localStorage as a fallback writer. */
async function annLoadAuthority() {
  if (isIOSNative)
    throw new Error('Annotations are not available on native iOS.');
  annAuthorityOpening ||= recoveryOpen().catch((error) => {
    annAuthorityOpening = null;
    throw error;
  });
  annAuthority = await annAuthorityOpening;
  annRoot = await annAuthority.read();
  const raw = localStorage.getItem(ANNOTATIONS_KEY);
  if (raw !== null && raw !== annLegacyCaptured) {
    const archive = await recoveryArchive(raw);
    if (!annRoot.archives.some((/** @type {any} */ a) => a.id === archive.id)) {
      annRoot = await annAuthority.commit({
        type: 'capture',
        id: crypto.randomUUID(),
        epoch: annRoot.epoch,
        revision: annRoot.revision,
        archive,
      });
    }
    annLegacyCaptured = raw;
  }
  return annRoot;
}

/** @returns {AnnotationStoreRead} */
function annReadStore() {
  if (isIOSNative || !annRoot)
    return { status: 'unavailable', raw: null, store: null };
  const files = Object.create(null);
  for (const doc of annRoot.documents) files[doc.id] = doc.notes;
  return {
    status: 'valid',
    raw: null,
    store: { version: STORE_VERSION, files },
  };
}
/** @param {AnnotationStoreRead} result */
function annReportStoreProblem(result) {
  if (!result.store)
    showToast(
      'Transactional notes are unavailable. Your saved notes have not been changed. Open Unassigned notes and recovery to retry.',
      { type: 'error' }
    );
}
/** @param {string} key @returns {Note[]} */
function annFileNotes(key) {
  return (
    annRoot?.documents.find((/** @type {any} */ d) => d.id === key)?.notes || []
  );
}
/** Compatibility getter is explicitly legacy raw text, never a complete private
 * backup. The private binary export includes the transactional active state.
 */
export function getAnnotationsJSON() {
  if (isIOSNative)
    throw new Error('Annotations are not available on native iOS.');
  return localStorage.getItem(ANNOTATIONS_KEY) ?? '{"version":2,"files":{}}';
}
export function exportAnnotations() {
  if (!isIOSNative) return openAnnotationRecovery();
}
export function importAnnotationsFromFile() {
  if (!isIOSNative) return openAnnotationRecovery();
}
/** Import stages unassigned occurrences only. It never binds by filename.
 * @param {string} raw */
export async function importAnnotations(raw) {
  if (isIOSNative) return false;
  try {
    await annLoadAuthority();
    const archive = await recoveryArchive(raw);
    annRoot = await annAuthority.commit({
      type: 'capture',
      id: crypto.randomUUID(),
      epoch: annRoot.epoch,
      revision: annRoot.revision,
      archive,
    });
    showToast(
      'Backup preserved as unassigned notes. Open Unassigned notes and recovery to preview and explicitly associate copies.',
      { type: 'success' }
    );
    return true;
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : 'Archive failed; original data unchanged.',
      { type: 'error' }
    );
    return false;
  }
}

// ===========================
// Mode toggle + handlers
// ===========================
/**
 * Toggle annotation mode. Callers handle any platform chrome sync (e.g. the iOS
 * action bar) after toggling.
 */
export function toggleAnnotationMode() {
  if (isIOSNative) return;
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
 * Render committed annotation badges for an accepted persistent/ephemeral source. The display filename never selects a collection.
 * @param {string} key
 * @param {import('../core/document-context.js').DocumentContext} [documentContext]
 */
export async function renderAnnotations(
  key,
  documentContext = captureDocumentContext()
) {
  if (isIOSNative) return;
  if (
    !isDocumentContextCurrent(documentContext) ||
    state.currentViewMode !== 'preview'
  )
    return;
  const root = content();
  annotationKey = '';
  annDocumentContext = null;
  try {
    await annLoadAuthority();
    if (
      !isDocumentContextCurrent(documentContext) ||
      state.currentViewMode !== 'preview'
    )
      return;
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return;
    const source = annotationSourceForTab(tab);
    let binding = annRoot.bindings.find(
      (/** @type {any} */ b) => b.source === source
    );
    if (!binding) {
      annRoot = await annAuthority.commit({
        type: 'bind',
        id: crypto.randomUUID(),
        epoch: annRoot.epoch,
        revision: annRoot.revision,
        source,
        label: key,
        guard: () => isDocumentContextCurrent(documentContext),
      });
      if (!isDocumentContextCurrent(documentContext)) return;
      binding = annRoot.bindings.find(
        (/** @type {any} */ b) => b.source === source
      );
    }
    let doc = annRoot.documents.find(
      (/** @type {any} */ d) => d.id === binding.documentId
    );
    const sourceRevision = await recoveryContentRevision(tab.rawMarkdown);
    if (!isDocumentContextCurrent(documentContext)) return;
    if (doc.sourceRevision !== sourceRevision) {
      annRoot = await annAuthority.commit({
        type: 'observe',
        id: crypto.randomUUID(),
        epoch: annRoot.epoch,
        revision: annRoot.revision,
        documentId: doc.id,
        documentRevision: doc.revision,
        sourceRevision,
        guard: () => isDocumentContextCurrent(documentContext),
      });
      if (!isDocumentContextCurrent(documentContext)) return;
      doc = annRoot.documents.find(
        (/** @type {any} */ d) => d.id === binding.documentId
      );
    }
    annotationKey = doc.id;
    const nativeUnassigned =
      !!tab.sourceMeta?.annotationSource?.requiresReconnect &&
      !binding.explicit;
    const nativeUnavailable =
      !!tab.filePath && !tab.sourceMeta?.annotationSource;
    if (
      (nativeUnassigned || nativeUnavailable) &&
      !annIdentityNotices.has(tab)
    ) {
      annIdentityNotices.add(tab);
      showToast(
        nativeUnassigned
          ? 'This file has conflicting source continuity. Both older note collections were preserved; choose notes explicitly in recovery.'
          : 'The native note identity is unavailable. This selection is temporary; existing collections remain available in recovery.',
        {
          type: 'warning',
          duration: 0,
          action: {
            label: 'Open note recovery',
            onClick: () => {
              void openAnnotationRecovery();
            },
          },
        }
      );
    }

    const modeButton = document.getElementById('annotation-toggle');
    if (modeButton) {
      modeButton.dataset.annotationIdentity = nativeUnassigned
        ? 'unassigned'
        : source.startsWith('selection:')
          ? 'ephemeral'
          : 'durable';
      modeButton.title = nativeUnassigned
        ? 'Conflicting source identity. Use Open note recovery to explicitly reconnect a preserved collection.'
        : source.startsWith('selection:')
          ? 'Notes belong to this selection. Reopening requires an explicit recovery reconnect.'
          : 'Toggle annotation mode for this document collection';
    }
    annDocumentContext = {
      key: doc.id,
      document: documentContext,
      epoch: annRoot.epoch,
      revision: annRoot.revision,
      documentRevision: doc.revision,
    };
  } catch (error) {
    if (isDocumentContextCurrent(documentContext))
      showToast(
        error instanceof Error
          ? error.message
          : 'Transactional annotation storage unavailable.',
        { type: 'error' }
      );
    return;
  }
  if (!root) return;

  root.querySelectorAll('.annotation-badge').forEach((b) => b.remove());
  root.querySelectorAll('[data-annot-id]').forEach((element) => {
    element.removeAttribute('data-annot-id');
    element.classList.remove('has-annotation', 'annotation-orphaned');
  });

  const storedNotes = annFileNotes(annotationKey);
  const notes = storedNotes.slice(0, ANN_MAX_NOTES);
  if (notes.length === 0 && !annotationMode) {
    renderAnnotationPanel();
    return;
  }
  const ctx = annContext(root);

  for (const note of notes) {
    const { idx, reason } = annResolve(ctx, note);
    if (idx < 0) continue;
    // Derived matching never rewrites immutable source occurrences or commits
    // during rendering. Uncertain anchors are shown only in the list.
    if (reason !== 'fp') continue;
    attachAnnotationBadge(ctx.blocks[idx], note, false);
  }

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
  if (isIOSNative) return;
  if (
    !annIsContextCurrent(context) ||
    (target.element && !content()?.contains(target.element))
  ) {
    annRejectChangedContext();
    return;
  }
  if (
    !editorCleanup &&
    annRoot?.requests?.some((/** @type {any} */ r) => !r.acknowledged)
  ) {
    showToast(
      'A previous note request needs review. Open Unassigned notes and recovery to resume or acknowledge it before making another edit.',
      { type: 'warning' }
    );
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
  const save = async () => {
    if (await commitAnnotation(target, textarea.value, context)) close();
  };
  const remove = async () => {
    if (await commitAnnotation(target, '', context)) close();
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
async function commitAnnotation(target, rawText, context = annDocumentContext) {
  if (isIOSNative) return false;
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
    showToast(
      'Notes can contain at most 16,384 characters. Your draft has been kept.',
      { type: 'error' }
    );
    return false;
  }
  const notes = annFileNotes(context.key);
  if (target.id && !notes.some((n) => n.id === target.id)) return false;
  const root = content();
  const ctx = root ? annContext(root) : null;
  const idx = ctx && target.element ? ctx.blocks.indexOf(target.element) : -1;
  if (!target.id && (!text || idx < 0)) return false;
  try {
    const command = target.id
      ? { type: 'edit', noteId: target.id, text }
      : {
          type: 'add',
          note: {
            text,
            anchor: ctx ? annAnchorFor(ctx, idx) : null,
            legacyIdx: idx,
          },
        };
    context.operationId ||= crypto.randomUUID();
    annRoot = await recoveryPreparedCommit(annAuthority, {
      ...command,
      id: context.operationId,
      epoch: context.epoch,
      revision: context.revision,
      documentId: context.key,
      documentRevision: context.documentRevision,
      guard: () => annIsContextCurrent(context),
    });
    await renderAnnotations(context.key, context.document);
    return true;
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : 'Could not commit the note. Your draft has been kept.',
      { type: 'error' }
    );
    return false;
  }
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
  if (isIOSNative) return;
  const list = document.getElementById('annotation-list');
  const toggle = document.getElementById('annotation-list-toggle');
  const root = content();
  const panelContext = annDocumentContext;
  const notes = annIsContextCurrent(panelContext)
    ? annFileNotes(annotationKey)
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

  annPanelPage = Math.min(
    annPanelPage,
    Math.max(0, Math.ceil(rows.length / 100) - 1)
  );
  for (const row of rows.slice(annPanelPage * 100, annPanelPage * 100 + 100)) {
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
  if (rows.length > 100) {
    const pager = document.createElement('li');
    const previous = document.createElement('button');
    previous.textContent = 'Previous 100';
    previous.disabled = annPanelPage === 0;
    previous.onclick = () => {
      annPanelPage--;
      renderAnnotationPanel();
    };
    const next = document.createElement('button');
    next.textContent = 'Next 100';
    next.disabled = (annPanelPage + 1) * 100 >= rows.length;
    next.onclick = () => {
      annPanelPage++;
      renderAnnotationPanel();
    };
    pager.append(previous, next);
    list.append(pager);
  }
}

/** Show/hide the annotations panel. */
export function toggleAnnotationPanel() {
  if (isIOSNative) return;
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
  if (isIOSNative) return;
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
  if (isIOSNative) return;
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

/** Saving a copy is explicit continuity, separate from persisting its bookmark.
 * A failed notes transaction never pretends that the source is durably bound.
 * @param {import('../core/state.js').Tab} tab @param {string} id */
export async function bindAnnotationSavedCopy(tab, id) {
  if (isIOSNative) return;
  const source = annotationSourceForTab(tab);
  await annLoadAuthority();
  let binding = annRoot.bindings.find(
    (/** @type {any} */ b) => b.source === source
  );
  if (!binding) {
    annRoot = await annAuthority.commit({
      type: 'bind',
      id: crypto.randomUUID(),
      epoch: annRoot.epoch,
      revision: annRoot.revision,
      source,
      label: tab.filename,
    });
    binding = annRoot.bindings.find(
      (/** @type {any} */ b) => b.source === source
    );
  }
  const doc = annRoot.documents.find(
    (/** @type {any} */ d) => d.id === binding.documentId
  );
  annRoot = await annAuthority.commit({
    type: 'reconnect',
    id: crypto.randomUUID(),
    epoch: annRoot.epoch,
    revision: annRoot.revision,
    source: `saved:${id}`,
    documentId: doc.id,
    documentRevision: doc.revision,
  });
}
