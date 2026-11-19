// @ts-check
import { invalidateDocumentContext } from '../core/document-context.js';
import { syncIOSChrome, closeIOSActionSheet } from '../platform/ios-chrome.js';
import { state } from '../core/state.js';
import {
  bridgeSaveMarkdown,
  bridgeOnEditorClose,
  bridgeCloseEditorWindow,
} from '../platform/bridge.js';
import { showToast } from './toast.js';

/** @typedef {import('../core/state.js').Tab} EditorTab */
/** @typedef {{status:string, message?:string, content?:string, filePath?:string, filename?:string, sourceMeta?:import('../core/state.js').TabSourceMeta|null, copied?:boolean}} SourceSaveResult */
/** @typedef {{text:string, baseline:string, input:HTMLTextAreaElement, inEditor:boolean, editing:boolean, saving:boolean, recoveryID:string, external?:string}} SourceDraft */
/** @type {Map<number, SourceDraft>} */
const sourceDrafts = new Map();
const sourceRecoveryKey = 'specdown.sourceDrafts.v1';
/** @type {(text:string,title:string)=>any} */
let sourceRender = () => {};
/** @type {()=>void} */
let sourceTabsChanged = () => {};
/** @type {(name:string,content:string,path?:string|null,meta?:import('../core/state.js').TabSourceMeta|null)=>boolean} */
let sourceCreateTab = () => false;
/** @type {(tab:EditorTab,text:string,expected:string,copy:boolean)=>Promise<SourceSaveResult>} */
let sourceSave = nativeSourceSave;
/** @type {Array<{id:string, filename:string, text:string, baseline:string, filePath:string|null, sourceMeta:import('../core/state.js').TabSourceMeta|null}>} */
let sourceRecovery = [];
let sourceRecoveryWritable = true;
let sourceRecoveryWarning = false;
/** @type {Map<string,(result:SourceSaveResult)=>void>} */
const sourcePendingIOS = new Map();

/** @param {{render?:typeof sourceRender, changed?:typeof sourceTabsChanged, createTab?:typeof sourceCreateTab, save?:typeof sourceSave}} deps */
export function configureSourceEditor(deps) {
  if (deps.render) sourceRender = deps.render;
  if (deps.changed) sourceTabsChanged = deps.changed;
  if (deps.createTab) sourceCreateTab = deps.createTab;
  if (deps.save) sourceSave = deps.save;
}
/** @returns {EditorTab|undefined} */
function sourceActiveTab() {
  return state.tabs.find((t) => t.id === state.activeTabId);
}
/** @param {EditorTab} tab */
export function sourceDraftText(tab) {
  return sourceDrafts.get(tab.id)?.text ?? tab.rawMarkdown;
}
/** @param {EditorTab} tab */
export function isSourceDirty(tab) {
  const draft = sourceDrafts.get(tab.id);
  return !!draft && draft.text !== draft.baseline;
}
/** @param {EditorTab} tab */
export function hasSourceSavePending(tab) {
  return !!sourceDrafts.get(tab.id)?.saving;
}
/** @param {EditorTab} tab */
export function hasSourceDraft(tab) {
  return sourceDrafts.has(tab.id);
}
/** Reconstruct textarea-normalized line endings without changing untouched lines.
 * @param {string} value @param {string} original */
