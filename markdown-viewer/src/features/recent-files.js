// @ts-check
// Recent files: remember recently-opened documents and offer one-click re-open
// from the header More menu's Open Recent dialog. Persisted in localStorage.
//
// Scope: things the app can actually re-open without a fresh user pick:
//   - 'url'  — any fetchable URL (incl. GitHub raw links).
//   - 'path' — a local file path, only on the desktop (Electron) shell, where
//     the main process can re-read it by path. Browser-picked local files
//     can't be reopened by path (the File System Access security model), so on
//     the web they are intentionally not recorded.

import { trapFocus } from '../core/focus-trap.js';

const RECENT_KEY = 'specdown-recent-files';
const RECENT_MAX = 8;
const el = (/** @type {string} */ id) => document.getElementById(id);

/**
 * @typedef {object} RecentEntry
 * @property {'url' | 'path'} type
 * @property {string} ref The re-openable reference (a URL or a local file path).
 * @property {string} title Display label.
 */

/** @type {RecentEntry[]} */
let recentEntries = loadRecent();
/** @type {(entry: RecentEntry) => void} */
let selectRecent = () => {};
/** @type {HTMLElement | null} */
let recentFilesOverlay = null;
/** @type {HTMLElement | null} */
let recentFilesPreviousFocus = null;
/** @type {(() => void) | null} */
let recentFilesReleaseFocus = null;

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRecent() {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentEntries));
  } catch {
    // quota / unavailable — non-critical
  }
}

/** @param {{ onSelect?: (entry: RecentEntry) => void }} [deps] */
export function configureRecentFiles(deps) {
  if (deps && typeof deps.onSelect === 'function') selectRecent = deps.onSelect;
}

/** Bind the global header menu separately from the document-actions menu. */
export function setupRecentFiles() {
  const recentHeaderToggle = el('header-more-toggle');
  const recentHeaderMenu = el('header-more-menu');
  const recentMenuItem = el('open-recent-button');
  const recentHeaderPicker = recentHeaderToggle?.closest('.header-more-picker');
  if (
    !recentHeaderToggle ||
    !recentHeaderMenu ||
    !recentMenuItem ||
    !recentHeaderPicker
  )
    return;

  /** @param {boolean} open @param {boolean} [restoreFocus] */
  const recentSetHeaderMenuOpen = (open, restoreFocus = false) => {
    recentHeaderMenu.hidden = !open;
    recentHeaderToggle.setAttribute('aria-expanded', String(open));
    if (restoreFocus) recentHeaderToggle.focus();
  };

  recentSetHeaderMenuOpen(false);
  recentHeaderToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const recentOpeningMenu = !!recentHeaderMenu.hidden;
    recentSetHeaderMenuOpen(recentOpeningMenu, !recentOpeningMenu);
    if (recentOpeningMenu) recentMenuItem.focus();
  });
  recentHeaderPicker.addEventListener('keydown', (event) => {
    const recentKeyEvent = /** @type {KeyboardEvent} */ (event);
    if (
      recentKeyEvent.key === 'ArrowDown' ||
      recentKeyEvent.key === 'ArrowUp'
    ) {
      recentKeyEvent.preventDefault();
      recentKeyEvent.stopPropagation();
      recentSetHeaderMenuOpen(true);
      recentMenuItem.focus();
    } else if (!recentHeaderMenu.hidden && recentKeyEvent.key === 'Escape') {
      recentKeyEvent.preventDefault();
      recentKeyEvent.stopPropagation();
      recentSetHeaderMenuOpen(false, true);
    } else if (!recentHeaderMenu.hidden && recentKeyEvent.key === 'Tab') {
      recentKeyEvent.stopPropagation();
      // Restore the visible toggle, then let the browser continue normal Tab order.
      recentSetHeaderMenuOpen(false, true);
    }
  });
  document.addEventListener(
    'click',
    (event) => {
      if (
        !recentHeaderMenu.hidden &&
        event.target instanceof Node &&
        !recentHeaderPicker.contains(event.target)
      ) {
        recentSetHeaderMenuOpen(false);
      }
    },
    true
  );
  recentMenuItem.addEventListener('click', (event) => {
    event.stopPropagation();
    recentSetHeaderMenuOpen(false, true);
    openRecentFiles();
  });
}

/** @returns {RecentEntry[]} */
export function getRecentFiles() {
  return recentEntries.slice();
}

/**
 * Record a freshly-opened document at the top of the recents (most-recent-first,
 * de-duplicated by ref, capped). Defaults to a URL entry for backward
 * compatibility; desktop file opens pass `type: 'path'`.
 * @param {{ type?: 'url' | 'path', ref: string, title?: string }} entry
 */
