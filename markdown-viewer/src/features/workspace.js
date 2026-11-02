// @ts-check
import {
  DOCUMENT_MAX_BYTES,
  assertDocumentSize,
} from '../core/document-limits.js';
// Workspace (folder) mode. Open a folder and browse its markdown files from an
// in-app sidebar (rendered as a collapsible tree), click a file to open it, and
// follow relative `.md` links between documents.
//
// Two backends, same UI:
//   - Desktop (Electron): the main process scans the folder and resolves links
//     by absolute path over the `window.specdown` bridge. Files carry `path`.
//   - Web (Chromium): the File System Access API (`showDirectoryPicker`) scans
//     the folder in-page; files carry a `handle` read on open, and relative
//     links resolve within the loaded file set. Other browsers (no API) simply
//     don't show the Open Folder button.

import { state } from '../core/state.js';
import { isDesktop, isIOSNative } from '../core/platform.js';
import { showToast } from './toast.js';
import {
  hasDesktopBridge,
  bridgeRequestWorkspaceFile,
  bridgeRequestCloseWorkspace,
  bridgeOnWorkspaceClosed,
  bridgeRequestOpenFolder,
  bridgeRequestOpenRelative,
  bridgeOnWorkspaceOpened,
} from '../platform/bridge.js';

const wsEl = (/** @type {string} */ id) => document.getElementById(id);

const MARKDOWN_LINK_RE = /\.(md|markdown)$/i;

// Bounds + noise filter for the web directory scan (mirrors the desktop scan).
const WS_WEB_IGNORE = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.cache',
  '.vite',
  '.idea',
  '.vscode',
]);
const WS_MAX_DEPTH = 8;
const WS_MAX_FILES = 2000;

/**
 * @typedef {object} WorkspaceFile
 * @property {string} name Basename.
 * @property {string} relPath Path relative to the workspace root (display + tree).
 * @property {string} [path] Absolute path on disk (desktop only).
 * @property {any} [handle] FileSystemFileHandle (web only).
 */

/**
 * @typedef {object} Workspace
 * @property {string} root
 * @property {WorkspaceFile[]} files
 * @property {string} [id] Desktop context identity.
 * @property {number} [generation] Desktop context revision.
 */

/** @type {WorkspaceFile[]} */
let workspaceFiles = [];
let workspaceSidebarVisible = false;
/** Relative path of the doc currently shown (for highlight + web link resolve). */
let currentWorkspaceRelPath = '';
let workspaceLoaded = false;
let workspaceId = '';
let workspaceEpoch = 0;
let workspacePickerEpoch = 0;
let workspaceReadEpoch = 0;
let workspaceNativeGeneration = -1;
let workspaceClosePending = false;
/** @type {Map<number, string>} Accepted web tab identity → relative path. */
const workspaceTabPaths = new Map();
// A weak origin marker survives Close so relative links in retained documents
// cannot navigate the web app away. It retains no folder root, path or handle.
/** @type {WeakMap<object, number>} */
const workspaceDocumentContexts = new WeakMap();
/** Directory relPaths the user has collapsed in the tree. */
const collapsedDirs = new Set();

/** @type {(filePath: string, id: string) => void} */
let workspaceOpenPath = (filePath, id) => {
  bridgeRequestWorkspaceFile(filePath, id);
};
/** @type {(name: string, content: string, relPath: string) => boolean | void} */
let workspaceOpenFile = () => {};

/**
 * @param {{ openPath?: (filePath: string, id: string) => void,
 *           openFile?: (name: string, content: string, relPath: string) => boolean | void }} [deps]
 */
export function configureWorkspace(deps) {
  if (deps && typeof deps.openPath === 'function')
    workspaceOpenPath = deps.openPath;
  if (deps && typeof deps.openFile === 'function')
    workspaceOpenFile = deps.openFile;
}

/** Whether the browser supports the File System Access directory picker. */
function isWebFolderSupported() {
  return (
    !isIOSNative &&
    typeof window !== 'undefined' &&
    typeof (/** @type {any} */ (window).showDirectoryPicker) === 'function'
  );
}

