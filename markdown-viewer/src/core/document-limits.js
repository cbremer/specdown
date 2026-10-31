// @ts-check
// Keep the byte limit in sync with the Electron and iOS adapters. Check before
// reading where possible, and again before parsing for every entry point.
export const DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_MAX_NODES = 20000;
export const DOCUMENT_MAX_DIAGRAMS = 100;
export const DOCUMENT_MAX_DIAGRAM_CHARS = 50000;

/** Count UTF-8 bytes without allocating a second copy of the document. */
export function documentByteLength(/** @type {string} */ text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 < text.length &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export function assertDocumentSize(/** @type {string} */ text) {
  if (
    typeof text !== 'string' ||
    text.length > DOCUMENT_MAX_BYTES ||
    documentByteLength(text) > DOCUMENT_MAX_BYTES
  ) {
    throw new Error(
      'This document is too large. SpecDown supports files up to 8 MiB.'
    );
  }
}

export function assertDocumentComplexity(/** @type {string} */ text) {
  assertDocumentSize(text);
  const lines = text.split('\n');
  if (
    lines.length > DOCUMENT_MAX_NODES ||
    lines.some((line) => line.length > 65536)
  ) {
    throw new Error(
      'This document is too complex to display. Use fewer than 20,000 lines and shorter paragraphs.'
    );
  }
}

/** Stream remote bodies so a missing or misleading Content-Length cannot bypass the cap. */
export async function readDocumentResponse(/** @type {Response} */ response) {
  const declared = Number(response.headers?.get('content-length'));
  if (declared > DOCUMENT_MAX_BYTES) {
    await response.body?.cancel();
    throw new Error(
      'This document is too large. SpecDown supports files up to 8 MiB.'
    );
  }
  if (!response.body) return '';
  if (typeof response.body.getReader !== 'function') {
    throw new Error(
      'This document cannot be safely streamed by this browser. Download it and open the local file instead.'
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > DOCUMENT_MAX_BYTES) {
        await reader.cancel();
        throw new Error(
          'This document is too large. SpecDown supports files up to 8 MiB.'
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
