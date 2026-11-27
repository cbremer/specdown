// @ts-check
import {
  bridgeOnReaderAction,
  bridgeSetReaderMenuState,
} from '../platform/bridge.js';
import { state } from '../core/state.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { openExplainRail, invalidateExplainRail } from './explain-rail.js';
import {
  readAloudStart,
  readAloudReset,
  readAloudToggle,
} from './read-aloud.js';

/** @type {{context: ReturnType<typeof captureDocumentContext>, range: Range|null, focused: Element|null}|null} */
let readerMenuTarget = null;
/** @type {Element|null} */
let readerFocusedBlock = null;

const readerAppleKeys =
  /Mac|iPhone|iPad|iPod/.test(navigator.platform) || !!window.iosNative;

/** @param {'read'|'explain'} action */
export function readerShortcutLabel(action) {
  return (
    (readerAppleKeys ? '⌥⌘' : 'Ctrl+Alt+') + (action === 'read' ? 'R' : 'E')
  );
}

/** @param {KeyboardEvent} event */
export function readerShortcutAction(event) {
  const modifier = readerAppleKeys
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (
    !modifier ||
    !event.altKey ||
    event.shiftKey ||
    event.isComposing ||
    event.getModifierState('AltGraph')
  )
    return null;
  const code = event.code || 'Key' + event.key.toUpperCase();
  return code === 'KeyR' ? 'read' : code === 'KeyE' ? 'explain' : null;
}

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
export function runReaderMenuAction(action, togglePlayback = false) {
  prepareReaderMenu();
  const target = readerMenuTarget;
  readerMenuTarget = null;
  if (
    !target ||
    !isDocumentContextCurrent(target.context) ||
    !readerActionsAvailable()
  )
    return;
  if (action === 'read') {
    if (togglePlayback) readAloudToggle(target.range);
    else readAloudStart(target.range);
  } else openExplainRail(target.range, target.focused);
}

export function resetReadingFeatures() {
  readerMenuTarget = null;
  readerFocusedBlock = null;
  readAloudReset();
  invalidateExplainRail();
  queueMicrotask(syncReaderNativeMenu);
}

let readerNativeMenuState = '';

function syncReaderNativeMenu() {
  const live = window.getSelection();
  const root = document.getElementById('markdown-content');
  const available = readerActionsAvailable();
  const selected =
    available &&
    !!live?.rangeCount &&
    !live.isCollapsed &&
    !!root?.contains(live.getRangeAt(0).commonAncestorContainer);
  const key = String(available) + String(selected);
  if (key !== readerNativeMenuState) {
    readerNativeMenuState = key;
    bridgeSetReaderMenuState(available, selected);
  }
}

/** @param {'read'|'explain'} action */
export function runReaderShortcut(action) {
  captureReaderMenuTarget();
  runReaderMenuAction(action, true);
}

export function setupReaderMenuCapture() {
  const content = document.getElementById('markdown-content');
  /** @param {Event} event */
  const rememberBlock = (event) => {
    const node = event.target instanceof Element ? event.target : null;
    readerFocusedBlock = node?.closest('pre, .diagram-container') || null;
    readerMenuTarget = null;
  };
  syncReaderNativeMenu();
  document.addEventListener('selectionchange', () => {
    if (document.hasFocus()) syncReaderNativeMenu();
  });
  // Preserve the selected DOM range before the native menu takes focus.
  window.addEventListener('blur', captureReaderMenuTarget);
  bridgeOnReaderAction((action) => {
    if (action === 'read' || action === 'explain') {
      if (window.getSelection()?.toString()) captureReaderMenuTarget();
      runReaderMenuAction(action, true);
    }
  });
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