/**
 * Whether dragging a folder onto the page can open it (Chromium File System
 * Access). Lets callers keep a synchronous file-drop path on browsers without
 * the API instead of always deferring through the async folder check.
 * @returns {boolean}
 */
export function isFolderDragDropSupported() {
  return isWebFolderSupported();
}

/** Whether folder commands are supported on this surface. */
export function canOpenWorkspaceFolder() {
  return isDesktop || isWebFolderSupported();
}

/** Open a folder: native picker on desktop, File System Access on the web. */
export function openWorkspaceFolder() {
  if (isDesktop) {
    bridgeRequestOpenFolder();
  } else if (isWebFolderSupported()) {
    return pickWebFolder();
  }
}

/**
 * Recursively collect markdown files from a directory handle (web).
 * @param {any} dirHandle
 * @param {string} prefix
 * @param {WorkspaceFile[]} out
 * @param {number} depth
 */
async function scanDirectoryHandle(dirHandle, prefix, out, depth) {
  if (depth > WS_MAX_DEPTH || out.length >= WS_MAX_FILES) return;
  for await (const entry of dirHandle.values()) {
    if (out.length >= WS_MAX_FILES) break;
    if (entry.kind === 'directory') {
      if (entry.name.startsWith('.') || WS_WEB_IGNORE.has(entry.name)) continue;
      await scanDirectoryHandle(
        entry,
        `${prefix}${entry.name}/`,
        out,
        depth + 1
      );
    } else if (entry.kind === 'file' && MARKDOWN_LINK_RE.test(entry.name)) {
      out.push({
        name: entry.name,
        relPath: `${prefix}${entry.name}`,
        handle: entry,
      });
    }
  }
}

/** Show the web folder picker, scan it, and adopt the workspace. */
async function pickWebFolder() {
  const operation = ++workspacePickerEpoch;
  const w = /** @type {any} */ (window);
  let dirHandle;
  try {
    dirHandle = await w.showDirectoryPicker();
    if (operation !== workspacePickerEpoch) return;
  } catch {
    return; // user dismissed the picker
  }
  /** @type {WorkspaceFile[]} */
  const files = [];
  try {
    await scanDirectoryHandle(dirHandle, '', files, 0);
  } catch {
    if (operation === workspacePickerEpoch)
      showToast('Could not read the folder.', { type: 'error' });
    return;
  }
  if (operation !== workspacePickerEpoch) return;
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  if (files.length === 0) {
    showToast('No markdown files found in that folder.', { type: 'warning' });
  }
  applyWorkspace({ root: dirHandle.name || '', files });
}

/**
 * Open a folder dragged onto the web app as a workspace. Uses the File System
 * Access drag-and-drop entry point (`DataTransferItem.getAsFileSystemHandle`,
 * Chromium): the handle promises must be captured *synchronously* within the
 * drop event (the items are invalidated after the event tick), which is why the
 * sync portion of this async function pulls them before the first `await`.
 * Resolves to `true` when a directory was found and adopted (so the caller skips
 * its normal file-drop handling), `false` otherwise.
 * @param {DataTransfer | null} dataTransfer
 * @returns {Promise<boolean>}
 */
