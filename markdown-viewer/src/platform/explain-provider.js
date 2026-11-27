// @ts-check
import {
  bridgeAskExplain,
  bridgeCancelExplain,
  bridgeExplainAvailable,
} from './bridge.js';

/** @typedef {NonNullable<NonNullable<Window['specdown']>['askExplain']>} DesktopAsk */
/** @typedef {Parameters<DesktopAsk>[0]} NativeExplainRequest */
/** @typedef {Awaited<ReturnType<DesktopAsk>>} NativeExplainReply */
/** @type {Map<string, (reply: NativeExplainReply) => void>} */
const pendingIOSExplain = new Map();

/** @param {'explainAvailable'|'askExplain'} action
 * @param {{requestId:string} | NativeExplainRequest} data
 * @param {AbortSignal} [signal]
 * @returns {Promise<NativeExplainReply>}
 */
function requestIOSExplain(action, data, signal) {
  const handler = window.webkit?.messageHandlers?.specdown;
  if (!handler)
    return Promise.reject(new Error('On-device explanations are unavailable.'));
  window.specdownExplainResult = (id, reply) =>
    pendingIOSExplain.get(id)?.(reply);
  return new Promise((resolve, reject) => {
    const cancel = () => {
      finish();
      try {
        handler.postMessage({
          action: 'cancelExplain',
          data: { requestId: data.requestId },
        });
      } finally {
        reject(
          signal?.aborted
            ? new DOMException('Stopped', 'AbortError')
            : new Error('The on-device model timed out.')
        );
      }
    };
    const timer = window.setTimeout(
      cancel,
      action === 'explainAvailable' ? 3500 : 120000
    );
    const finish = () => {
      clearTimeout(timer);
      pendingIOSExplain.delete(data.requestId);
      signal?.removeEventListener('abort', cancel);
    };
    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener('abort', cancel, { once: true });
    pendingIOSExplain.set(data.requestId, (reply) => {
      finish();
      resolve(reply);
    });
    try {
      handler.postMessage({ action, data });
    } catch (error) {
      finish();
      reject(error);
    }
  });
}

let explainReason = '';
let explainRequestCounter = 0;

// Some WKWebView custom-scheme origins do not expose randomUUID.
function nextExplainRequestId() {
  return (
    crypto.randomUUID?.() ?? `explain-${Date.now()}-${++explainRequestCounter}`
  );
}

export function explainUnavailableReason() {
  return explainReason;
}

export async function explainAvailable() {
  explainReason = '';
  try {
    const reply = window.iosNative
      ? await requestIOSExplain('explainAvailable', {
          requestId: nextExplainRequestId(),
        })
      : await bridgeExplainAvailable();
    if (reply?.reason) explainReason = reply.reason;
    return reply?.available === true;
  } catch {
    return false;
  }
}

/** @param {Omit<NativeExplainRequest,'requestId'>} input
 * @param {AbortSignal} signal
 * @returns {Promise<{text:string, sourceIds:string[]}>}
 */
export async function askExplain(input, signal) {
  signal.throwIfAborted();
  const requestId = nextExplainRequestId();
  const request = { ...input, requestId };
  const cancel = () => bridgeCancelExplain(requestId);
  if (!window.iosNative)
    signal.addEventListener('abort', cancel, { once: true });
  try {
    const reply = window.iosNative
      ? await requestIOSExplain('askExplain', request, signal)
      : await bridgeAskExplain(request);
    signal.throwIfAborted();
    if (
      !reply ||
      reply.error ||
      !reply.text?.trim() ||
      !Array.isArray(reply.sourceIds)
    ) {
      throw new Error(reply?.error || 'The on-device model could not answer.');
    }
    const ids = new Set(input.excerpts.map((excerpt) => excerpt.id));
    if (reply.sourceIds.some((id) => !ids.has(id)))
      throw new Error('The answer could not be linked to this source.');
    if (!reply.sourceIds.length)
      return {
        text: 'The selected source does not answer this question.',
        sourceIds: [],
      };
    return { text: reply.text, sourceIds: [...new Set(reply.sourceIds)] };
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
