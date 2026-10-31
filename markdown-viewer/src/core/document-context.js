// @ts-check
// A transient document-view identity, separate from annotation storage keys.
// Every preview/raw/empty replacement invalidates work begun on the old view.
import { state } from './state.js';

/** @typedef {{ generation: number, tabId: number | null, root: HTMLElement | null }} DocumentContext */
let documentContextGeneration = 0;

/** @returns {DocumentContext} */
export function captureDocumentContext() {
  return {
    generation: documentContextGeneration,
    tabId: state.activeTabId,
    root: document.getElementById('markdown-content'),
  };
}

/** @returns {DocumentContext} */
export function invalidateDocumentContext() {
  documentContextGeneration += 1;
  return captureDocumentContext();
}

/** @param {DocumentContext | null} context */
export function isDocumentContextCurrent(context) {
  return (
    !!context &&
    context.generation === documentContextGeneration &&
    context.tabId === state.activeTabId &&
    !!context.root?.isConnected &&
    context.root === document.getElementById('markdown-content')
  );
}