export async function tryOpenDroppedFolder(dataTransfer) {
  if (!isWebFolderSupported() || !dataTransfer) return false;
  const items = dataTransfer.items;
  if (!items || items.length === 0) return false;

  // Synchronous: grab the handle promises before the event is consumed.
  const handlePromises = [];
  for (const item of items) {
    if (
      item.kind === 'file' &&
      typeof (/** @type {any} */ (item).getAsFileSystemHandle) === 'function'
    ) {
      handlePromises.push(/** @type {any} */ (item).getAsFileSystemHandle());
    }
  }
  if (handlePromises.length === 0) return false;
  const operation = ++workspacePickerEpoch;

  let dirHandle = null;
  for (const p of handlePromises) {
    try {
      const h = await p;
      if (operation !== workspacePickerEpoch) return true;
      if (h && h.kind === 'directory') {
        dirHandle = h;
        break;
      }
    } catch {
      if (operation !== workspacePickerEpoch) return true;
      // ignore an unreadable item; keep checking the rest
    }
  }
  if (operation !== workspacePickerEpoch) return true;
  if (!dirHandle) return false;

  /** @type {WorkspaceFile[]} */
  const files = [];
  try {
    await scanDirectoryHandle(dirHandle, '', files, 0);
  } catch {
    if (operation === workspacePickerEpoch)
      showToast('Could not read the folder.', { type: 'error' });
    return true; // it was a folder — handled, albeit with an error
  }
  if (operation !== workspacePickerEpoch) return true;
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  if (files.length === 0) {
    showToast('No markdown files found in that folder.', { type: 'warning' });
  }
  applyWorkspace({ root: dirHandle.name || '', files });
  return true;
}

/**
 * Adopt a scanned workspace (desktop IPC or web picker) and show its sidebar.
 * Opens the first file (preferring a top-level README) so the content area —
 * which hosts the sidebar — becomes visible.
 * @param {Workspace} workspace
 */
export function applyWorkspace(workspace) {
  if (!workspace || !Array.isArray(workspace.files)) return;
  workspaceEpoch += 1;
  workspaceReadEpoch += 1;
  workspacePickerEpoch += 1;
  workspaceTabPaths.clear();
  currentWorkspaceRelPath = '';
  workspaceLoaded = true;
  workspaceId = workspace.id || '';
  workspaceFiles = workspace.files;
  workspaceSidebarVisible = true;
  collapsedDirs.clear();
  renderWorkspaceSidebar();

  if (workspaceFiles.length === 0) return;
  // Only auto-open when nothing is already open, so re-scanning while reading
  // doesn't yank the user off their current document.
  if (state.tabs.length === 0) {
    const readme = workspaceFiles.find((f) =>
      /^readme\.(md|markdown)$/i.test(f.name)
    );
    openWorkspaceEntry(readme || workspaceFiles[0]);
  }
}

/**
 * Open a workspace file by its backend: desktop path or web handle.
 * @param {WorkspaceFile | undefined} entry
 */
function openWorkspaceEntry(entry) {
  if (!entry || !workspaceLoaded || !workspaceFiles.includes(entry)) return;
  if (entry.handle) {
    readHandleAndOpen(entry);
  } else if (entry.path) {
    workspaceOpenPath(entry.path, workspaceId);
  }
}

/**
 * Read a web file handle and hand its contents to the tab layer.
 * @param {WorkspaceFile} entry
 */
async function readHandleAndOpen(entry) {
  const epoch = workspaceEpoch;
  const read = ++workspaceReadEpoch;
  const isCurrent = () =>
    epoch === workspaceEpoch &&
    read === workspaceReadEpoch &&
    workspaceFiles.includes(entry);
  try {
    const file = await entry.handle.getFile();
    if (!isCurrent()) return;
    if (file.size > DOCUMENT_MAX_BYTES)
      throw new Error(
        'This document is too large. SpecDown supports files up to 8 MiB.'
      );
    const text = await file.text();
    if (!isCurrent()) return;
    assertDocumentSize(text);
    if (
      workspaceOpenFile(entry.name, text, entry.relPath) === true &&
      state.activeTabId !== null
    ) {
      workspaceTabPaths.set(state.activeTabId, entry.relPath);
      noteWorkspaceDocumentTab();
      currentWorkspaceRelPath = entry.relPath;
      renderWorkspaceSidebar();
    }
  } catch (error) {
    if (!isCurrent()) return;
    showToast(
      error instanceof Error ? error.message : 'Could not open the file.',
      { type: 'error' }
    );
  }
}

/** The active tab's file path, or '' when none (desktop). */
function activeWorkspacePath() {
  const tab =
    state.activeTabId !== null
      ? state.tabs.find((t) => t.id === state.activeTabId)
      : null;
  return tab && tab.filePath ? tab.filePath : '';
}