function sourceRestoreNewlines(value, original) {
  const oldLines =
    original.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter(Boolean) || [];
  const oldText = original.replace(/\r\n|\r/g, '\n');
  if (value === oldText) return original;
  const before = oldText.split('\n'),
    after = value.split('\n');
  let prefix = 0,
    suffix = 0;
  while (
    prefix < Math.min(before.length, after.length) &&
    before[prefix] === after[prefix]
  )
    prefix++;
  while (
    suffix < Math.min(before.length, after.length) - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++;
  const newline = original.includes('\r\n')
    ? '\r\n'
    : original.includes('\r')
      ? '\r'
      : '\n';
  return after
    .map((line, index) => {
      const oldIndex =
        index < prefix
          ? index
          : index >= after.length - suffix
            ? before.length - (after.length - index)
            : -1;
      const ending =
        oldIndex >= 0
          ? oldLines[oldIndex]?.match(/(\r\n|\r|\n)$/)?.[0]
          : undefined;
      return line + (index === after.length - 1 ? '' : ending || newline);
    })
    .join('');
}
/** @param {EditorTab} tab */
function sourceEnsureDraft(tab) {
  let draft = sourceDrafts.get(tab.id);
  if (draft) return draft;
  const input = document.createElement('textarea');
  input.className = 'source-editor-input';
  input.setAttribute('aria-label', `Markdown source for ${tab.filename}`);
  input.spellcheck = false;
  input.value = tab.rawMarkdown;
  input.wrap = 'off';
  draft = {
    text: tab.rawMarkdown,
    baseline: tab.rawMarkdown,
    input,
    editing: true,
    inEditor: true,
    saving: false,
    recoveryID: crypto.randomUUID(),
  };
  sourceDrafts.set(tab.id, draft);
  input.addEventListener('input', () => {
    const current = sourceDrafts.get(tab.id);
    if (!current) return;
    current.text = sourceRestoreNewlines(input.value, current.baseline);
    if (state.activeTabId === tab.id) state.currentRawMarkdown = current.text;
    sourcePersistDrafts();
    syncSourceEditor();
    sourceTabsChanged();
  });
  document.getElementById('source-editor-host')?.append(input);
  return draft;
}

export function startSourceEditing() {
  const tab = sourceActiveTab();
  if (!tab) return;
  const draft = sourceEnsureDraft(tab);
  invalidateDocumentContext();
  draft.editing = true;
  draft.inEditor = true;
  state.currentRawMarkdown = draft.text;
  syncIOSChrome();
  syncSourceEditor();
  draft.input.focus();
}
/** Hide only the menu; never discard a source draft. */
function closeSourceEditorMenu(restoreFocus = false) {
  const menu = document.getElementById('source-menu');
  if (menu) menu.hidden = true;
  document
    .getElementById('source-more')
    ?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) document.getElementById('source-more')?.focus();
}

