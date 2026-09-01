// @ts-check
// HTML document runtime: rewrite, sandboxed preview host, stage lifecycle.
//
// The framed document is NEVER assigned to a parent node via innerHTML.
// `#html-frame.src` is the bundled preview host (real URL). Parent
// postMessages rewritten HTML; the host document.writes inside the
// opaque iframe (`sandbox="allow-scripts"` without allow-same-origin).
//
// Unique `html*` names for the eval harness.

import { state } from '../core/state.js';
import {
  htmlActiveCapabilities,
  htmlActiveKind,
} from '../core/document-kind.js';
import { htmlHostInlineSource } from './html-host.js';
import { showToast } from './toast.js';
import { closeSearch } from './search.js';
import { toggleToc } from './toc.js';
import { refreshCommentsUI } from './comments.js';
import { htmlForceAnnotationOff } from './annotations.js';
import { hasPresentableDiagrams } from './presentation.js';
import { syncIOSChrome } from '../platform/ios-chrome.js';
import { hasWorkspace, renderWorkspaceSidebar } from './workspace.js';

void htmlHostInlineSource;

const htmlEl = (/** @type {string} */ id) => document.getElementById(id);

/** Faithful CSP injected into rewritten HTML so it survives document.write. */
export const htmlPreviewDocumentCsp =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https: http:; style-src 'unsafe-inline' https: http: data:; img-src * data: blob:; font-src * data:; connect-src https: http:; media-src * data: blob:; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'";

const HTML_NESTED_FRAMES = [
  'iframe',
  'object',
  'embed',
  'frame',
  'frameset',
  'portal',
  'fencedframe',
];

const HTML_DANGEROUS_PROTOCOL =
  /^(javascript|data|vbscript|file|blob|specdown):/i;

/** @type {string | null} */
let htmlPendingSpecdownLoad = null;
/** @type {boolean} */
let htmlFrameListenersBound = false;
/** @type {boolean} */
let htmlRelativeUrlToastPending = false;

/**
 * Preview host URL relative to the viewer page (index.html). Harness-safe:
 * no `import.meta`.
 * @returns {string}
 */