/**
 * Build a nested tree (directories first, then files; each level sorted) from
 * the flat workspace file list. Pure — exported for testing.
 * @param {WorkspaceFile[]} files
 * @returns {Array<{type:'dir',name:string,relPath:string,children:any[]} | {type:'file',name:string,relPath:string,file:WorkspaceFile}>}
 */
export function buildWorkspaceTree(files) {
  const rootDir = {
    dirs: /** @type {Record<string, any>} */ (Object.create(null)),
    files: /** @type {WorkspaceFile[]} */ ([]),
  };
  for (const f of files) {
    const parts = f.relPath.split('/').filter(Boolean);
    let cur = rootDir;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!cur.dirs[seg]) {
        cur.dirs[seg] = {
          name: seg,
          relPath: parts.slice(0, i + 1).join('/'),
          dirs: Object.create(null),
          files: [],
        };
      }
      cur = cur.dirs[seg];
    }
    cur.files.push(f);
  }
  /** @param {any} node @returns {any[]} */
  const serialize = (node) => {
    const dirs = Object.values(node.dirs)
      .sort((/** @type {any} */ a, /** @type {any} */ b) =>
        a.name.localeCompare(b.name)
      )
      .map((/** @type {any} */ d) => ({
        type: 'dir',
        name: d.name,
        relPath: d.relPath,
        children: serialize(d),
      }));
    const fileNodes = node.files
      .slice()
      .sort((/** @type {any} */ a, /** @type {any} */ b) =>
        a.name.localeCompare(b.name)
      )
      .map((/** @type {any} */ f) => ({
        type: 'file',
        name: f.name,
        relPath: f.relPath,
        file: f,
      }));
    return [...dirs, ...fileNodes];
  };
  return serialize(rootDir);
}

/**
 * Resolve a relative href against a source document's relative path, normalizing
 * `.`/`..`. Pure — exported for testing.
 * @param {string} fromRelPath
 * @param {string} href
 * @returns {string}
 */
export function resolveRelativeRelPath(fromRelPath, href) {
  let clean = String(href || '')
    .split('#')[0]
    .split('?')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave as-is on bad encoding
  }
  if (!clean) return '';
  const stack = String(fromRelPath || '')
    .split('/')
    .slice(0, -1);
  for (const part of clean.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

/** Render the workspace tree, hiding the sidebar when inactive/empty. */
export function renderWorkspaceSidebar() {
  const sidebar = wsEl('workspace-sidebar');
  const list = wsEl('workspace-file-list');
  if (!sidebar || !list) return;

  const toggle = wsEl('workspace-toggle');
  if (toggle) {
    toggle.style.display = workspaceLoaded ? '' : 'none';
    toggle.classList.toggle(
      'active',
      workspaceLoaded && workspaceSidebarVisible
    );
    toggle.setAttribute(
      'aria-pressed',
      String(workspaceLoaded && workspaceSidebarVisible)
    );
  }
  const closeEmpty = wsEl('close-folder-empty-button');
  if (closeEmpty) closeEmpty.style.display = workspaceLoaded ? '' : 'none';
  list.replaceChildren();
  if (!workspaceSidebarVisible || !workspaceLoaded) {
    sidebar.style.display = 'none';
    return;
  }
  sidebar.style.display = '';

  const activePath = activeWorkspacePath();
  if (workspaceFiles.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'workspace-empty';
    empty.textContent = 'No Markdown files in this folder.';
    list.appendChild(empty);
  }
  for (const id of workspaceTabPaths.keys()) {
    if (!state.tabs.some((tab) => tab.id === id)) workspaceTabPaths.delete(id);
  }
  currentWorkspaceRelPath =
    state.activeTabId === null
      ? ''
      : workspaceTabPaths.get(state.activeTabId) || '';
  renderTreeNodes(buildWorkspaceTree(workspaceFiles), list, activePath);
}

/** @param {any[]} nodes @param {HTMLElement} container @param {string} activePath */
function renderTreeNodes(nodes, container, activePath) {
  const epoch = workspaceEpoch;
  for (const node of nodes) {
    const li = document.createElement('li');

    if (node.type === 'dir') {
      const collapsed = collapsedDirs.has(node.relPath);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'workspace-dir-item';
      btn.title = node.relPath;
      btn.setAttribute('aria-expanded', String(!collapsed));

      const caret = document.createElement('span');
      caret.className = 'workspace-caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = collapsed ? '▸' : '▾';
      const label = document.createElement('span');
      label.className = 'workspace-dir-name';
      label.textContent = node.name;
      btn.append(caret, label);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (epoch === workspaceEpoch && workspaceLoaded)
          toggleDir(node.relPath);
      });
      li.appendChild(btn);

      const childUl = document.createElement('ul');
      childUl.className = 'workspace-tree';
      if (collapsed) childUl.style.display = 'none';
      renderTreeNodes(node.children, childUl, activePath);
      li.appendChild(childUl);
    } else {
      const f = node.file;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'workspace-file-item';
      const isActive =
        (f.path && f.path === activePath) ||
        (f.relPath && f.relPath === currentWorkspaceRelPath);
      if (isActive) btn.classList.add('workspace-file-active');
      btn.textContent = node.name;
      btn.title = node.relPath;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (epoch === workspaceEpoch) openWorkspaceEntry(f);
      });
      li.appendChild(btn);
    }

    container.appendChild(li);
  }
}

