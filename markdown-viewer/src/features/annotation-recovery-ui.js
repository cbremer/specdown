// @ts-check
import { isIOSNative } from '../core/platform.js';
import { state } from '../core/state.js';
import { annotationSourceForTab } from '../core/annotation-source.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import {
  recoveryOpen,
  recoveryArchive,
  recoveryExchange,
  recoveryPreparedCommit,
  recoveryPrivateBackup,
  recoveryPrivateDescription,
  recoveryRestoreFile,
  recoveryContentRevision,
  RECOVERY_LIMITS,
} from './annotation-recovery.js';

/** @type {Promise<any>|null} */
let recoveryUIAuthority = null;
/** @type {HTMLElement|null} */
let recoveryUIOverlay = null;
/** @type {any} */
let recoveryUIPreview = null;
/** @type {Set<string>} */
let recoveryUISelected = new Set();
let recoveryUIPage = 0;
let recoveryUIHistoryPage = 0;
/** @type {{generation:number,root:HTMLElement,count:number,fps:Map<string,number>}|null} */
let recoveryUIAnchorCache = null;
const recoveryUICollectionPages = new Map();
/** @type {any} */
let recoveryUIRoot = null;
/** @type {any} */
let recoveryUITarget = null;
/** @type {HTMLElement|null} */
let recoveryUIStatus = null;

/** @param {string} message */
function recoveryUIMessage(message) {
  if (recoveryUIStatus) recoveryUIStatus.textContent = message;
}
/** @returns {Promise<any>} */
async function recoveryUIStore() {
  if (isIOSNative)
    throw new Error('Annotations remain disabled on native iOS.');
  recoveryUIAuthority ||= recoveryOpen().catch((error) => {
    recoveryUIAuthority = null;
    throw error;
  });
  return recoveryUIAuthority;
}
/** @param {string} label @param {() => any} action */
function recoveryUIButton(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => {
    Promise.resolve()
      .then(action)
      .catch((error) =>
        recoveryUIMessage(
          error instanceof Error
            ? error.message
            : 'Recovery failed; your selection has been kept.'
        )
      );
  });
  return button;
}
/** @param {any} command */
async function recoveryUICommit(command) {
  const store = await recoveryUIStore();
  const capturedTarget = recoveryUITarget;
  if (
    capturedTarget &&
    ['associate', 'add', 'reconnect'].includes(command.type)
  ) {
    const doc = recoveryUIRoot.documents.find(
      (/** @type {any} */ d) => d.id === capturedTarget.documentId
    );
    if (
      doc?.sourceRevision &&
      doc.sourceRevision !==
        (await recoveryContentRevision(capturedTarget.content))
    )
      throw new Error(
        'The source revision changed in another view. Refresh the document and preview.'
      );
  }
  const guard = ['associate', 'reconnect', 'add'].includes(command.type)
    ? () =>
        !!capturedTarget &&
        isDocumentContextCurrent(capturedTarget.context) &&
        capturedTarget.tab.rawMarkdown === capturedTarget.content
    : undefined;
  if (
    recoveryUIRoot.requests?.some(
      (/** @type {any} */ request) => !request.acknowledged
    )
  )
    throw new Error(
      'Review the durable pending request below before starting another operation. Your selection has been kept.'
    );
  const result = await recoveryPreparedCommit(store, {
    guard,
    epoch: recoveryUIRoot.epoch,
    revision: recoveryUIRoot.revision,
    id: crypto.randomUUID(),
    ...command,
  });
  recoveryUIRoot = result;
  window.dispatchEvent(new Event('specdown-annotations-changed'));
  return result;
}
/** No implicit archive capture. The owner explicitly chooses capture/import.
 * A visible action is available even with no open source file.
 */
