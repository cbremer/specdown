// Split view: show the rendered preview alongside the raw markdown source.

import { state } from '../core/state.js';
import { syncIOSChrome } from '../platform/ios-chrome.js';

const el = (id) => document.getElementById(id);

export function toggleSplitView() {
  state.splitViewActive = !state.splitViewActive;

  const splitToggle = el('split-toggle');
  if (splitToggle) splitToggle.classList.toggle('active', state.splitViewActive);

  const contentMain = el('content-main');
  if (contentMain) {
    contentMain.classList.toggle('split-active', state.splitViewActive);
  }

  const splitRawPane = el('split-raw-pane');
  if (splitRawPane) {
    splitRawPane.style.display = state.splitViewActive ? '' : 'none';
  }

  if (state.splitViewActive && state.currentRawMarkdown) {
    updateSplitRawPane(state.currentRawMarkdown);
  }

  syncIOSChrome();
}

export function updateSplitRawPane(content) {
  const splitRawContent = el('split-raw-content');
  if (!splitRawContent) return;
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  splitRawContent.innerHTML = `<code>${escaped}</code>`;
}