export function syncSourceEditor() {
  const recover = document.getElementById('source-recover');
  if (recover) recover.hidden = sourceRecovery.length === 0;
  const tab = sourceActiveTab(),
    draft = tab && sourceDrafts.get(tab.id);
  const inEditor = !!draft?.inEditor;
  const editing = inEditor && !!draft?.editing;
  const bar = document.getElementById('source-editor-bar');
  if (bar) bar.hidden = !inEditor;
  if (!inEditor) closeSourceEditorMenu();
  document
    .getElementById('content-area')
    ?.classList.toggle('source-editor-active', inEditor);
  document.body.classList.toggle('source-editor-active', inEditor);
  const host = document.getElementById('source-editor-host');
  if (host) host.hidden = !editing;
  document
    .getElementById('content-main')
    ?.classList.toggle('source-editing-active', editing);
  for (const [id, entry] of sourceDrafts)
    entry.input.hidden = id !== tab?.id || !editing;
  const content = document.getElementById('markdown-content');
  if (content) content.hidden = editing;
  const edit = document.getElementById('source-edit');
  if (edit) {
    edit.hidden = !tab || inEditor;
    edit.textContent = tab && isSourceDirty(tab) ? 'Resume editing' : 'Edit';
  }
  document
    .getElementById('source-source')
    ?.setAttribute('aria-pressed', String(editing));
  document
    .getElementById('source-preview')
    ?.setAttribute('aria-pressed', String(inEditor && !editing));
  const description = draft?.saving
    ? 'Saving…'
    : draft?.external !== undefined
      ? 'Source changed — draft retained'
      : tab && isSourceDirty(tab)
        ? 'Unsaved changes'
        : 'No unsaved changes';
  const status = document.getElementById('source-status');
  if (status) status.textContent = description;
  const visibleStatus = document.getElementById('source-state');
  if (visibleStatus) {
    visibleStatus.hidden = !draft || description === 'No unsaved changes';
    visibleStatus.textContent = draft?.saving
      ? 'Saving…'
      : draft?.external !== undefined
        ? 'Source changed'
        : 'Unsaved';
    visibleStatus.title = description;
  }
  const save = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('source-save')
  );
  if (save) {
    save.disabled =
      !draft ||
      !!draft.saving ||
      (!isSourceDirty(/** @type {EditorTab} */ (tab)) &&
        draft.external === undefined &&
        !tab?.sourceMeta?.wordImport);
    save.textContent = draft?.saving
      ? 'Saving…'
      : tab?.sourceMeta?.wordImport
        ? 'Save as Markdown…'
        : 'Save';
  }
  for (const id of ['source-save-as', 'source-cancel']) {
    const button = /** @type {HTMLButtonElement|null} */ (
      document.getElementById(id)
    );
    if (button) {
      button.hidden = !draft;
      button.disabled =
        !!draft?.saving ||
        (id === 'source-cancel' && !!tab && !isSourceDirty(tab));
    }
  }
  for (const action of [
    'edit',
    'preview',
    'return',
    'save',
    'save-as',
    'cancel',
  ]) {
    const button = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('ios-source-' + action)
    );
    if (!button) continue;
    button.hidden = action === 'edit' ? !tab : !draft;
    if (action === 'save')
      button.textContent = tab?.sourceMeta?.wordImport
        ? 'Save as Markdown…'
        : 'Save Markdown';
    if (action === 'edit')
      button.textContent = inEditor
        ? 'Edit source'
        : tab && isSourceDirty(tab)
          ? 'Resume editing'
          : 'Edit Markdown';
    if (['save', 'save-as', 'cancel'].includes(action))
      button.disabled = !!draft?.saving;
  }
}
/** Return to reading while retaining the same textarea, undo history and recovery record. */
export async function returnToSourceReading() {
  const tab = sourceActiveTab();
  if (!tab) return;
  const draft = sourceDrafts.get(tab.id);
  if (!draft) return;
  closeSourceEditorMenu();
  draft.inEditor = false;
  draft.editing = false;
  await sourceRender(draft.text, tab.filename);
  syncSourceEditor();
  if (sourceActiveTab() === tab)
    document.getElementById('source-edit')?.focus();
}
/** @param {EditorTab} tab */
export async function previewSourceDraft(tab) {
  const draft = sourceDrafts.get(tab.id);
  if (!draft) return;
  draft.editing = false;
  draft.inEditor = true;
  await sourceRender(draft.text, tab.filename);
  syncSourceEditor();
}
/** Called by tab navigation; textarea nodes stay mounted so native undo survives.
 * @param {EditorTab} tab */