export async function openAnnotationRecovery() {
  if (isIOSNative) return;
  if (recoveryUIOverlay?.isConnected) {
    recoveryUIOverlay.focus();
    return;
  }
  const overlay = document.createElement('div');
  recoveryUIOverlay = overlay;
  overlay.className = 'annotation-editor-backdrop';
  overlay.style.display = 'flex';
  overlay.tabIndex = -1;
  const dialog = document.createElement('section');
  dialog.className = 'annotation-editor';
  dialog.style.cssText = 'max-height:85vh;overflow:auto;width:min(900px,95vw)';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Unassigned notes and recovery');
  const title = document.createElement('h2');
  title.textContent = 'Unassigned notes and recovery';
  const privacy = document.createElement('p');
  privacy.textContent =
    'Private backups can contain note text, paths, URLs and opaque fields. Recovery never grants file access. Legacy notes stay unchanged. Archives and undo history are retained; nothing is automatically deleted. Older app versions edit separate legacy notes: close older windows, then capture any changed legacy snapshot. New collections do not appear in an older app.';
  recoveryUIStatus = document.createElement('p');
  recoveryUIStatus.setAttribute('role', 'status');
  const actions = document.createElement('div');
  const body = document.createElement('div');
  body.id = 'annotation-recovery-body';
  const close = () => {
    overlay.remove();
    recoveryUIOverlay = null;
    recoveryUIPreview = null;
    recoveryUISelected.clear();
  };
  actions.append(
    recoveryUIButton('Capture legacy notes', async () => {
      const raw = localStorage.getItem('specdown-annotations');
      if (raw === null) {
        recoveryUIMessage('No legacy notes were found.');
        return;
      }
      const archive = await recoveryArchive(raw);
      await recoveryUICommit({ type: 'capture', archive });
      recoveryUIMessage(
        'Exact legacy snapshot preserved. No notes were attached. A changed legacy value can be captured as a separate archive.'
      );
      recoveryUIRender();
    }),
    recoveryUIButton('Restore backup or raw file', () => recoveryUIImport()),
    recoveryUIButton('Preserve opaque file without decoding', () =>
      recoveryUIImport(true)
    ),
    recoveryUIButton('Export private backup', () => recoveryUIExport()),
    recoveryUIButton('Preview portable exchange', () => {
      const preview = recoveryExchange(recoveryUIRoot);
      const expected = {
        epoch: recoveryUIRoot.epoch,
        revision: recoveryUIRoot.revision,
      };
      recoveryUIMessage(preview.summary);
      const confirm = recoveryUIButton(
        'Confirm lossy exchange export',
        async () => {
          const current = await (await recoveryUIStore()).read();
          if (
            current.epoch !== expected.epoch ||
            current.revision !== expected.revision
          )
            throw new Error('Store changed. Refresh exchange preview.');
          recoveryUIDownload(
            new TextEncoder().encode(JSON.stringify(preview.value)),
            'specdown-portable-exchange.json'
          );
          confirm.remove();
        }
      );
      actions.append(confirm);
    }),
    recoveryUIButton('Refresh preview', async () => {
      recoveryUIRoot = await (await recoveryUIStore()).read();
      recoveryUICaptureTarget();
      recoveryUIRender();
      recoveryUIMessage(
        'Preview refreshed; confirm your selected target again.'
      );
    }),
    recoveryUIButton('Close', close)
  );
  dialog.append(title, privacy, actions, recoveryUIStatus, body);
  overlay.append(dialog);
  document.body.append(overlay);
  overlay.focus();
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const controls = Array.from(
        dialog.querySelectorAll('button,input,textarea,select')
      ).filter((e) => !(/** @type {HTMLButtonElement} */ (e).disabled));
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === overlay)
      ) {
        event.preventDefault();
        /** @type {HTMLElement} */ (last)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        /** @type {HTMLElement} */ (first)?.focus();
      }
    }
  });
  try {
    recoveryUIRoot = await (await recoveryUIStore()).read();
    recoveryUICaptureTarget();
    recoveryUIRender();
  } catch (error) {
    recoveryUIMessage(
      error instanceof Error
        ? error.message
        : 'Transactional storage unavailable. Notes are unchanged.'
    );
  }
}