export function recordRecentFile(entry) {
  if (!entry || !entry.ref) return;
  const type = entry.type === 'path' ? 'path' : 'url';
  recentEntries = recentEntries.filter((e) => e.ref !== entry.ref);
  recentEntries.unshift({
    type,
    ref: entry.ref,
    title: entry.title || entry.ref,
  });
  if (recentEntries.length > RECENT_MAX) {
    recentEntries = recentEntries.slice(0, RECENT_MAX);
  }
  persistRecent();
}

export function clearRecentFiles() {
  recentEntries = [];
  persistRecent();
}

/**
 * Session restore: re-open the most recently opened document via the configured
 * `onSelect`. No-op when there's nothing to restore. Callers gate this to the
 * web surface (the native shells have their own session handling).
 */
export function restoreLastSession() {
  if (recentEntries.length > 0) {
    selectRecent(recentEntries[0]);
  }
}

export function closeRecentFiles() {
  recentFilesReleaseFocus?.();
  recentFilesReleaseFocus = null;
  recentFilesOverlay?.remove();
  recentFilesOverlay = null;
  recentFilesPreviousFocus?.focus();
  recentFilesPreviousFocus = null;
}

/** Open history separately from the welcome card so it never changes its size. */
export function openRecentFiles() {
  if (recentFilesOverlay) return;
  recentFilesPreviousFocus = /** @type {HTMLElement | null} */ (
    document.activeElement
  );

  const recentOverlay = document.createElement('div');
  recentOverlay.className = 'recent-files-overlay';
  const recentDialog = document.createElement('section');
  recentDialog.className = 'recent-files-dialog';
  recentDialog.setAttribute('role', 'dialog');
  recentDialog.setAttribute('aria-modal', 'true');
  recentDialog.setAttribute('aria-label', 'Open Recent');

  const recentHeader = document.createElement('div');
  recentHeader.className = 'recent-files-header';
  const recentTitle = document.createElement('h2');
  recentTitle.textContent = 'Open Recent';
  const recentClose = document.createElement('button');
  recentClose.type = 'button';
  recentClose.className = 'sample-button recent-files-close';
  recentClose.textContent = 'Close';
  recentClose.addEventListener('click', closeRecentFiles);
  recentHeader.append(recentTitle, recentClose);

  const recentList = document.createElement('ul');
  recentList.id = 'recent-files-list';
  recentList.className = 'recent-files-list';
  const recentEmpty = document.createElement('p');
  recentEmpty.id = 'recent-files-empty';
  recentEmpty.setAttribute('role', 'status');

  const recentClear = document.createElement('button');
  recentClear.id = 'recent-files-clear';
  recentClear.type = 'button';
  recentClear.className = 'recent-files-clear';
  recentClear.textContent = 'Clear history';
  recentClear.addEventListener('click', () => {
    clearRecentFiles();
    renderRecentFiles();
    recentClose.focus();
  });

  recentDialog.append(recentHeader, recentList, recentEmpty, recentClear);
  recentOverlay.append(recentDialog);
  recentOverlay.addEventListener('click', (event) => {
    if (event.target === recentOverlay) closeRecentFiles();
  });
  recentOverlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRecentFiles();
    }
    // Keep document shortcuts from opening another surface under this dialog.
    event.stopPropagation();
  });
  recentFilesOverlay = recentOverlay;
  document.body.append(recentOverlay);
  renderRecentFiles();
  recentFilesReleaseFocus = trapFocus(recentOverlay);
  const recentFirst = recentList.querySelector('button');
  (recentFirst || recentClose).focus();
}

/** Refresh an open history dialog after recording a file; the home stays compact. */
export function renderRecentFiles() {
  if (!recentFilesOverlay) return;
  const list = el('recent-files-list');
  const empty = el('recent-files-empty');
  const clear = /** @type {HTMLButtonElement | null} */ (
    el('recent-files-clear')
  );
  if (!list || !empty || !clear) return;

  const recentHadListFocus = list.contains(document.activeElement);
  const recentFocusedRef = document.activeElement?.getAttribute('data-ref');
  list.innerHTML = '';
  empty.textContent = recentEntries.length === 0 ? 'No recent files yet.' : '';
  empty.hidden = recentEntries.length > 0;
  list.hidden = recentEntries.length === 0;
  clear.disabled = recentEntries.length === 0;

  for (const entry of recentEntries) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-file-item';
    btn.dataset.type = entry.type;
    btn.dataset.ref = entry.ref;
    btn.textContent = entry.title;
    btn.title = entry.ref;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeRecentFiles();
      selectRecent(entry);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }

  if (recentHadListFocus) {
    const recentFocusTarget =
      Array.from(list.querySelectorAll('button')).find(
        (button) => button.dataset.ref === recentFocusedRef
      ) ||
      list.querySelector('button') ||
      recentFilesOverlay.querySelector('button');
    recentFocusTarget?.focus();
  }
}
