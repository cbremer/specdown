// @ts-check
// Loading markdown from local files (browse / drop) and from URLs (incl. the
// GitHub repo browser). Opening content creates a tab (tabs core, main.js),
// supplied via configureFileLoading.

import { normalizeMarkdownUrl } from '../core/utils.js';
import { handleRepoUrl } from './repo-browser.js';
import { showToast } from './toast.js';
import { recordRecentFile, renderRecentFiles } from './recent-files.js';
import { bridgeGetPathForFile } from '../platform/bridge.js';
import {
  htmlIsOpenableFilename,
  htmlExceedsReadCap,
  htmlRejectedOpenToast,
  htmlFileInputAccept,
  htmlDetectKind,
} from '../core/document-kind.js';

const el = (/** @type {string} */ id) => document.getElementById(id);

// Named uniquely (not a bare `openTab`): the test harness
// (tests/helpers/loadApp.js) flattens every module to global scope, so a
// module-top `openTab` here collides with the identically-named binding in
// share-links.js — whichever configure*() runs last wins the shared global, and
// this module's createTab (with its filePath/sourceMeta args) silently loses.
/** @type {(filename: string, content?: string, filePath?: string | null, sourceMeta?: import('../core/state.js').TabSourceMeta | null) => void} */
let openTabFromFile = () => {};

/** @param {{ createTab?: Function }} [deps] */
export function configureFileLoading(deps) {
  if (deps && typeof deps.createTab === 'function') {
    openTabFromFile = /** @type {typeof openTabFromFile} */ (deps.createTab);
  }
}

/** Widen or restore `#file-input` accept for the running build. */
export function htmlApplyFileInputAccept() {
  const input = /** @type {HTMLInputElement | null} */ (el('file-input'));
  if (input) input.accept = htmlFileInputAccept();
}

/** @param {Event} e */
export function handleFileSelect(e) {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const files = input.files;
  if (files) {
    for (let i = 0; i < files.length; i++) {
      handleFile(files[i]);
    }
  }
  // Reset so the same file can be re-opened in a new tab
  input.value = '';
}

/** @param {File} file */
export function handleFile(file) {
  if (!htmlIsOpenableFilename(file.name)) {
    showToast(htmlRejectedOpenToast(), { type: 'warning' });
    return;
  }

  if (htmlExceedsReadCap(file.size, file.name)) {
    showToast('HTML files larger than 8 MB cannot be opened.', {
      type: 'warning',
    });
    return;
  }

  // Resolve the on-disk path via the desktop bridge (webUtils.getPathForFile):
  // Electron v32+ removed the legacy File.path, and browser File objects never
  // carried one — so reading file.path here silently yielded undefined, losing
  // the desktop path affordances (recent-file reopen, live reload). The bridge
  // returns '' off the desktop shell or when a path can't be resolved, so this
  // is null on the web surface, exactly as before.
  const filePath = bridgeGetPathForFile(file) || null;

  // Read file and open in a new tab
  const reader = new FileReader();
  reader.onload = () => {
    const content = /** @type {string} */ (reader.result);
    // A browser File also exposes size + last-modified; carry them so the File
    // info sheet can show them on the web surface (where there's no path).
    openTabFromFile(file.name, content, filePath, {
      size: file.size,
      lastModified: file.lastModified,
    });
    // A real path means the main process can re-read the file, so record it for
    // one-click re-open. Browser File objects resolve to no path.
    if (filePath) {
      recordRecentFile({ type: 'path', ref: filePath, title: file.name });
      renderRecentFiles();
    }
  };
  reader.onerror = () => {
    showToast('Error reading file. Please try again.', { type: 'error' });
  };
  reader.readAsText(file);
}

/** @param {string} url */
function getFilenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter((s) => s.length > 0);
    if (segments.length > 0) {
      return segments[segments.length - 1];
    }
  } catch {
    // ignore invalid URL
  }
  return 'untitled.md';
}

/** @param {string} message */
function showUrlError(message) {
  const urlError = el('url-error');
  if (!urlError) return;
  urlError.textContent = message;
  urlError.style.display = '';
}

function clearUrlError() {
  const urlError = el('url-error');
  if (!urlError) return;
  urlError.style.display = 'none';
  urlError.textContent = '';
}

/** @param {string} url */
export async function handleUrl(url) {
  clearUrlError();

  if (!url || !/^https?:\/\//.test(url)) {
    showUrlError('Please enter a valid URL starting with http:// or https://');
    return;
  }

  const urlInput = /** @type {HTMLInputElement | null} */ (el('url-input'));

  // Check if this is a GitHub repo URL to show the file browser
  const isRepoBrowserUrl = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(
    url
  );
  if (isRepoBrowserUrl) {
    const handled = await handleRepoUrl(url, {
      clearError: clearUrlError,
      showError: showUrlError,
      onSelectFile: handleUrl,
    });
    if (handled) {
      if (urlInput) urlInput.value = '';
      return;
    }
  }

  const fetchUrl = normalizeMarkdownUrl(url);
  const filename = getFilenameFromUrl(url);

  // Session 01: extension-only. Extensionless URLs stay markdown (no
  // Content-Type sniff). .html/.htm is accepted only when the HTML flag is on.
  if (
    htmlDetectKind(filename) === 'html' &&
    !htmlIsOpenableFilename(filename)
  ) {
    showUrlError(htmlRejectedOpenToast());
    return;
  }

  try {
    const response = await fetch(fetchUrl, { credentials: 'omit' });
    if (!response.ok) {
      showUrlError('Failed to fetch URL: HTTP ' + response.status);
      return;
    }
    const markdown = await response.text();
    if (htmlExceedsReadCap(new Blob([markdown]).size, filename)) {
      showUrlError('HTML files larger than 8 MB cannot be opened.');
      return;
    }
    if (urlInput) urlInput.value = '';
    // Record the source URL so the File info sheet can show where it came from.
    openTabFromFile(filename, markdown, null, { url });
    // Remember this URL for one-click re-open from the drop zone.
    recordRecentFile({ ref: url, title: filename });
    renderRecentFiles();
  } catch {
    showUrlError(
      'Could not fetch URL — the server may not allow cross-origin requests. Try using the raw file URL.'
    );
  }
}
