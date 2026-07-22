// @ts-check
// Preview / raw-markdown view toggle. The preview render lives in the render
// core (main.js) and is supplied via configureViewMode.

import { state } from '../core/state.js';
import { iconSvg } from '../core/icons.js';
import { toggleToc } from './toc.js';
import { syncIOSChrome } from '../platform/ios-chrome.js';

const el = (/** @type {string} */ id) => document.getElementById(id);

/** @type {(content: string, title: string) => void} */
let renderPreview = () => {};

/** @param {{ renderMarkdown?: Function }} [deps] */
export function configureViewMode(deps) {
  if (deps && typeof deps.renderMarkdown === 'function') {
    renderPreview = /** @type {typeof renderPreview} */ (deps.renderMarkdown);
  }
}

export function toggleViewMode() {
  if (!state.currentRawMarkdown) return;
  const markdownContent = el('markdown-content');
  if (!markdownContent) return;

  if (state.currentViewMode === 'preview') {
    state.currentViewMode = 'raw';
    if (state.tocVisible) {
      toggleToc(false);
    }
    // Show raw markdown in a pre/code block
    const escaped = state.currentRawMarkdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    markdownContent.innerHTML = '<pre class="raw-markdown"><code>' + escaped + '</code></pre>';
  } else {
    state.currentViewMode = 'preview';
    // Re-render the preview
    const fileName = el('file-name');
    renderPreview(state.currentRawMarkdown, fileName ? fileName.textContent : '');
    return; // render handles the rest
  }

  // Persist view mode to active tab state
  if (state.activeTabId !== null) {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (tab) tab.viewMode = state.currentViewMode;
  }

  updateViewToggleButton();
  syncIOSChrome();
}

export function updateViewToggleButton() {
  const viewToggle = el('view-toggle');
  if (!viewToggle) return;
  const label = viewToggle.querySelector('.view-toggle-label');
  const icon = viewToggle.querySelector('.view-toggle-icon');
  if (state.currentViewMode === 'preview') {
    if (label) label.textContent = 'Raw';
    if (icon) icon.innerHTML = iconSvg('code');
    viewToggle.classList.remove('active');
  } else {
    if (label) label.textContent = 'Preview';
    if (icon) icon.innerHTML = iconSvg('eye');
    viewToggle.classList.add('active');
  }
}