/** @param {string} relPath */
function toggleDir(relPath) {
  if (collapsedDirs.has(relPath)) collapsedDirs.delete(relPath);
  else collapsedDirs.add(relPath);
  renderWorkspaceSidebar();
}

/** Toggle the workspace sidebar (when a workspace is active). */
export function toggleWorkspaceSidebar() {
  if (!workspaceLoaded) return;
  workspaceSidebarVisible = !workspaceSidebarVisible;
  const toggle = wsEl('workspace-toggle');
  if (toggle) toggle.classList.toggle('active', workspaceSidebarVisible);
  renderWorkspaceSidebar();
}

/** Whether a workspace folder is currently loaded. */
export function hasWorkspace() {
  return workspaceLoaded;
}

/** Clear only workspace navigation; existing document/view state stays intact. */
function clearWorkspaceNavigation() {
  const focused = document.activeElement;
  const restoreFocus =
    focused instanceof HTMLElement &&
    (!!focused.closest('#workspace-sidebar') ||
      focused.id === 'close-folder-empty-button' ||
      focused.id === 'workspace-toggle');
  workspaceEpoch += 1;
  workspacePickerEpoch += 1;
  workspaceReadEpoch += 1;
  workspaceLoaded = false;
  workspaceId = '';
  workspaceFiles = [];
  workspaceSidebarVisible = false;
  currentWorkspaceRelPath = '';
  workspaceTabPaths.clear();
  collapsedDirs.clear();
  renderWorkspaceSidebar();
  if (restoreFocus) {
    const content = wsEl('content-area');
    const target =
      content?.style.display !== 'none'
        ? wsEl('overflow-toggle')
        : wsEl('open-folder-button');
    target?.focus({ preventScroll: true });
  }
}

/** Close the folder without closing documents or revoking their file access. */
export function closeWorkspaceFolder() {
  if (isDesktop && workspaceClosePending) return;
  if (isDesktop) workspaceClosePending = true;
  clearWorkspaceNavigation();
  if (isDesktop) bridgeRequestCloseWorkspace();
}

/** Workspace-origin file messages queued before Close must not create tabs. */
/** @param {unknown} id */
export function isCurrentWorkspaceFileOpen(id) {
  return (
    typeof id === 'string' &&
    !!id &&
    !workspaceClosePending &&
    workspaceLoaded &&
    id === workspaceId
  );
}

/** Record accepted tab ownership without retaining file or directory handles. */
export function noteWorkspaceDocumentTab() {
  const tab = state.tabs.find(
    (candidate) => candidate.id === state.activeTabId
  );
  if (tab && workspaceLoaded)
    workspaceDocumentContexts.set(tab, workspaceEpoch);
}

