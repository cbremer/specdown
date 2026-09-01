// @ts-check
// Document kind detection and capability table.
//
// Kind is extension-only (no Content-Type / byte sniff). The compile-time
// HTML flag gates whether HTML is accepted at ingress; this module stays a
// pure lookup so tests can call it with the flag off.
//
// Unique `html*` names: the Jest eval harness inlines every module at global
// scope, so a bare `detectKind` / `OPENABLE_EXTENSIONS` would collide.

import { htmlDocumentsEnabled } from './html-flag.js';
import { state } from './state.js';

/**
 * @typedef {'markdown' | 'html'} DocumentKind
 */

/**
 * @typedef {object} DocumentCapabilities
 * @property {boolean} preview
 * @property {boolean} raw
 * @property {boolean} split
 * @property {boolean} liveReload
 * @property {boolean} fileInfo
 * @property {boolean} toc
 * @property {boolean} find
 * @property {boolean} print
 * @property {boolean} present
 * @property {boolean} annotate
 * @property {boolean} authoredComments
 * @property {boolean} codeCopy
 * @property {boolean} customCss
 * @property {boolean} workspaceLinks
 */

/** Documented openable set. Ingress still flag-gates HTML. */
export const htmlOpenableExtensions = ['.md', '.markdown', '.html', '.htm'];
export const htmlMarkdownExtensions = ['.md', '.markdown'];
export const htmlHtmlExtensions = ['.html', '.htm'];

/** 8 MB cap, HTML opens only, applied at read. */
export const htmlMaxBytes = 8 * 1024 * 1024;

/**
 * Extension of a filename (lowercase, including the dot). Empty when none.
 * @param {string} filename
 * @returns {string}
 */
function htmlExtensionOf(filename) {
  const name = String(filename || '');
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot).toLowerCase();
}

/**
 * @param {string} filename
 * @returns {DocumentKind | null}
 */
export function htmlDetectKind(filename) {
  const ext = htmlExtensionOf(filename);
  if (htmlMarkdownExtensions.includes(ext)) return 'markdown';
  if (htmlHtmlExtensions.includes(ext)) return 'html';
  return null;
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function htmlIsHtmlFilename(filename) {
  return htmlDetectKind(filename) === 'html';
}

/**
 * Extensions the running build will actually open.
 * @returns {string[]}
 */
export function htmlAcceptedExtensions() {
  if (htmlDocumentsEnabled()) return htmlOpenableExtensions.slice();
  return htmlMarkdownExtensions.slice();
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function htmlIsOpenableFilename(filename) {
  const kind = htmlDetectKind(filename);
  if (kind === 'markdown') return true;
  if (kind === 'html') return htmlDocumentsEnabled();
  return false;
}

/**
 * @param {number} size
 * @param {string} filename
 * @returns {boolean}
 */
export function htmlExceedsReadCap(size, filename) {
  return htmlIsHtmlFilename(filename) && size > htmlMaxBytes;
}

/**
 * Session 01 HTML capabilities: preview / raw / split / liveReload / fileInfo
 * only. Print, Find, TOC, Present, Annotate, Comments wait for later sessions.
 * @param {DocumentKind | string | null | undefined} kind
 * @returns {DocumentCapabilities}
 */
export function htmlDocumentCapabilities(kind) {
  const isHtml = kind === 'html';
  return {
    preview: true,
    raw: true,
    split: true,
    liveReload: true,
    fileInfo: true,
    toc: !isHtml,
    find: !isHtml,
    print: !isHtml,
    present: !isHtml,
    annotate: !isHtml,
    authoredComments: !isHtml,
    codeCopy: !isHtml,
    customCss: true,
    workspaceLinks: !isHtml,
  };
}

/**
 * Kind stored on the active tab. Missing kind is markdown (safe default).
 * @returns {DocumentKind}
 */
export function htmlActiveKind() {
  const tab =
    state.activeTabId !== null
      ? state.tabs.find((t) => t.id === state.activeTabId)
      : null;
  if (tab && tab.kind === 'html') return 'html';
  return 'markdown';
}

/** @returns {DocumentCapabilities} */
export function htmlActiveCapabilities() {
  return htmlDocumentCapabilities(htmlActiveKind());
}

/** Toast copy for a rejected local open. */
export function htmlRejectedOpenToast() {
  if (htmlDocumentsEnabled()) {
    return 'Please select a Markdown or HTML file (.md, .markdown, .html, .htm)';
  }
  return 'Please select a valid Markdown file (.md or .markdown)';
}

/** Empty-folder copy. */
export function htmlEmptyWorkspaceToast() {
  if (htmlDocumentsEnabled()) {
    return 'No Markdown or HTML files found.';
  }
  return 'No markdown files found in that folder.';
}

/** File-input accept attribute for the running build. */
export function htmlFileInputAccept() {
  if (htmlDocumentsEnabled()) return '.md,.markdown,.html,.htm';
  return '.md,.markdown';
}
