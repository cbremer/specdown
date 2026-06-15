// @ts-check
// Workspace (folder) mode — desktop only. Open a folder and browse its markdown
// files from an in-app sidebar; click a file to open it in a tab, and follow
// relative `.md` links between documents.
//
// The heavy lifting (scanning the folder, resolving relative links) lives in the
// Electron main process; this module owns the sidebar UI and the click wiring.
// The shared web/iOS surfaces have no `window.specdown` bridge, so the entry
// points here are inert there (the open-folder button is shown only on desktop).

import { state } from '../core/state.js';
import { isDesktop } from '../core/platform.js';

const wsEl = (/** @type {string} */ id) => document.getElementById(id);

const MARKDOWN_LINK_RE = /\.(md|markdown)$/i;

/**
 * @typedef {object} WorkspaceFile
 * @property {string} path Absolute path on disk.
 * @property {string} relPath Path relative to the workspace root (display).
 * @property {string} name Basename.
 */

/**
 * @typedef {object} Workspace
 * @property {string} root
 * @property {WorkspaceFile[]} files
 */

/** @type {string} */
let workspaceRoot = '';
/** @type {WorkspaceFile[]} */
let workspaceFiles = [];
let workspaceSidebarVisible = false;

/** @type {(filePath: string) => void} */
let workspaceOpenPath = (filePath) => {
  window.specdown?.requestOpenPath?.(filePath);
};

/** @param {{ openPath?: (filePath: string) => void }} [deps] */
export function configureWorkspace(deps) {
  if (deps && typeof deps.openPath === 'function') {
    workspaceOpenPath = deps.openPath;
  }
}

/** Ask the desktop shell to show its folder picker. No-op off desktop. */
export function openWorkspaceFolder() {
  window.specdown?.requestOpenFolder?.();
}

/**
 * Adopt a scanned workspace (from the desktop shell) and show its sidebar.
 * Opens the first file (preferring a top-level README) so the content area —
 * which hosts the sidebar — becomes visible.
 * @param {Workspace} workspace
 */
export function applyWorkspace(workspace) {
  if (!workspace || !Array.isArray(workspace.files)) return;
  workspaceRoot = workspace.root || '';
  workspaceFiles = workspace.files;
  workspaceSidebarVisible = workspaceFiles.length > 0;
  renderWorkspaceSidebar();

  if (workspaceFiles.length === 0) return;
  // Only auto-open when nothing is already open, so re-scanning while reading
  // doesn't yank the user off their current document.
  if (state.tabs.length === 0) {
    const readme = workspaceFiles.find((f) => /^readme\.(md|markdown)$/i.test(f.name));
    workspaceOpenPath((readme || workspaceFiles[0]).path);
  }
}

/** The active tab's file path, or '' when none. */
function activeWorkspacePath() {
  const tab = state.activeTabId !== null ? state.tabs.find((t) => t.id === state.activeTabId) : null;
  return tab && tab.filePath ? tab.filePath : '';
}

/** Render the workspace file list, hiding the sidebar when inactive/empty. */
export function renderWorkspaceSidebar() {
  const sidebar = wsEl('workspace-sidebar');
  const list = wsEl('workspace-file-list');
  if (!sidebar || !list) return;

  if (!workspaceSidebarVisible || workspaceFiles.length === 0) {
    sidebar.style.display = 'none';
    return;
  }
  sidebar.style.display = '';

  const active = activeWorkspacePath();
  list.innerHTML = '';
  for (const file of workspaceFiles) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'workspace-file-item';
    if (file.path === active) btn.classList.add('workspace-file-active');
    btn.textContent = file.relPath;
    btn.title = file.relPath;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      workspaceOpenPath(file.path);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

/** Toggle the workspace sidebar (when a workspace is active). */
export function toggleWorkspaceSidebar() {
  if (workspaceFiles.length === 0) return;
  workspaceSidebarVisible = !workspaceSidebarVisible;
  const toggle = wsEl('workspace-toggle');
  if (toggle) toggle.classList.toggle('active', workspaceSidebarVisible);
  renderWorkspaceSidebar();
}

/** Whether a workspace folder is currently loaded. */
export function hasWorkspace() {
  return workspaceFiles.length > 0;
}

/**
 * Intercept clicks on relative markdown links inside the rendered document and
 * route them to the desktop shell, which resolves the path against the source
 * document's folder and opens it. Absolute/external/anchor links are left alone.
 * @param {Event} e
 */
export function handleWorkspaceLinkClick(e) {
  if (!isDesktop || !hasWorkspace()) return;
  const target = /** @type {HTMLElement} */ (e.target);
  const anchor = target && target.closest ? target.closest('a') : null;
  if (!anchor) return;

  // Prefer the literal attribute over the resolved `.href` property, which the
  // browser turns into an absolute file:// URL.
  const href = anchor.getAttribute('href') || '';
  if (!href || href.startsWith('#')) return;
  // Only handle relative links — skip protocols (http:, mailto:, file:, …).
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return;
  if (!MARKDOWN_LINK_RE.test(href.split('#')[0].split('?')[0])) return;

  const fromPath = activeWorkspacePath();
  if (!fromPath) return;

  e.preventDefault();
  window.specdown?.requestOpenRelative?.(fromPath, href);
}

/** Wire the open-folder entry points, the IPC listener, and relative links. */
export function setupWorkspace() {
  // Show the desktop-only entry points and wire them.
  const openBtn = wsEl('open-folder-button');
  if (openBtn) {
    if (isDesktop) openBtn.style.display = '';
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

  // Receive scanned folders from the desktop shell.
  window.specdown?.onWorkspaceOpened?.((workspace) => applyWorkspace(workspace));

  // Follow relative markdown links between workspace documents.
  const content = wsEl('markdown-content');
  if (content) {
    content.addEventListener('click', handleWorkspaceLinkClick);
  }
}
