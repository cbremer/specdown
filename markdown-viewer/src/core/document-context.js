// @ts-check
// A transient document-view identity, separate from annotation storage keys.
// Every preview/raw/empty replacement invalidates work begun on the old view.
import { state } from './state.js';

/** @typedef {{ generation: number, tabId: number | null, root: HTMLElement | null }} DocumentContext */
let documentContextGeneration = 0;
/** @type {() => void} */
let documentContextInvalidationHandler = () => {};

/** The app owns synchronous cleanup at the accepted-view replacement boundary.
 * Keep feature imports out of this core module.
 * @param {{ onInvalidate: () => void }} handlers
 */
export function configureDocumentContext({ onInvalidate }) {
  documentContextInvalidationHandler = onInvalidate;
}

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
  documentContextInvalidationHandler();
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
