import { showToast } from './toast.js';
import { assertDocumentSize } from '../core/document-limits.js';

/** Escape PDF text before feeding it to the Markdown renderer. @param {string} text */
function pdfLiteral(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/([\\`*_[\]~|])/g, '\\$1')
    .replace(
      /^(\s*)([#>+\-=]|\d+[.)])(?=\s|$)/gm,
      (_, space, token) => space + token.slice(0, -1) + '\\' + token.slice(-1)
    );
}

/** @param {string[]} pages @param {(source:string)=>boolean} admit */
export function openPdfPages(pages, admit) {
  const blocks = [];
  const flagged = [];
  let hasText = false;
  for (const [index, page] of pages.entries()) {
    const text = page.replace(/\r\n?/g, '\n').trim();
    if (text) {
      blocks.push(pdfLiteral(text));
      hasText = true;
    }
    // A short header or page number can sit above a scanned page body.
    if (
      text.replace(/[^\p{L}\p{N}]/gu, '').length < 12 ||
      /^(?:Page\s+)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(text)
    ) {
      flagged.push(index + 1);
      blocks.push(
        '> Page ' +
          (index + 1) +
          (text ? ' has little selectable text.' : ' has no selectable text.') +
          ' OCR may be needed.'
      );
    }
  }
  if (!hasText) {
    showToast(
      'This PDF has no selectable text. Run OCR on the PDF and open it again.',
      { type: 'warning', duration: 0 }
    );
    return false;
  }
  const markdown = blocks.join('\n\n') + '\n';
  assertDocumentSize(markdown);
  const accepted = admit(markdown);
  if (accepted) {
    const notice = flagged.length
      ? 'Check pages ' +
        flagged.slice(0, 12).join(', ') +
        (flagged.length > 12 ? ' and others' : '') +
        ' for OCR. Each is marked in the copy.'
      : 'PDF imported. Check reading order, especially in columns and tables.';
    showToast(notice, { type: flagged.length ? 'warning' : 'info' });
  }
  return accepted;
}
