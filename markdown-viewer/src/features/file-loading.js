// @ts-check
// Loading markdown from local files (browse / drop) and from URLs (incl. the
// GitHub repo browser). Opening content creates a tab (tabs core, main.js),
// supplied via configureFileLoading.

import {
  DOCUMENT_MAX_BYTES,
  assertDocumentSize,
  readDocumentResponse,
} from '../core/document-limits.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { normalizeMarkdownUrl } from '../core/utils.js';
import { handleRepoUrl } from './repo-browser.js';
import { showToast } from './toast.js';
import { recordRecentFile, renderRecentFiles } from './recent-files.js';
import {
  bridgeGetPathForFile,
  bridgeRequestOpenPath,
} from '../platform/bridge.js';

const VALID_EXTENSIONS = ['.md', '.markdown'];
const el = (/** @type {string} */ id) => document.getElementById(id);

// Named uniquely (not a bare `openTab`): the test harness
// (tests/helpers/loadApp.js) flattens every module to global scope, so a
// module-top `openTab` here collides with the identically-named binding in
// share-links.js — whichever configure*() runs last wins the shared global, and
// this module's createTab (with its filePath/sourceMeta args) silently loses.
/** @type {(filename: string, content?: string, filePath?: string | null, sourceMeta?: import('../core/state.js').TabSourceMeta | null) => boolean | void} */
let openTabFromFile = () => {};

/** @param {{ createTab?: Function }} [deps] */
export function configureFileLoading(deps) {
  if (deps && typeof deps.createTab === 'function') {
    openTabFromFile = /** @type {typeof openTabFromFile} */ (deps.createTab);
  }
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
  // Validate file type
  const fileExtension = file.name
    .substring(file.name.lastIndexOf('.'))
    .toLowerCase();

  if (!VALID_EXTENSIONS.includes(fileExtension)) {
    showToast('Please select a valid Markdown file (.md or .markdown)', {
      type: 'warning',
    });
    return;
  }

  if (file.size > DOCUMENT_MAX_BYTES) {
    showToast(
      'This document is too large. SpecDown supports files up to 8 MiB.',
      { type: 'error' }
    );
    return;
  }

  // Resolve the on-disk path via the desktop bridge (webUtils.getPathForFile):
  // Electron v32+ removed the legacy File.path, and browser File objects never
  // carried one — so reading file.path here silently yielded undefined, losing
  // the desktop path affordances (recent-file reopen, live reload). The bridge
  // returns '' off the desktop shell or when a path can't be resolved, so this
  // is null on the web surface, exactly as before.
  const filePath = bridgeGetPathForFile(file) || null;
  // Successful native content read and its identity travel together.
  if (filePath) {
    bridgeRequestOpenPath(filePath);
    return;
  }

  // Read file and open in a new tab
  const reader = new FileReader();
  reader.onload = () => {
    const content = /** @type {string} */ (reader.result);
    // A browser File also exposes size + last-modified; carry them so the File
    // info sheet can show them on the web surface (where there's no path).
    try {
      assertDocumentSize(content);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Could not read this document.',
        { type: 'error' }
      );
      return;
    }
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
  const urlDropZone = el('drop-zone');
  if (
    (urlDropZone && getComputedStyle(urlDropZone).display === 'none') ||
    el('inline-url-entry')?.hidden
  ) {
    showToast(message, { type: 'error' });
    return;
  }
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

let fileLoadingUrlRequest = 0;
/** @type {AbortController | null} */
let fileLoadingUrlController = null;

/**
 * @param {string} url
 * @param {{ signal?: AbortSignal, showError?: (message: string) => void,
 * deferRepository?: (show: () => void) => void }} [options]
 * @returns {Promise<{status: 'document' | 'repository' | 'error' | 'stale'}>}
 */
export async function handleUrl(url, options = {}) {
  const urlRequest = ++fileLoadingUrlRequest;
  fileLoadingUrlController?.abort();
  const controller = new AbortController();
  fileLoadingUrlController = controller;
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    cancel();
  }, 30000);
  const documentContext = captureDocumentContext();
  const urlRequestCurrent = () =>
    urlRequest === fileLoadingUrlRequest &&
    !options.signal?.aborted &&
    isDocumentContextCurrent(documentContext);
  let failed = false;
  const reportError = (/** @type {string} */ message) => {
    if (!urlRequestCurrent()) return;
    failed = true;
    (options.showError || showUrlError)(message);
  };
  clearUrlError();
  const urlInput = /** @type {HTMLInputElement | null} */ (el('url-input'));
  try {
    if (!urlRequestCurrent()) return { status: 'stale' };
    if (!url || !/^https:\/\//i.test(url)) {
      reportError('Please enter a valid URL starting with https://');
      return { status: 'error' };
    }
    if (
      await handleRepoUrl(url, {
        clearError: clearUrlError,
        showError: reportError,
        onSelectFile: handleUrl,
        signal: controller.signal,
        deferPresentation: options.deferRepository
          ? (show) =>
              options.deferRepository?.(() => {
                if (urlRequestCurrent()) show();
              })
          : undefined,
      })
    ) {
      if (!urlRequestCurrent()) return { status: 'stale' };
      if (timedOut) throw new Error('URL request timed out');
      if (!failed && urlInput) urlInput.value = '';
      return { status: failed ? 'error' : 'repository' };
    }
    if (!urlRequestCurrent()) return { status: 'stale' };
    const response = await fetch(normalizeMarkdownUrl(url), {
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!urlRequestCurrent()) {
      await response.body?.cancel();
      return { status: 'stale' };
    }
    if (!response.ok) {
      reportError('Failed to fetch URL: HTTP ' + response.status);
      await response.body?.cancel();
      return { status: 'error' };
    }
    if (response.url && !response.url.startsWith('https://'))
      throw new Error('The document redirected to an insecure URL.');
    const markdown = await readDocumentResponse(response);
    if (!urlRequestCurrent()) return { status: 'stale' };
    const filename = getFilenameFromUrl(url);
    if (openTabFromFile(filename, markdown, null, { url }) === false) {
      reportError(
        'Could not open this document. If all 10 tabs are open, close a tab and try again.'
      );
      return { status: 'error' };
    }
    if (urlInput) urlInput.value = '';
    recordRecentFile({ ref: url, title: filename });
    renderRecentFiles();
    return { status: 'document' };
  } catch (error) {
    if (!urlRequestCurrent()) return { status: 'stale' };
    reportError(
      controller.signal.aborted
        ? 'Opening took too long. Please try again.'
        : error instanceof Error &&
            /^(?:This document|The document)/.test(error.message)
          ? error.message
          : 'Could not fetch URL — the server may not allow cross-origin requests. Try using the raw file URL.'
    );
    return { status: 'error' };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