export function htmlPreviewHostHref() {
  try {
    return new URL(
      'html-preview-host.html',
      document.baseURI || window.location.href
    ).href;
  } catch {
    return 'html-preview-host.html';
  }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function htmlIsRelativeUrl(value) {
  const v = String(value || '').trim();
  if (!v || v.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false;
  if (v.startsWith('//')) return false;
  return true;
}

/**
 * @param {string} value
 * @param {boolean} keepRelative
 * @returns {string}
 */
function htmlNeutralizeUrl(value, keepRelative) {
  const v = String(value || '').trim();
  if (!v) return v;
  if (v.startsWith('#')) return v;
  if (v.startsWith('//')) return '#';
  if (HTML_DANGEROUS_PROTOCOL.test(v)) return '#';
  // Session 01 has no asset protocol. Relative URLs would resolve against the
  // host page (web dist or desktop file:), so drop them unless a <base> was
  // explicitly injected.
  if (!keepRelative && htmlIsRelativeUrl(v)) return '#';
  return v;
}

const HTML_URL_ATTRS = [
  'href',
  'src',
  'xlink:href',
  'poster',
  'action',
  'formaction',
  'data',
];

/**
 * @param {Document} doc
 * @param {boolean} keepRelative
 * @returns {boolean} whether any relative URL was present before rewrite
 */
function htmlRewriteUrls(doc, keepRelative) {
  let sawRelative = false;
  const nodes = doc.querySelectorAll('*');
  for (const node of nodes) {
    for (const attr of HTML_URL_ATTRS) {
      if (!node.hasAttribute(attr)) continue;
      const raw = node.getAttribute(attr) || '';
      if (htmlIsRelativeUrl(raw)) sawRelative = true;
      const next = htmlNeutralizeUrl(raw, keepRelative);
      if (next !== raw) node.setAttribute(attr, next);
    }
    if (node.hasAttribute('srcset')) {
      node.removeAttribute('srcset');
    }
  }
  return sawRelative;
}

/**
 * @param {string} raw
 * @param {{ baseHref?: string, suppressRelativeToast?: boolean }} [opts]
 * @returns {string}
 */
export function htmlRewriteDocument(raw, opts) {
  const options = opts || {};
  const parsed = new DOMParser().parseFromString(
    String(raw || ''),
    'text/html'
  );

  const metas = parsed.querySelectorAll('meta');
  for (const meta of metas) {
    const httpEquiv = (meta.getAttribute('http-equiv') || '').toLowerCase();
    if (
      httpEquiv === 'content-security-policy' ||
      httpEquiv === 'refresh' ||
      httpEquiv === 'set-cookie'
    ) {
      meta.remove();
    }
  }

  for (const base of parsed.querySelectorAll('base')) {
    base.remove();
  }
  if (options.baseHref) {
    const base = parsed.createElement('base');
    base.setAttribute('href', options.baseHref);
    const head = parsed.head || parsed.documentElement;
    if (head.firstChild) head.insertBefore(base, head.firstChild);
    else head.appendChild(base);
  }

  for (const tag of HTML_NESTED_FRAMES) {
    parsed.querySelectorAll(tag).forEach((el) => el.remove());
  }

  const sawRelative = htmlRewriteUrls(parsed, !!options.baseHref);

  let head = parsed.head;
  if (!head) {
    head = parsed.createElement('head');
    parsed.documentElement.insertBefore(
      head,
      parsed.documentElement.firstChild
    );
  }
  const cspMeta = parsed.createElement('meta');
  cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
  cspMeta.setAttribute('content', htmlPreviewDocumentCsp);
  head.insertBefore(cspMeta, head.firstChild);

  htmlRelativeUrlToastPending = !!(
    sawRelative &&
    !options.baseHref &&
    !options.suppressRelativeToast
  );

  const root = parsed.documentElement
    ? parsed.documentElement.outerHTML
    : String(raw || '');
  return '<!DOCTYPE html>\n' + root;
}

/**
 * @param {string} src
 * @returns {boolean}
 */
function htmlSrcIsBlank(src) {
  return !src || src === 'about:blank';
}

/**
 * Host URL, including a cache-bust query used to force-reload the host page.
 * `about:blank` is allowed by the navigation lock (teardown) but is not a
 * place we postMessage — that document inherits parent CSP.
 * @param {string} src
 * @param {string} hostHref
 * @returns {boolean}
 */
function htmlSrcIsHost(src, hostHref) {
  if (htmlSrcIsBlank(src)) return true;
  try {
    const current = new URL(src, document.baseURI || window.location.href).href;
    const host = new URL(hostHref, document.baseURI || window.location.href)
      .href;
    return (
      current === host ||
      current.startsWith(host + '#') ||
      current.startsWith(host + '?')
    );
  } catch {
    return false;
  }
}

function htmlOnFrameLoad() {
  const frame = /** @type {HTMLIFrameElement | null} */ (htmlEl('html-frame'));
  if (!frame || frame.hidden) return;
  const host = htmlPreviewHostHref();
  const attrSrc = frame.getAttribute('src') || '';
  const current = attrSrc || frame.src || '';
  if (!htmlSrcIsHost(current, host) && !htmlSrcIsHost(frame.src, host)) {
    showToast('This document tried to navigate away from the preview.', {
      type: 'warning',
    });
    htmlPendingSpecdownLoad = htmlPendingSpecdownLoad || '';
    frame.setAttribute('src', host);
    return;
  }
  // Force-reload hits about:blank (or an empty src) before the host page.
  // Delivering specdown-load there consumes the payload and the subsequent
  // host load is an empty white page.
  if (htmlSrcIsBlank(attrSrc) || htmlSrcIsBlank(current)) return;
  if (htmlPendingSpecdownLoad != null && frame.contentWindow) {
    const html = htmlPendingSpecdownLoad;
    htmlPendingSpecdownLoad = null;
    frame.contentWindow.postMessage({ type: 'specdown-load', html }, '*');
    if (htmlRelativeUrlToastPending) {
      htmlRelativeUrlToastPending = false;
      showToast(
        'Relative files in this page are not loaded yet (open it from a folder later).',
        { type: 'info' }
      );
    }
  }
}

/**
 * Frame → parent messages are untrusted. Closed enum; default drop.
 * `specdown-print-ready` with html is forbidden and ignored.
 * @param {MessageEvent} event
 */
function htmlOnParentMessage(event) {
  const frame = /** @type {HTMLIFrameElement | null} */ (htmlEl('html-frame'));
  if (!frame || event.source !== frame.contentWindow) return;
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  const type = /** @type {string} */ (data.type);
  if (type === 'specdown-open-external') {
    const url = typeof data.url === 'string' ? data.url : '';
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // drop malformed
    }
    return;
  }
  // Drop unknown types, including specdown-print-ready.
}

/** Bind iframe load + parent message listeners once. */
export function htmlSetupFrame() {
  if (htmlFrameListenersBound) return;
  htmlFrameListenersBound = true;
  const frame = htmlEl('html-frame');
  if (frame) {
    frame.addEventListener('load', htmlOnFrameLoad);
  }
  window.addEventListener('message', htmlOnParentMessage);
}

/**
 * Hide the iframe and reset it to the host URL (or leave it for the next load).
 */
export function htmlTeardownFrame() {
  htmlPendingSpecdownLoad = null;
  htmlRelativeUrlToastPending = false;
  const frame = /** @type {HTMLIFrameElement | null} */ (htmlEl('html-frame'));
  if (!frame) return;
  frame.hidden = true;
  frame.title = '';
  const host = htmlPreviewHostHref();
  if ((frame.getAttribute('src') || '') !== host) {
    frame.setAttribute('src', host);
  }
}

/** Hide the iframe without claiming a new host load (raw / markdown). */
export function htmlHideFrame() {
  htmlPendingSpecdownLoad = null;
  const frame = /** @type {HTMLIFrameElement | null} */ (htmlEl('html-frame'));
  if (!frame) return;
  frame.hidden = true;
}

/**
 * Reload the preview host, then postMessage rewritten HTML.
 * @param {string} rewrittenHtml
 * @param {string} filename
 */
export function htmlMountFrame(rewrittenHtml, filename) {
  const frame = /** @type {HTMLIFrameElement | null} */ (htmlEl('html-frame'));
  if (!frame) return;
  htmlSetupFrame();
  frame.title = filename || '';
  frame.hidden = false;
  htmlPendingSpecdownLoad = rewrittenHtml;
  const host = htmlPreviewHostHref();
  const sep = host.includes('?') ? '&' : '?';
  // Cache-bust so a host that is already loaded still fires `load`. Do not
  // bounce through about:blank — that document inherits parent CSP and a
  // premature load handler would steal specdown-load.
  frame.setAttribute('src', `${host}${sep}specdown-host=${Date.now()}`);
}

/**
 * Show markdown pane, hide iframe (or the reverse).
 * @param {'markdown' | 'html-preview' | 'html-raw' | 'empty'} mode
 * @param {string} [filename]
 */
export function htmlApplyStage(mode, filename) {
  const markdown = htmlEl('markdown-content');
  const frame = /** @type {HTMLIFrameElement | null} */ (htmlEl('html-frame'));
  if (mode === 'html-preview') {
    if (markdown) {
      markdown.hidden = true;
      markdown.innerHTML = '';
    }
    if (frame) {
      frame.hidden = false;
      if (filename) frame.title = filename;
    }
    return;
  }
  if (markdown) markdown.hidden = false;
  if (mode === 'empty' || mode === 'markdown' || mode === 'html-raw') {
    htmlHideFrame();
  }
  if (mode === 'empty') {
    htmlTeardownFrame();
    if (markdown) markdown.innerHTML = '';
  }
}

/**
 * Hide Print / Find / TOC / Present / Annotate / Comments on HTML tabs.
 * Restore them on markdown. Overflow skips `display:none` toolbar buttons.
 */
export function htmlSyncKindChrome() {
  const caps = htmlActiveCapabilities();
  const setHidden = (/** @type {string} */ id, /** @type {boolean} */ show) => {
    const node = htmlEl(id);
    if (node) node.style.display = show ? '' : 'none';
  };

  setHidden('toc-toggle', caps.toc);
  setHidden('search-button', caps.find);
  setHidden('print-button', caps.print);
  setHidden('annotation-toggle', caps.annotate);
  setHidden('annotation-list-toggle', caps.annotate);
  if (!caps.authoredComments) setHidden('comments-toggle', false);
  setHidden('split-toggle', caps.split);
  setHidden('view-toggle', caps.raw);

  const present = htmlEl('present-button');
  if (present) {
    present.style.display =
      caps.present && hasPresentableDiagrams() ? '' : 'none';
  }
  const iosPresent = htmlEl('ios-present-button');
  if (iosPresent) {
    iosPresent.style.display =
      caps.present && hasPresentableDiagrams() ? '' : 'none';
  }

  setHidden('ios-contents-button', caps.toc);
  setHidden('ios-print-button', caps.print);
  setHidden('ios-comments-button', caps.authoredComments);
  setHidden('ios-annotations-button', caps.annotate);
  setHidden('ios-split-button', caps.split);

  if (htmlActiveKind() === 'html') {
    htmlForceAnnotationOff();
    closeSearch();
    if (state.tocVisible) toggleToc(false);
    state.tocEntries = [];
    const tocNav = htmlEl('toc-nav');
    if (tocNav) tocNav.innerHTML = '';
    const iosTocNav = htmlEl('ios-toc-nav');
    if (iosTocNav) iosTocNav.innerHTML = '';
    refreshCommentsUI();
  }

  syncIOSChrome();
}

/**
 * HTML render path. Does not call marked.parse. Does not innerHTML the file
 * into the parent.
 * @param {string} content
 * @param {string} filename
 */
export function htmlRenderDocument(content, filename) {
  state.currentRawMarkdown = content;
  state.currentViewMode = 'preview';
  const fileName = htmlEl('file-name');
  if (fileName) fileName.textContent = filename;

  const dropZone = htmlEl('drop-zone');
  const contentArea = htmlEl('content-area');
  if (dropZone) dropZone.style.display = 'none';
  if (contentArea) contentArea.style.display = 'flex';

  htmlApplyStage('html-preview', filename);

  const suppressRelativeToast = /html-showcase\.html$/i.test(filename);
  const rewritten = htmlRewriteDocument(content, { suppressRelativeToast });
  htmlMountFrame(rewritten, filename);

  const workspaceToggle = htmlEl('workspace-toggle');
  if (workspaceToggle) {
    workspaceToggle.style.display = hasWorkspace() ? '' : 'none';
  }
  renderWorkspaceSidebar();

  if (state.splitViewActive) {
    const splitRaw = htmlEl('split-raw-content');
    if (splitRaw) {
      const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      splitRaw.innerHTML = `<code>${escaped}</code>`;
    }
  }

  htmlSyncKindChrome();
}