function recoveryUICaptureTarget() {
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (!tab) {
    recoveryUITarget = null;
    return;
  }
  const source = annotationSourceForTab(tab);
  const binding = recoveryUIRoot.bindings.find(
    (/** @type {any} */ b) => b.source === source
  );
  const collection = binding
    ? recoveryUIRoot.documents.find(
        (/** @type {any} */ d) => d.id === binding.documentId
      )
    : null;
  recoveryUITarget = {
    context: captureDocumentContext(),
    tab,
    source,
    content: tab.rawMarkdown,
    binding: binding ? { ...binding } : null,
    documentId: collection?.id,
    documentRevision: collection?.revision,
  };
}
function recoveryUITargetCurrent() {
  if (
    !recoveryUITarget ||
    !isDocumentContextCurrent(recoveryUITarget.context) ||
    recoveryUITarget.tab.rawMarkdown !== recoveryUITarget.content ||
    !state.tabs.includes(recoveryUITarget.tab)
  )
    throw new Error(
      'Target changed. Refresh preview; selected occurrences have been kept.'
    );
  return recoveryUITarget;
}
/** @param {any} note @returns {string} */
function recoveryUIAnchorStatus(note) {
  if (!recoveryUITarget || !isDocumentContextCurrent(recoveryUITarget.context))
    return 'unresolved (no current target)';
  const context = recoveryUITarget.context;
  if (
    !recoveryUIAnchorCache ||
    recoveryUIAnchorCache.generation !== context.generation ||
    recoveryUIAnchorCache.root !== context.root
  ) {
    const blocks = Array.from(
      context.root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote')
    ).slice(0, 5000);
    const fps = new Map();
    for (const block of blocks) {
      const walker = document.createTreeWalker(
        /** @type {Element} */ (block),
        NodeFilter.SHOW_TEXT
      );
      let node,
        text = '';
      while ((node = walker.nextNode()) && text.length < 16384) {
        if (node.parentElement?.closest('.annotation-badge')) continue;
        text += (node.textContent || '').slice(0, 16384 - text.length);
      }
      text = text.replace(/\s+/g, ' ').trim();
      let hash = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash =
          (hash +
            ((hash << 1) +
              (hash << 4) +
              (hash << 7) +
              (hash << 8) +
              (hash << 24))) >>>
          0;
      }
      const fp = hash.toString(36);
      fps.set(fp, (fps.get(fp) || 0) + 1);
    }
    recoveryUIAnchorCache = {
      root: context.root,
      generation: context.generation,
      count: blocks.length,
      fps,
    };
  }
  if (note.anchor?.fp) {
    const matches = recoveryUIAnchorCache.fps.get(note.anchor.fp) || 0;
    if (matches === 1) return 'matched (preview only)';
    if (matches > 1) return 'ambiguous';
  }
  return Number.isSafeInteger(note.legacyIdx) &&
    note.legacyIdx >= 0 &&
    note.legacyIdx < recoveryUIAnchorCache.count
    ? 'positional only'
    : 'unresolved';
}

