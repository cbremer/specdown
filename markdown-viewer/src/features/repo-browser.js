// @ts-check
// GitHub repo file browser: accept a github.com/<owner>/<repo> URL and show a
// list of the repo's markdown files to pick from.
//
// Decoupled from the rest of the app via dependency injection — the caller
// supplies the URL-error UI hooks and the file-selection handler.

import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { fetchGitHubRepoFiles, parsePublicRepoUrl } from './repo-api.js';

import { trapFocus } from '../core/focus-trap.js';
import { platformIsTouchFirst } from '../core/platform.js';
import { iconSvg } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';

/**
 * @typedef {object} RepoFile
 * @property {string} path
 * @property {string} url
 * @property {string} rawUrl
 */

let repoBrowserRequest = 0;

/**
 * Recognized repository failures stay in the repository flow, never fall
 * through to fetching the HTML repository page as Markdown.
 * @param {string} url
 * @param {{ clearError: Function, showError: Function, onSelectFile: Function, signal?: AbortSignal, deferPresentation?: (show: () => void) => void }} hooks
 * @returns {Promise<boolean>}
 */
export async function handleRepoUrl(
  url,
  { clearError, showError, onSelectFile, signal, deferPresentation }
) {
  const requestId = ++repoBrowserRequest;
  if (repoBrowserActiveClose) repoBrowserActiveClose();
  if (!parsePublicRepoUrl(url)) return false;
  const context = captureDocumentContext();
  const current = () =>
    requestId === repoBrowserRequest &&
    !signal?.aborted &&
    isDocumentContextCurrent(context);
  clearError();
  try {
    const files = await fetchGitHubRepoFiles(url, signal);
    if (!current()) return true;
    if (!files?.length)
      showError('No Markdown files found in this repository or folder.');
    else {
      const present = () => {
        if (!current()) return;
        showRepoBrowser(files, url, (/** @type {string} */ rawUrl) => {
          if (current()) onSelectFile(rawUrl);
        });
      };
      if (deferPresentation) deferPresentation(present);
      else present();
    }
  } catch (error) {
    if (current())
      showError(
        error instanceof Error
          ? error.message
          : 'Could not list the public repository. Try again later.'
      );
  }
  return true;
}

// Close handler for the currently-open browser instance. The backdrop click
// listener is bound ONCE (at modal creation) and delegates through this ref —
// binding it per open stacked a new listener (plus its captured focus-trap
// release) on the reused modal element every time the browser opened.
/** @type {(() => void) | null} */
let repoBrowserActiveClose = null;

/**
 * @param {RepoFile[]} files
 * @param {string} repoUrl
 * @param {Function} onSelectFile
 */
function showRepoBrowser(files, repoUrl, onSelectFile) {
  let modal = document.getElementById('repo-browser-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'repo-browser-modal';
    modal.className = 'repo-browser-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Repository file browser');
    modal.addEventListener('click', (e) => {
      if (e.target === modal && repoBrowserActiveClose)
        repoBrowserActiveClose();
    });
    document.body.appendChild(modal);
  }
  const panel = modal;

  // Re-opened while already open: release the previous instance's focus trap
  // before it gets orphaned by the innerHTML rebuild below.
  if (repoBrowserActiveClose) repoBrowserActiveClose();

  const repoName = repoUrl
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\/$/, '');

  panel.innerHTML = `
        <div class="repo-browser-content">
            <div class="repo-browser-header">
                <span class="repo-browser-title">${escapeHtml(repoName)}</span>
                <button class="repo-browser-close" title="Close" aria-label="Close file browser">&#10005;</button>
            </div>
            <div class="repo-browser-search">
                <input type="text" class="repo-browser-filter" placeholder="Filter files..." autocomplete="off">
            </div>
            <ul class="repo-browser-list">
                ${files
                  .map(
                    (f) => `
                    <li class="repo-browser-item" tabindex="0" role="button" data-raw-url="${escapeHtml(f.rawUrl)}">
                        <span class="repo-file-icon" aria-hidden="true">${iconSvg('file-text')}</span>
                        <span class="repo-file-path">${escapeHtml(f.path)}</span>
                    </li>
                `
                  )
                  .join('')}
            </ul>
        </div>
    `;
  panel.style.display = 'flex';
  const releaseTrap = trapFocus(panel);
  const closeModal = () => {
    releaseTrap();
    panel.style.display = 'none';
    repoBrowserActiveClose = null;
  };
  repoBrowserActiveClose = closeModal;

  // Inner elements are rebuilt by the innerHTML assignment above, so these
  // listeners are fresh per open (no stacking); only the backdrop listener on
  // the reused modal element itself must not be re-bound here.
  const closeBtn = panel.querySelector('.repo-browser-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  const filterInput = /** @type {HTMLInputElement | null} */ (
    panel.querySelector('.repo-browser-filter')
  );
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      const q = filterInput.value.toLowerCase();
      panel.querySelectorAll('.repo-browser-item').forEach((node) => {
        const item = /** @type {HTMLElement} */ (node);
        const pathEl = item.querySelector('.repo-file-path');
        const path = (pathEl?.textContent || '').toLowerCase();
        item.style.display = path.includes(q) ? '' : 'none';
      });
    });
    if (!platformIsTouchFirst()) filterInput.focus();
  }

  panel.querySelectorAll('.repo-browser-item').forEach((item) => {
    item.addEventListener('keydown', (event) => {
      const keyEvent = /** @type {KeyboardEvent} */ (event);
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        event.preventDefault();
        /** @type {HTMLElement} */ (item).click();
      }
    });
    item.addEventListener('click', () => {
      const rawUrl = item.getAttribute('data-raw-url');
      closeModal();
      onSelectFile(rawUrl);
    });
  });
}
