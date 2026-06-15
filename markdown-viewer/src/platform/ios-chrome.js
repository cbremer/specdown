// @ts-check
// iOS native chrome + print.
//
// The iOS shell talks to the web app through window.webkit.messageHandlers and
// a window.setIOSLayoutMode bridge, and the app drives a native-feeling action
// bar / sheets. This module owns that layer (plus the print pipeline, which is
// entangled with the iOS native-print path). DOM elements are looked up by id
// so the module is self-contained.

import { state } from '../core/state.js';
import { isDesktop, isIOSNative } from '../core/platform.js';
import { escapeHtml } from '../core/utils.js';
import { hasDesktopBridge, bridgeRequestFileOpen } from './bridge.js';

const el = (/** @type {string} */ id) => document.getElementById(id);

// The iOS WKScriptMessage bridge, present only inside the native shell.
const iosHandler = () =>
  window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.specdown;

export function setupIOSNativeUI() {
  document.body.classList.toggle('ios-native', isIOSNative);
  document.documentElement.classList.toggle('ios-native', isIOSNative);
  const iosSampleSection = el('ios-sample-section');
  if (iosSampleSection) {
    iosSampleSection.style.display = isIOSNative ? '' : 'none';
  }
  document.body.classList.toggle('ios-pad', isIOSNative && state.iosLayoutMode === 'pad');
  document.documentElement.classList.toggle('ios-pad', isIOSNative && state.iosLayoutMode === 'pad');
  syncIOSChrome();
}

export function requestNativeOpenIfAvailable() {
  if (isDesktop && hasDesktopBridge()) {
    bridgeRequestFileOpen();
    return true;
  }
  const handler = iosHandler();
  if (isIOSNative && handler) {
    handler.postMessage({ action: 'openFilePicker' });
    return true;
  }
  return false;
}

/** @param {string} sampleName */
export function requestBundledSampleIfAvailable(sampleName) {
  const handler = iosHandler();
  if (!isIOSNative || !handler) {
    return false;
  }
  handler.postMessage({
    action: 'openBundledSample',
    data: { name: sampleName },
  });
  return true;
}

function requestNativePrintIfAvailable() {
  const handler = iosHandler();
  if (!isIOSNative || !handler || !hasLoadedContent()) {
    return false;
  }
  const fileName = el('file-name');
  handler.postMessage({
    action: 'printDocument',
    data: {
      title: fileName ? fileName.textContent : '',
      html: buildPrintableDocument(),
    },
  });
  return true;
}

export function hasLoadedContent() {
  const contentArea = el('content-area');
  return !!(contentArea && contentArea.style.display !== 'none' && state.currentRawMarkdown);
}

/**
 * @param {HTMLElement | null} sheet
 * @param {boolean} visible
 */
export function setIOSSheetVisibility(sheet, visible) {
  if (!sheet) return;
  sheet.style.display = visible ? 'flex' : 'none';
}

export function closeIOSActionSheet() {
  setIOSSheetVisibility(el('ios-action-sheet'), false);
}

export function closeIOSTocSheet() {
  setIOSSheetVisibility(el('ios-toc-sheet'), false);
  state.tocVisible = false;
  const tocToggle = el('toc-toggle');
  if (tocToggle) tocToggle.classList.remove('active');
  syncIOSChrome();
}

/**
 * @param {HTMLElement | null} button
 * @param {string} label
 */
function updateIOSActionButtonLabel(button, label) {
  if (!button) return;
  const labelEl = button.querySelector('.ios-action-label');
  if (labelEl) {
    labelEl.textContent = label;
  }
}

/**
 * @param {HTMLElement | null} button
 * @param {string} label
 * @param {boolean} active
 */
function updateIOSSheetButton(button, label, active) {
  if (!button) return;
  button.textContent = label;
  button.classList.toggle('active', !!active);
}

export function performPrint() {
  if (requestNativePrintIfAvailable()) {
    return;
  }
  window.print();
}

window.setIOSLayoutMode = function (/** @type {string} */ mode) {
  state.iosLayoutMode = mode === 'pad' ? 'pad' : 'phone';
  if (isIOSNative) {
    document.body.classList.toggle('ios-pad', state.iosLayoutMode === 'pad');
    document.documentElement.classList.toggle('ios-pad', state.iosLayoutMode === 'pad');
    if (state.iosLayoutMode === 'pad') {
      closeIOSActionSheet();
      closeIOSTocSheet();
    }
  }
  syncIOSChrome();
};