function recoveryUIRender() {
  if (!recoveryUIOverlay?.isConnected || !recoveryUIRoot) return;
  const body = recoveryUIOverlay.querySelector('#annotation-recovery-body');
  if (!body) return;
  body.replaceChildren();
  recoveryUIAnchorCache = null;
  const target = document.createElement('p');
  target.textContent = recoveryUITarget
    ? `Captured target: ${recoveryUITarget.tab.filename}. ${recoveryUITarget.documentId ? 'Existing collection' : 'No collection yet'}. Logical locations retain notes across edits; replacement is not universally detectable. Use a new collection for a different document.`
    : 'No current document. Archives remain accessible and exportable.';
  body.append(target);
  for (const request of recoveryUIRoot.requests || []) {
    if (request.acknowledged) continue;
    const description = document.createElement('p');
    description.textContent = `Pending request ${request.id}: ${request.status}. ${request.status === 'committed' ? 'It already committed; acknowledge instead of copying again.' : 'No active effects committed. Resume the original captured collection and revision, or acknowledge to prepare another plan. Draft data is retained.'}`;
    body.append(description);
    if (request.status === 'prepared') {
      const captured = request.command;
      const destination = recoveryUIRoot.documents.find(
        (/** @type {any} */ d) => d.id === captured.documentId
      );
      const target = document.createElement('p');
      target.textContent = `Original request: ${captured.type}; target ${destination?.label || '(no active document target)'}; captured collection ${captured.documentId || '(archive staging)'}; revision ${captured.documentRevision ?? '(store only)'}.`;
      body.append(target);
      if (
        typeof captured.text === 'string' ||
        typeof captured.note?.text === 'string'
      ) {
        const draft = document.createElement('pre');
        draft.textContent = captured.text ?? captured.note.text;
        body.append(draft);
      }
      if (captured.archiveId)
        body.append(
          recoveryUIButton('Preview original selected occurrences', () => {
            recoveryUIPreview = recoveryUIRoot.archives.find(
              (/** @type {any} */ a) => a.id === captured.archiveId
            );
            recoveryUISelected = new Set(captured.addresses || []);
            recoveryUIPage = 0;
            recoveryUIRender();
          })
        );
    }

    if (request.status === 'prepared')
      body.append(
        recoveryUIButton('Resume original prepared request', async () => {
          const store = await recoveryUIStore();
          await store.commit(request.command);
          recoveryUIRoot = await store.acknowledge(request.id);
          recoveryUICaptureTarget();
          recoveryUIRender();
          window.dispatchEvent(new Event('specdown-annotations-changed'));
          recoveryUIMessage(
            'Original operation resumed once; no new operation ID was allocated.'
          );
        })
      );
    body.append(
      recoveryUIButton(
        request.status === 'prepared'
          ? 'Discard uncommitted request (keep original archives)'
          : 'Acknowledge retained request',
        async () => {
          recoveryUIRoot = await (
            await recoveryUIStore()
          ).acknowledge(request.id);
          recoveryUIRender();
        }
      )
    );
  }

  if (recoveryUITarget) {
    const draft = document.createElement('textarea');
    draft.placeholder = 'Write a note for the captured document';
    draft.setAttribute('aria-label', 'New note');
    body.append(
      draft,
      recoveryUIButton('Save new note', async () => {
        const target = recoveryUITargetCurrent();
        if (!draft.value.trim()) throw new Error('Write a note first.');
        if (!target.documentId) {
          await recoveryUICommit({
            type: 'bind',
            source: target.source,
            label: target.tab.filename,
          });
          recoveryUITargetCurrent();
          recoveryUICaptureTarget();
        }
        const current = recoveryUITargetCurrent();
        await recoveryUICommit({
          type: 'add',
          documentId: current.documentId,
          documentRevision: current.documentRevision,
          note: { text: draft.value, anchor: null, legacyIdx: -1 },
        });
        recoveryUICaptureTarget();
        recoveryUIRender();
        recoveryUIMessage('Note committed to its own document collection.');
      })
    );
  }
  if (recoveryUITarget)
    body.append(
      recoveryUIButton(
        'Create separate collection for current document',
        async () => {
          const target = recoveryUITargetCurrent();
          const source = target.source;
          // Split is an explicit reconnect to a freshly allocated local collection.
          const newSource = `selection:${crypto.randomUUID()}`;
          await recoveryUICommit({
            type: 'bind',
            source: newSource,
            label: target.tab.filename,
          });
          const newBinding = recoveryUIRoot.bindings.find(
            (/** @type {any} */ b) => b.source === newSource
          );
          const doc = recoveryUIRoot.documents.find(
            (/** @type {any} */ d) => d.id === newBinding.documentId
          );
          await recoveryUICommit({
            type: 'reconnect',
            source,
            documentId: doc.id,
            documentRevision: doc.revision,
          });
          recoveryUICaptureTarget();
          recoveryUIRender();
          recoveryUIMessage(
            'New collection explicitly connected. Previous collection retained in recovery.'
          );
        }
      )
    );
  const archives = document.createElement('h3');
  archives.textContent = `Immutable archives (${recoveryUIRoot.archives.length})`;
  body.append(archives);
  for (const archive of recoveryUIRoot.archives) {
    const row = document.createElement('div');
    row.append(
      recoveryUIButton(
        `${archive.id.slice(0, 35)}… — ${archive.occurrences.length} occurrences — ${archive.status}`,
        () => {
          recoveryUIPreview = archive;
          recoveryUISelected = new Set();
          recoveryUIPage = 0;
          recoveryUIRender();
        }
      )
    );
    row.append(
      recoveryUIButton('Export original', () =>
        recoveryUIDownload(
          archive.bytes,
          archive.kind === 'utf16le-units'
            ? 'specdown-original.utf16le'
            : 'specdown-original.bin'
        )
      )
    );
    body.append(row);
  }
  if (recoveryUIPreview) {
    const preview = recoveryUIPreview;
    const heading = document.createElement('h3');
    heading.textContent = `Occurrence preview — ${recoveryUISelected.size} selected`;
    body.append(heading);
    if (preview.status === 'supported private state; bindings quarantined')
      body.append(
        recoveryUIButton('Preview explicit store replacement', () => {
          recoveryUIMessage(
            'Replace active collections and disconnect current bindings? A verified protective snapshot and all existing archives will be retained. Imported bindings never become grants.'
          );
          const confirm = recoveryUIButton(
            'Confirm protected store replacement',
            async () => {
              const current = await (await recoveryUIStore()).read();
              if (
                current.epoch !== recoveryUIRoot.epoch ||
                current.revision !== recoveryUIRoot.revision
              )
                throw new Error('Store changed. Refresh replacement preview.');
              const protective = await recoveryArchive(
                recoveryPrivateDescription(current)
              );
              await recoveryUICommit({
                type: 'replace',
                protective,
                incomingArchiveId: preview.id,
              });
              recoveryUICaptureTarget();
              recoveryUIRender();
              recoveryUIMessage(
                'Replacement committed with a new store epoch. Previous state retained in its protective archive. Explicit reconnect required.'
              );
            }
          );
          body.append(confirm);
        })
      );
    const start = recoveryUIPage * RECOVERY_LIMITS.page;
    for (const occurrence of preview.occurrences.slice(
      start,
      start + RECOVERY_LIMITS.page
    )) {
      const row = document.createElement('label');
      row.style.display = 'block';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = recoveryUISelected.has(occurrence.address);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) recoveryUISelected.add(occurrence.address);
        else recoveryUISelected.delete(occurrence.address);
        heading.textContent = `Occurrence preview — ${recoveryUISelected.size} selected`;
      });
      const text = document.createElement('span');
      text.textContent = `${occurrence.label} ${occurrence.address} — ${recoveryUIAnchorStatus(occurrence.note)} — ${occurrence.note.text.slice(0, 500)}`;
      row.append(checkbox, text);
      body.append(row);
    }
    body.append(
      recoveryUIButton('Previous page', () => {
        recoveryUIPage = Math.max(0, recoveryUIPage - 1);
        recoveryUIRender();
      }),
      recoveryUIButton('Next page', () => {
        if (
          (recoveryUIPage + 1) * RECOVERY_LIMITS.page <
          preview.occurrences.length
        )
          recoveryUIPage++;
        recoveryUIRender();
      }),
      recoveryUIButton(
        'Associate selected copies with captured target',
        async () => {
          const target = recoveryUITargetCurrent();
          if (!recoveryUISelected.size)
            throw new Error('Select at least one occurrence.');
          if (!target.documentId) {
            await recoveryUICommit({
              type: 'bind',
              source: target.source,
              label: target.tab.filename,
            });
            recoveryUITargetCurrent();
            recoveryUICaptureTarget();
          }
          const current = recoveryUITargetCurrent();
          await recoveryUICommit({
            type: 'associate',
            archiveId: preview.id,
            addresses: [...recoveryUISelected],
            documentId: current.documentId,
            documentRevision: current.documentRevision,
          });
          recoveryUISelected.clear();
          recoveryUICaptureTarget();
          recoveryUIRender();
          recoveryUIMessage(
            'Selected copies committed. Immutable originals preserved.'
          );
        }
      )
    );
  }
  const collections = document.createElement('h3');
  collections.textContent =
    'Local collections — imported bindings never grant access';
  body.append(collections);
  for (const collection of recoveryUIRoot.documents) {
    const header = document.createElement('h4');
    header.textContent = `${collection.label} — ${collection.notes.length} notes`;
    body.append(header);
    if (recoveryUITarget)
      body.append(
        recoveryUIButton(
          'Explicitly reconnect current source and map recovered binding history',
          async () => {
            const target = recoveryUITargetCurrent();
            await recoveryUICommit({
              type: 'reconnect',
              mapHistory: true,
              source: target.source,
              documentId: collection.id,
              documentRevision: collection.revision,
            });
            recoveryUICaptureTarget();
            recoveryUIRender();
            recoveryUIMessage(
              'Source explicitly reconnected. Both collections are retained. Undo is available below.'
            );
          }
        )
      );
    const collectionPage = recoveryUICollectionPages.get(collection.id) || 0;
    for (const note of collection.notes.slice(
      collectionPage * RECOVERY_LIMITS.page,
      (collectionPage + 1) * RECOVERY_LIMITS.page
    )) {
      const row = document.createElement('div');
      const text = document.createElement('span');
      text.textContent = note.text.slice(0, 500);
      row.append(text);
      row.append(
        recoveryUIButton('Edit copy', () => {
          const input = document.createElement('textarea');
          input.value = note.text;
          row.replaceChildren(
            input,
            recoveryUIButton('Save edit', async () => {
              await recoveryUICommit({
                type: 'edit',
                documentId: collection.id,
                documentRevision: collection.revision,
                noteId: note.id,
                text: input.value,
              });
              recoveryUICaptureTarget();
              recoveryUIRender();
              recoveryUIMessage('Edit committed. Original archive unchanged.');
            })
          );
        })
      );
      body.append(row);
    }
    if (collection.notes.length > RECOVERY_LIMITS.page) {
      body.append(
        recoveryUIButton('Previous collection page', () => {
          recoveryUICollectionPages.set(
            collection.id,
            Math.max(0, collectionPage - 1)
          );
          recoveryUIRender();
        }),
        recoveryUIButton('Next collection page', () => {
          if (
            (collectionPage + 1) * RECOVERY_LIMITS.page <
            collection.notes.length
          )
            recoveryUICollectionPages.set(collection.id, collectionPage + 1);
          recoveryUIRender();
        })
      );
    }
  }
  const history = document.createElement('h3');
  history.textContent = 'Operation history — undo preserves newer edits';
  body.append(history);
  const operations = recoveryUIRoot.operations
    .filter(
      (/** @type {any} */ o) =>
        !o.retiredInArchive &&
        ['associate', 'reconnect', 'bind', 'add'].includes(o.type)
    )
    .slice()
    .reverse();
  recoveryUIHistoryPage = Math.min(
    recoveryUIHistoryPage,
    Math.max(0, Math.ceil(operations.length / RECOVERY_LIMITS.page) - 1)
  );
  if (operations.length > RECOVERY_LIMITS.page) {
    const page = document.createElement('p');
    page.textContent = `History page ${recoveryUIHistoryPage + 1} of ${Math.ceil(operations.length / RECOVERY_LIMITS.page)}`;
    body.append(
      page,
      recoveryUIButton('Newer history page', () => {
        recoveryUIHistoryPage = Math.max(0, recoveryUIHistoryPage - 1);
        recoveryUIRender();
      }),
      recoveryUIButton('Older history page', () => {
        if (
          (recoveryUIHistoryPage + 1) * RECOVERY_LIMITS.page <
          operations.length
        )
          recoveryUIHistoryPage++;
        recoveryUIRender();
      })
    );
  }
  for (const operation of operations.slice(
    recoveryUIHistoryPage * RECOVERY_LIMITS.page,
    (recoveryUIHistoryPage + 1) * RECOVERY_LIMITS.page
  ))
    body.append(
      recoveryUIButton(
        `${operation.undone ? 'Already undone' : 'Undo'} ${operation.type} ${operation.id.slice(0, 8)}`,
        async () => {
          await recoveryUICommit({ type: 'undo', operationId: operation.id });
          const result = recoveryUIRoot.operations.at(-1);
          recoveryUICaptureTarget();
          recoveryUIRender();
          recoveryUIMessage(
            result?.conflicts?.length
              ? `Undo preserved ${result.conflicts.length} newer or deleted changes. Originals remain available to copy.`
              : 'Undo completed; originals and unrelated work retained.'
          );
        }
      )
    );
}