export function showSourceDraft(tab) {
  const draft = sourceDrafts.get(tab.id);
  if (!draft) {
    syncSourceEditor();
    return false;
  }
  state.currentRawMarkdown = draft.text;
  state.currentViewMode = 'preview';
  if (draft.editing) {
    invalidateDocumentContext();
    syncIOSChrome();
  }
  if (!draft.editing) void sourceRender(draft.text, tab.filename);
  else {
    const name = document.getElementById('file-name');
    if (name) name.textContent = tab.filename;
  }
  syncSourceEditor();
  return true;
}
/** @param {EditorTab} tab @param {string} content */
export function protectSourceDraft(tab, content) {
  const draft = sourceDrafts.get(tab.id);
  if (!draft) return false;
  // Even a clean editor retains undo/selection; changes require an explicit reload.
  if (content !== draft.baseline) draft.external = content;
  syncSourceEditor();
  return true;
}
/** @param {string} title @param {Array<[string,string]>} choices @param {string} [detail] @returns {Promise<string>} */
export function sourceEditorChoice(title, choices, detail) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'source-choice';
    if (choices.length === 2) dialog.classList.add('source-choice-compact');
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.id = 'source-choice-' + crypto.randomUUID();
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading);
    if (detail) {
      const description = document.createElement('p');
      description.textContent = detail;
      dialog.append(description);
    }
    const actions = document.createElement('div');
    actions.className = 'source-choice-actions';
    dialog.append(actions);
    const finish = (/** @type {string} */ choice) => {
      dialog.remove();
      resolve(choice);
    };
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish('keep');
    });
    for (const [value, label] of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.editorChoice = value;
      button.onclick = () => finish(value);
      actions.append(button);
    }
    document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector('button')?.focus();
  });
}
/** @param {EditorTab} tab @param {boolean} [copy] @returns {Promise<boolean>} */
export async function saveSourceDraft(tab, copy = false) {
  const draft = sourceDrafts.get(tab.id);
  if (!draft || draft.saving) return false;
  if (tab.sourceMeta?.wordImport) copy = true;
  // Reserve admission for the independent Save As tab before writing a copy.
  if (copy && state.tabs.length >= 10) {
    showToast('Close a tab before saving an independent copy.', {
      type: 'warning',
    });
    return false;
  }
  const submitted = draft.text;
  let expected = draft.baseline;
  draft.saving = true;
  syncSourceEditor();
  try {
    for (;;) {
      const result = await sourceSave(tab, submitted, expected, copy);
      if (result.status === 'conflict' && typeof result.content === 'string') {
        draft.external = result.content;
        const choice = await sourceEditorChoice(
          'The source changed. Keep your draft or choose a destination.',
          [
            ['keep', 'Keep editing'],
            ['copy', 'Save As…'],
            ['overwrite', 'Overwrite this source version'],
            ['reload', 'Discard draft and reload this version'],
          ]
        );
        if (choice === 'copy') {
          if (state.tabs.length >= 10) return false;
          copy = true;
          continue;
        }
        if (choice === 'overwrite') {
          expected = result.content;
          continue;
        }
        if (choice === 'reload') {
          tab.rawMarkdown = result.content;
          draft.baseline = result.content;
          draft.text = result.content;
          draft.input.value = result.content;
          delete draft.external;
          sourcePersistDrafts();
          if (tab.id === state.activeTabId) showSourceDraft(tab);
        }
        return false;
      }
      if (result.status !== 'saved') {
        if (result.status !== 'canceled')
          showToast(
            result.message ||
              'Save failed. Draft retained; retry or use Save As.',
            { type: 'error', duration: 0 }
          );
        return false;
      }
      if (
        copy ||
        result.copied ||
        (result.filePath && result.filePath !== tab.filePath) ||
        result.sourceMeta?.nativeDocument
      ) {
        // A separate accepted source receives its own annotation collection.
        const admitted = sourceCreateTab(
          result.filename || tab.filename,
          submitted,
          result.filePath || null,
          result.sourceMeta || null
        );
        if (admitted && draft.text === submitted) forgetSourceDraft(tab);
        showToast(
          admitted
            ? 'Markdown copy saved as an independent source.'
            : 'Markdown copy saved, but could not open a new tab. Your draft is retained.',
          {
            type: 'success',
          }
        );
      } else {
        tab.rawMarkdown = submitted;
        draft.baseline = submitted;
        if (!draft.editing && tab.id === state.activeTabId)
          void sourceRender(draft.text, tab.filename);
        if (draft.external === submitted || draft.external === expected)
          delete draft.external;
        showToast('Saved locally. Cloud providers synchronize separately.', {
          type: 'success',
        });
      }
      sourcePersistDrafts();
      sourceTabsChanged();
      return true;
    }
  } catch {
    showToast('Save failed. Draft retained; retry or use Save As.', {
      type: 'error',
      duration: 0,
    });
    return false;
  } finally {
    draft.saving = false;
    syncSourceEditor();
  }
}
/** @param {EditorTab} tab @returns {Promise<boolean>} */
export async function confirmSourceDiscard(tab) {
  const draft = sourceDrafts.get(tab.id);
  if (draft?.saving) return false;
  if (!isSourceDirty(tab)) return true;
  const choice = await sourceEditorChoice(`Save changes to ${tab.filename}?`, [
    ['keep', 'Keep editing'],
    ['save', tab.sourceMeta?.wordImport ? 'Save as Markdown…' : 'Save'],
    ['discard', 'Discard'],
  ]);
  if (choice === 'discard') return true;
  if (choice === 'save') {
    await saveSourceDraft(tab);
    return !isSourceDirty(tab);
  }
  return false;
}
/** @param {EditorTab} tab */
export function forgetSourceDraft(tab) {
  sourceDrafts.get(tab.id)?.input.remove();
  sourceDrafts.delete(tab.id);
  sourcePersistDrafts();
  sourceTabsChanged();
  syncSourceEditor();
}
function sourcePersistDrafts() {
  if (!sourceRecoveryWritable) return;
  try {
    const records = [...sourceRecovery];
    for (const tab of state.tabs) {
      const draft = sourceDrafts.get(tab.id);
      if (!draft || !isSourceDirty(tab)) continue;
      records.push({
        id: draft.recoveryID,
        filename: tab.filename,
        text: draft.text,
        baseline: draft.baseline,
        filePath: tab.filePath,
        sourceMeta: tab.sourceMeta || null,
      });
    }
    localStorage.setItem(
      sourceRecoveryKey,
      JSON.stringify({ version: 1, records })
    );
  } catch {
    if (!sourceRecoveryWarning)
      showToast(
        'Draft recovery storage failed. Keep this app open and Save or Save As.',
        { type: 'error', duration: 0 }
      );
    sourceRecoveryWarning = true;
  }
}
async function restoreSourceDrafts() {
  for (const record of [...sourceRecovery]) {
    const choice = await sourceEditorChoice(
      `Recover unsaved draft: ${record.filename}${record.filePath ? ' — ' + record.filePath : ''}`,
      [
        ['keep', 'Later'],
        ['restore', 'Restore draft'],
        ['discard', 'Discard draft'],
      ]
    );
    if (choice === 'keep') continue;
    if (choice === 'restore') {
      // Metadata and path identify the source; they confer no native grants.
      if (
        !sourceCreateTab(
          record.filename,
          record.baseline,
          record.filePath,
          record.sourceMeta
        )
      )
        continue;
      const tab = sourceActiveTab();
      if (!tab) continue;
      const draft = sourceEnsureDraft(tab);
      draft.text = record.text;
      draft.input.value = record.text;
      draft.recoveryID = record.id;
      startSourceEditing();
    }
    sourceRecovery = sourceRecovery.filter((entry) => entry.id !== record.id);
    sourcePersistDrafts();
  }
  syncSourceEditor();
}
/** @param {EditorTab} tab @param {string} text @param {string} expected @param {boolean} copy @returns {Promise<SourceSaveResult>} */
async function nativeSourceSave(tab, text, expected, copy) {
  const filename = tab.sourceMeta?.wordImport
    ? tab.filename.replace(/\.docx$/i, '.md')
    : tab.filename;
  if (window.specdown)
    return await bridgeSaveMarkdown({
      filePath: tab.filePath,
      filename,
      content: text,
      expected,
      copy,
    });
  const handler = window.webkit?.messageHandlers?.specdown;
  if (handler) {
    const requestID = crypto.randomUUID();
    return await new Promise((resolve) => {
      sourcePendingIOS.set(requestID, resolve);
      handler.postMessage({
        action: 'saveMarkdown',
        data: {
          requestID,
          sourceID: tab.sourceMeta?.nativeDocument?.id || '',
          filename,
          content: text,
          expected,
          copy,
        },
      });
    });
  }
  return {
    status: 'error',
    message:
      'Saving requires the desktop or iOS app. Your draft is retained locally.',
  };
}
export function setupSourceEditor() {
  try {
    const raw = localStorage.getItem(sourceRecoveryKey);
    if (raw) {
      const envelope = JSON.parse(raw);
      if (
        envelope.version !== 1 ||
        !Array.isArray(envelope.records) ||
        envelope.records.length > 100 ||
        !envelope.records.every(
          (/** @type {any} */ r) =>
            typeof r.id === 'string' &&
            typeof r.text === 'string' &&
            typeof r.baseline === 'string' &&
            typeof r.filename === 'string' &&
            (r.filePath === null || typeof r.filePath === 'string')
        )
      )
        throw Error('Unsupported draft store');
      sourceRecovery = envelope.records;
    }
  } catch {
    sourceRecoveryWritable = false;
    showToast(
      'Existing draft recovery data is unavailable and has been preserved.',
      { type: 'error' }
    );
  }
  for (const action of [
    'edit',
    'preview',
    'return',
    'save',
    'save-as',
    'cancel',
  ]) {
    document
      .getElementById('ios-source-' + action)
      ?.addEventListener('click', () => {
        closeIOSActionSheet();
        document.getElementById('source-' + action)?.click();
      });
  }
  document.getElementById('source-edit')?.addEventListener('click', () => {
    const tab = sourceActiveTab();
    if (!tab) return;
    startSourceEditing();
  });
  document
    .getElementById('source-source')
    ?.addEventListener('click', startSourceEditing);
  document.getElementById('source-preview')?.addEventListener('click', () => {
    const tab = sourceActiveTab();
    if (tab) void previewSourceDraft(tab);
  });
  document.getElementById('source-return')?.addEventListener('click', () => {
    void returnToSourceReading();
  });
  document.getElementById('source-more')?.addEventListener('click', () => {
    const menu = document.getElementById('source-menu');
    if (!menu) return;
    menu.hidden = !menu.hidden;
    document
      .getElementById('source-more')
      ?.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('button')?.focus();
  });
  document.getElementById('source-menu')?.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [
      .../** @type {NodeListOf<HTMLButtonElement>} */ (
        document.querySelectorAll(
          '#source-menu button:not(:disabled):not([hidden])'
        )
      ),
    ];
    const index = items.indexOf(
      /** @type {HTMLButtonElement} */ (document.activeElement)
    );
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) %
            items.length;
    e.preventDefault();
    items[next]?.focus();
  });
  document.addEventListener('click', (e) => {
    const target = /** @type {Node} */ (e.target);
    if (!document.querySelector('.source-menu-anchor')?.contains(target))
      closeSourceEditorMenu();
  });
  document.getElementById('source-save')?.addEventListener('click', () => {
    const tab = sourceActiveTab();
    closeSourceEditorMenu();
    if (tab) void saveSourceDraft(tab);
  });
  document.getElementById('source-save-as')?.addEventListener('click', () => {
    const tab = sourceActiveTab();
    closeSourceEditorMenu();
    if (tab) void saveSourceDraft(tab, true);
  });
  document
    .getElementById('source-cancel')
    ?.addEventListener('click', async () => {
      const tab = sourceActiveTab();
      closeSourceEditorMenu();
      if (!tab || hasSourceSavePending(tab) || !isSourceDirty(tab)) return;
      const choice = await sourceEditorChoice(
        'Discard changes?',
        [
          ['keep', 'Cancel'],
          ['discard', 'Discard changes'],
        ],
        `Your unsaved changes to ${tab.filename} will be lost.`
      );
      if (choice !== 'discard') {
        if (sourceActiveTab() === tab)
          document
            .getElementById('source-more')
            ?.focus({ preventScroll: true });
        return;
      }
      forgetSourceDraft(tab);
      if (sourceActiveTab() === tab) {
        await sourceRender(tab.rawMarkdown, tab.filename);
        document.getElementById('source-edit')?.focus({ preventScroll: true });
      }
    });
  document
    .getElementById('source-recover')
    ?.addEventListener('click', restoreSourceDrafts);
  const recover = document.getElementById('source-recover');
  if (recover) recover.hidden = sourceRecovery.length === 0;
  window.specdownSourceSaveResult = (id, result) => {
    const resolve = sourcePendingIOS.get(id);
    sourcePendingIOS.delete(id);
    resolve?.(result);
  };
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (
      e.key === 'Escape' &&
      !document.querySelector('dialog[open]') &&
      document
        .getElementById('content-area')
        ?.contains(/** @type {Node} */ (e.target))
    ) {
      const menu = document.getElementById('source-menu');
      if (menu && !menu.hidden) {
        e.preventDefault();
        closeSourceEditorMenu(true);
        return;
      }
      const tab = sourceActiveTab();
      if (tab && sourceDrafts.get(tab.id)?.inEditor) {
        e.preventDefault();
        void returnToSourceReading();
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      const tab = sourceActiveTab();
      if (tab) {
        e.preventDefault();
        if (!hasSourceDraft(tab)) startSourceEditing();
        void saveSourceDraft(tab, e.shiftKey);
      }
    }
  });
  window.addEventListener('beforeunload', (e) => {
    sourcePersistDrafts();
    if (state.tabs.some(isSourceDirty)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  bridgeOnEditorClose(async () => {
    for (const tab of [...state.tabs]) {
      if (!(await confirmSourceDiscard(tab))) return;
      forgetSourceDraft(tab);
    }
    bridgeCloseEditorWindow();
  });
  syncSourceEditor();
}
