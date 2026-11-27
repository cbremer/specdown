// @ts-check
import { state } from '../core/state.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { openExplainRail, resetExplainRail } from './explain-rail.js';
import { readAloudStart, readAloudReset } from './read-aloud.js';

/** @type {{context: ReturnType<typeof captureDocumentContext>, range: Range|null, focused: Element|null}|null} */
let readerMenuTarget = null;
/** @type {Element|null} */
let readerFocusedBlock = null;

export function readerActionsAvailable() {
  const content = document.getElementById('markdown-content');
  return (
    state.activeTabId !== null &&
    state.currentViewMode === 'preview' &&
    !!content &&
    !content.hidden
  );
}

// A touch on More can collapse the selection before its click event opens the menu.
function captureReaderMenuTarget() {
  const context = captureDocumentContext();
  const selection = window.getSelection();
  const range =
    selection?.rangeCount && !selection.isCollapsed
      ? selection.getRangeAt(0)
      : null;
  readerMenuTarget = {
    context,
    range:
      range && context.root?.contains(range.commonAncestorContainer)
        ? range.cloneRange()
        : null,
    focused:
      readerFocusedBlock && context.root?.contains(readerFocusedBlock)
        ? readerFocusedBlock
        : null,
  };
}

export function prepareReaderMenu() {
  if (!readerMenuTarget || !isDocumentContextCurrent(readerMenuTarget.context))
    captureReaderMenuTarget();
}

export function readerMenuReadLabel() {
  return readerMenuTarget?.range ? 'Read selection' : 'Read from here';
}

/** @param {'read'|'explain'} action */
export function runReaderMenuAction(action) {
  prepareReaderMenu();
  const target = readerMenuTarget;
  readerMenuTarget = null;
  if (
    !target ||
    !isDocumentContextCurrent(target.context) ||
    !readerActionsAvailable()
  )
    return;
  if (action === 'read') readAloudStart(target.range);
  else openExplainRail(target.range, target.focused);
}

export function resetReadingFeatures() {
  readerMenuTarget = null;
  readerFocusedBlock = null;
  readAloudReset();
  resetExplainRail();
}

export function setupReaderMenuCapture() {
  const content = document.getElementById('markdown-content');
  /** @param {Event} event */
  const rememberBlock = (event) => {
    const node = event.target instanceof Element ? event.target : null;
    readerFocusedBlock = node?.closest('pre, .diagram-container') || null;
    readerMenuTarget = null;
  };
  content?.addEventListener('pointerdown', rememberBlock);
  content?.addEventListener('focusin', rememberBlock);
  for (const id of ['overflow-toggle', 'ios-more-button']) {
    const toggle = document.getElementById(id);
    toggle?.addEventListener('pointerdown', captureReaderMenuTarget);
    toggle?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') captureReaderMenuTarget();
    });
  }
}