/** @param {Uint8Array} bytes @param {string} name */
function recoveryUIDownload(bytes, name) {
  const url = URL.createObjectURL(
    new Blob([/** @type {BlobPart} */ (bytes)], {
      type: 'application/octet-stream',
    })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function recoveryUIExport() {
  const store = await recoveryUIStore();
  const snapshot = await store.read();
  const bytes = await recoveryPrivateBackup(snapshot);
  recoveryUIDownload(bytes, 'specdown-private-recovery.sdr');
  recoveryUIMessage(
    'Backup download requested. Save it securely, then reselect the file to verify recovery. It contains private raw data and history.'
  );
}
/** @param {boolean} [opaque] */
function recoveryUIImport(opaque = false) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.sdr,.json,.bin,.utf16le';
  input.hidden = true;
  (recoveryUIOverlay || document.body).append(input);
  input.addEventListener('cancel', () => input.remove());
  input.addEventListener('change', async () => {
    try {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      if (file.size > RECOVERY_LIMITS.transportBytes)
        throw new Error(
          'Unsupported capacity: file exceeds 32 MiB. Original file is unchanged.'
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      const archives =
        !opaque && String.fromCharCode(...bytes.slice(0, 4)) === 'SDR1'
          ? await recoveryRestoreFile(bytes)
          : [await recoveryArchive(bytes)];
      // Atomic batch: no partially captured transport on failure.
      await recoveryUICommit({ type: 'restore', archives });
      recoveryUIRender();
      recoveryUIMessage(
        'Verified file archived as unassigned recovery data. No source binding or permission imported. Select an archive to preview.'
      );
    } catch (error) {
      recoveryUIMessage(
        error instanceof Error
          ? error.message
          : 'Restore failed. Original data unchanged.'
      );
    }
  });
  input.click();
}
