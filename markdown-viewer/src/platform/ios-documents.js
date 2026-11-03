// @ts-check
import { state } from '../core/state.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { isIOSNative } from '../core/platform.js';

/** @typedef {{ id: string, token: string, context: import('../core/document-context.js').DocumentContext }} IOSDocumentView */
/** @type {IOSDocumentView | null} */
let iosDocumentView = null;
/** @type {string | null} */
let iosNativeDeliveryID = null;

/** Mark only this synchronous acceptance, never later tab/raw navigation.
 * @param {string | undefined} deliveryID
 */
export function beginIOSNativeDocumentDelivery(deliveryID) {
  const previous = iosNativeDeliveryID;
  iosNativeDeliveryID = deliveryID || null;
  return () => {
    iosNativeDeliveryID = previous;
  };
}
// Include a page epoch: renderer generation numbers restart after WebKit reload.
const iosDocumentEpoch = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** @returns {IOSDocumentView | null} */
export function getIOSDocumentView() {
  return iosDocumentView;
}
/** @param {IOSDocumentView | null} view */
export function isIOSDocumentViewCurrent(view) {
  return (
    !!view && iosDocumentView === view && isDocumentContextCurrent(view.context)
  );
}

export function syncIOSDocumentView() {
  if (!isIOSNative) return;
  const context = captureDocumentContext();
  const tab = state.tabs.find((entry) => entry.id === state.activeTabId);
  const id =
    tab?.sourceMeta?.nativeDocument?.id ||
    (tab ? `renderer-${tab.id}` : 'empty');
  const token =
    context.generation === 0 && !tab
      ? '0-0'
      : `${iosDocumentEpoch}-${context.generation}-${context.tabId || 0}`;
  if (iosDocumentView?.token !== token || iosDocumentView.id !== id) {
    iosDocumentView = { id, token, context };
    window.webkit?.messageHandlers?.specdown?.postMessage({
      action: 'documentViewChanged',
      data: {
        id,
        token,
        deliveryID: iosNativeDeliveryID,
        openIDs: state.tabs
          .map((entry) => entry.sourceMeta?.nativeDocument?.id)
          .filter(Boolean),
      },
    });
  }
  const root = context.root;
  if (!root || !tab?.sourceMeta?.nativeDocument) return;
  for (const image of root.querySelectorAll('img')) {
    const src =
      image.getAttribute('data-ios-relative-src') ||
      image.getAttribute('src') ||
      '';
    if (!src || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(src)) continue;
    let path;
    try {
      path = decodeURIComponent(src);
    } catch {
      image.removeAttribute('src');
      continue;
    }
    image.setAttribute('data-ios-relative-src', src);
    image.removeAttribute('srcset');
    image.src = `specdown-resource://${token}/${encodeURIComponent(path)}`;
  }
}

export function requestIOSImageFolder() {
  if (!iosDocumentView || !isIOSDocumentViewCurrent(iosDocumentView)) return;
  window.webkit?.messageHandlers?.specdown?.postMessage({
    action: 'authorizeImageFolder',
    data: { id: iosDocumentView.id, token: iosDocumentView.token },
  });
}

/** Refresh only the accepted view whose picker completed. @param {string} token */
export function reloadIOSDocumentImages(token) {
  if (
    !iosDocumentView ||
    !isIOSDocumentViewCurrent(iosDocumentView) ||
    iosDocumentView.token !== token
  )
    return;
  for (const image of document.querySelectorAll('img[data-ios-relative-src]')) {
    const src = image.getAttribute('src');
    if (src) {
      image.removeAttribute('src');
      image.setAttribute('src', src);
    }
  }
}

/** @param {{format: 'svg'|'png', payload: string, token: string, requestID: string}} data */
export function requestIOSDiagramExport(data) {
  window.webkit?.messageHandlers?.specdown?.postMessage({
    action: 'exportDiagram',
    data,
  });
}
