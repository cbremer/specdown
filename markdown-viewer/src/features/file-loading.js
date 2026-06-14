// @ts-check
// Loading markdown from local files (browse / drop) and from URLs (incl. the
// GitHub repo browser). Opening content creates a tab (tabs core, main.js),
// supplied via configureFileLoading.

import { normalizeMarkdownUrl } from '../core/utils.js';
import { handleRepoUrl } from './repo-browser.js';
import { showToast } from './toast.js';

const VALID_EXTENSIONS = ['.md', '.markdown'];
const el = (/** @type {string} */ id) => document.getElementById(id);

/** @type {(filename: string, content?: string, filePath?: string | null) => void} */
let openTab = () => {};

/** @param {{ createTab?: Function }} [deps] */
export function configureFileLoading(deps) {
  if (deps && typeof deps.createTab === 'function') {
    openTab = /** @type {typeof openTab} */ (deps.createTab);
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

/** @param {File & { path?: string }} file */
export function handleFile(file) {
  // Validate file type
  const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  if (!VALID_EXTENSIONS.includes(fileExtension)) {
    showToast('Please select a valid Markdown file (.md or .markdown)', { type: 'warning' });
    return;
  }

  // Read file and open in a new tab
  const reader = new FileReader();
  reader.onload = () => {
    const content = /** @type {string} */ (reader.result);
    openTab(file.name, content, file.path || null);
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
  } catch (e) {
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
  const isRepoBrowserUrl = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url);
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

  try {
    const response = await fetch(fetchUrl, { credentials: 'omit' });
    if (!response.ok) {
      showUrlError('Failed to fetch URL: HTTP ' + response.status);
      return;
    }
    const markdown = await response.text();
    if (urlInput) urlInput.value = '';
    openTab(filename, markdown);
  } catch (e) {
    showUrlError(
      'Could not fetch URL — the server may not allow cross-origin requests. Try using the raw file URL.'
    );
  }
}