/**
 * Follow a relative markdown link clicked inside a workspace document. On
 * desktop the shell resolves it by absolute path; on the web it resolves within
 * the loaded file set. Absolute/external/anchor/non-markdown links are ignored.
 * @param {Event} e
 */
export function handleWorkspaceLinkClick(e) {
  const target = /** @type {HTMLElement} */ (e.target);
  const anchor = target && target.closest ? target.closest('a') : null;
  if (!anchor) return;

  // Prefer the literal attribute over `.href`, which the browser absolutizes.
  const href = anchor.getAttribute('href') || '';
  if (!href || href.startsWith('#')) return;
  // Skip protocols (http:, mailto:, file:, …) and protocol-relative links.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return;
  if (!MARKDOWN_LINK_RE.test(href.split('#')[0].split('?')[0])) return;

  const tab = state.tabs.find(
    (candidate) => candidate.id === state.activeTabId
  );
  const origin = tab && workspaceDocumentContexts.get(tab);
  if (origin !== undefined && (!workspaceLoaded || origin !== workspaceEpoch)) {
    e.preventDefault();
    showToast('Open this document from its folder to follow links.', {
      type: 'info',
    });
    return;
  }
  if (!hasWorkspace()) return;

  if (isDesktop && hasDesktopBridge()) {
    const fromPath = activeWorkspacePath();
    if (!fromPath) return;
    e.preventDefault();
    bridgeRequestOpenRelative(fromPath, href, workspaceId);
    return;
  }

  // Web: resolve against the current doc's relPath and open the matching entry.
  const activeRelPath =
    state.activeTabId === null ? '' : workspaceTabPaths.get(state.activeTabId);
  if (activeRelPath) {
    const targetRel = resolveRelativeRelPath(activeRelPath, href);
    const entry = workspaceFiles.find((f) => f.relPath === targetRel);
    e.preventDefault();
    if (entry) openWorkspaceEntry(entry);
    else
      showToast('That document is not in the open folder.', {
        type: 'warning',
      });
  }
}

/** Wire the open-folder entry points, the IPC listener, and relative links. */
export function setupWorkspace() {
  // Show the Open Folder button where a folder can actually be opened:
  // the Electron shell, or a browser with the File System Access API.
  const openBtn = wsEl('open-folder-button');
  if (openBtn) {
    if (canOpenWorkspaceFolder()) openBtn.style.display = '';
    openBtn.addEventListener('click', (e) => {
      // Stop the drop-zone's click-to-browse handler from also firing.
      e.stopPropagation();
      openWorkspaceFolder();
    });
  }

  const toggle = wsEl('workspace-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => toggleWorkspaceSidebar());
  }

  for (const id of ['workspace-close-button', 'close-folder-empty-button']) {
    wsEl(id)?.addEventListener('click', (event) => {
      event.stopPropagation();
      closeWorkspaceFolder();
    });
  }

  // Main sends ordered context revisions. The local close barrier also rejects
  // a queued replacement snapshot we had not seen when Close was clicked.
  bridgeOnWorkspaceOpened((workspace) => {
    if (
      workspaceClosePending ||
      !workspace ||
      typeof workspace.id !== 'string' ||
      !Number.isSafeInteger(workspace.generation) ||
      workspace.generation <= workspaceNativeGeneration
    )
      return;
    workspaceNativeGeneration = workspace.generation;
    applyWorkspace(workspace);
  });
  bridgeOnWorkspaceClosed((info) => {
    if (
      !info ||
      !Number.isSafeInteger(info.generation) ||
      info.generation <= workspaceNativeGeneration
    )
      return;
    workspaceNativeGeneration = info.generation;
    workspaceClosePending = false;
    clearWorkspaceNavigation();
  });

  // Follow relative markdown links between workspace documents.
  const content = wsEl('markdown-content');
  if (content) {
    content.addEventListener('click', handleWorkspaceLinkClick);
  }
}
