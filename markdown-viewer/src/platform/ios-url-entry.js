// @ts-check
import { handleUrl } from '../features/file-loading.js';
import { isIOSNative } from '../core/platform.js';

/** @type {{id: string, controller: AbortController, present?: () => void} | null} */
let iosURLSession = null;

/** Reuse the native form from any visible iOS opening control.
 * @param {HTMLElement} source
 */
export function requestIOSURLEntry(source) {
  if (!isIOSNative) return;
  const rect = source.getBoundingClientRect();
  window.webkit?.messageHandlers?.specdown?.postMessage({
    action: 'openURLInput',
    data: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
    },
  });
}

export function setupIOSURLEntry() {
  if (!isIOSNative) return;
  const inline = document.getElementById('inline-url-entry');
  const button = document.getElementById('ios-open-url-button');
  if (inline) inline.hidden = true;
  if (button) {
    button.hidden = false;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      requestIOSURLEntry(button);
    });
  }
  window.specdownSubmitURL = async (url, id) => {
    iosURLSession?.controller.abort();
    /** @type {NonNullable<typeof iosURLSession>} */
    const session = { id, controller: new AbortController() };
    iosURLSession = session;
    let message = '';
    const result = await handleUrl(url.trim(), {
      signal: session.controller.signal,
      showError: (error) => {
        message = error;
      },
      deferRepository: (show) => {
        if (iosURLSession === session) session.present = show;
      },
    });
    return { ...result, message };
  };
  window.specdownCancelURL = (id) => {
    if (iosURLSession?.id !== id) return;
    iosURLSession.controller.abort();
    iosURLSession = null;
  };
  window.specdownFinishURL = (id) => {
    if (iosURLSession?.id !== id) return;
    const present = iosURLSession.present;
    iosURLSession = null;
    present?.();
  };
}
