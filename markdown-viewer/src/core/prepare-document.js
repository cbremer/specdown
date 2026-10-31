// @ts-check
import { marked } from 'marked';
import { assertDocumentComplexity } from './document-limits.js';
import { sanitizeDocumentHtml } from './document-sanitizer.js';

/** Validate and prepare a document before committing its tab or visible state.
 * Reuse this result for the initial render so large documents are parsed once.
 * @param {string} content
 * @returns {{ html: string }}
 */
export function prepareMarkdownDocument(content) {
  assertDocumentComplexity(content);
  const html = /** @type {string} */ (marked.parse(content));
  return { html: sanitizeDocumentHtml(html) };
}