function buildPrintableDocument() {
  const fileName = el('file-name');
  const markdownContent = el('markdown-content');
  const title = fileName && fileName.textContent ? fileName.textContent : 'Specdown Document';
  if (!markdownContent) return '';
  const printableContent = /** @type {HTMLElement} */ (markdownContent.cloneNode(true));

  printableContent
    .querySelectorAll('.diagram-controls, .annotation-popover, .search-highlight, .search-highlight-current, .code-copy-btn')
    .forEach((element) => element.remove());
  printableContent.querySelectorAll('.annotation-badge').forEach((badge) => badge.remove());
  printableContent.querySelectorAll('.has-annotation').forEach((element) => {
    element.classList.remove('has-annotation');
  });
  printableContent.querySelectorAll('.diagram-wrapper').forEach((node) => {
    const wrapper = /** @type {HTMLElement} */ (node);
    wrapper.style.height = 'auto';
    wrapper.style.overflow = 'visible';
  });
  printableContent.querySelectorAll('.diagram-wrapper svg').forEach((node) => {
    const svg = /** @type {SVGElement} */ (node);
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    svg.style.position = 'static';
    svg.style.transform = 'none';
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        @page {
            margin: 18mm 14mm;
        }
        html {
            box-sizing: border-box;
            background: #ffffff;
        }
        *,
        *::before,
        *::after {
            box-sizing: inherit;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }
        .print-shell {
            max-width: 100%;
            padding: 12px 10px 16px;
        }
        .print-title {
            margin: 0 0 24px;
            font-size: 28px;
            font-weight: 700;
        }
        .print-content h1,
        .print-content h2,
        .print-content h3,
        .print-content h4,
        .print-content h5,
        .print-content h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            line-height: 1.3;
        }
        .print-content h1,
        .print-content h2 {
            padding-bottom: 0.3em;
            border-bottom: 1px solid #d1d5db;
        }
        .print-content p,
        .print-content ul,
        .print-content ol,
        .print-content table,
        .print-content blockquote,
        .print-content pre,
        .print-content .diagram-container {
            margin-bottom: 1em;
        }
        .print-content ul,
        .print-content ol {
            padding-left: 2em;
        }
        .print-content code {
            font-family: "SFMono-Regular", SFMono-Regular, ui-monospace, Menlo, monospace;
            background: #f3f4f6;
            padding: 0.15em 0.35em;
            border-radius: 4px;
            font-size: 0.92em;
        }
        .print-content pre {
            white-space: pre-wrap;
            word-break: break-word;
            overflow: visible;
            border: 1px solid #d1d5db;
            background: #f9fafb;
            border-radius: 8px;
            padding: 1em;
        }
        .print-content pre code {
            background: transparent;
            padding: 0;
        }
        .print-content table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .print-content th,
        .print-content td {
            border: 1px solid #d1d5db;
            padding: 0.6em;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
        }
        .print-content blockquote {
            margin-left: 0;
            padding-left: 1em;
            border-left: 4px solid #60a5fa;
            color: #4b5563;
        }
        .print-content img,
        .print-content svg {
            max-width: 100%;
            height: auto;
        }
        .print-content .raw-markdown,
        .print-content .html-comment-block,
        .print-content .diagram-container,
        .print-content pre,
        .print-content table,
        .print-content blockquote {
            max-width: 100%;
        }
        .print-content .diagram-container,
        .print-content .diagram-wrapper {
            page-break-inside: avoid;
            break-inside: avoid;
        }
    </style>
</head>
<body>
    <main class="print-shell">
        <h1 class="print-title">${escapeHtml(title)}</h1>
        <section class="print-content">${printableContent.innerHTML}</section>
    </main>
</body>
</html>`;
}

export function syncIOSChrome() {
  if (!isIOSNative) return;

  const hasContent = hasLoadedContent();
  const showActionBar = (hasContent || state.tabs.length > 0) && state.iosLayoutMode !== 'pad';
  const canShowContents = hasContent && state.currentViewMode === 'preview' && state.tocEntries.length > 0;

  const iosActionBar = el('ios-action-bar');
  if (iosActionBar) {
    iosActionBar.style.display = showActionBar ? 'grid' : 'none';
  }

  const iosContentsButton = /** @type {HTMLButtonElement | null} */ (el('ios-contents-button'));
  if (iosContentsButton) {
    iosContentsButton.disabled = !canShowContents;
    iosContentsButton.classList.toggle('active', state.tocVisible);
  }

  const iosViewButton = /** @type {HTMLButtonElement | null} */ (el('ios-view-button'));
  if (iosViewButton) {
    iosViewButton.disabled = !hasContent;
    iosViewButton.classList.toggle('active', state.currentViewMode === 'raw');
    updateIOSActionButtonLabel(iosViewButton, state.currentViewMode === 'preview' ? 'Raw' : 'Preview');
  }

  const iosMoreButton = /** @type {HTMLButtonElement | null} */ (el('ios-more-button'));
  if (iosMoreButton) {
    iosMoreButton.disabled = !hasContent;
  }

  updateIOSSheetButton(el('ios-split-button'), state.splitViewActive ? 'Hide Split View' : 'Show Split View', state.splitViewActive);
  updateIOSSheetButton(el('ios-theme-button'), state.currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode', false);

  const iosSplitButton = /** @type {HTMLButtonElement | null} */ (el('ios-split-button'));
  const iosPrintButton = /** @type {HTMLButtonElement | null} */ (el('ios-print-button'));
  if (iosSplitButton) iosSplitButton.disabled = !hasContent;
  if (iosPrintButton) iosPrintButton.disabled = !hasContent;
}
