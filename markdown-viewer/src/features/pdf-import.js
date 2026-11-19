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

/** @param {string} text */
export function pdfPageNeedsOCR(text) {
  return (
    text.replace(/[^\p{L}\p{N}]/gu, '').length < 12 ||
    /^(?:Page\s+)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(text.trim())
  );
}

/** @typedef {{text:string, recognized?:string, issue?:string}} ImportedPdfPage */
/** @param {ImportedPdfPage[]} pages @param {(source:string)=>boolean} admit */
export function openPdfPages(pages, admit) {
  const blocks = [];
  let recognizedPages = 0;
  let unresolved = 0;
  let hasText = false;
  for (const [index, page] of pages.entries()) {
    const selectable = page.text.replace(/\r\n?/g, '\n').trim();
    const recognized = page.recognized?.trim() || '';
    // Keep selectable lines verbatim when OCR also saw the header or footer.
    const lines = new Set(
      selectable.split(/\n/).map((line) => line.trim().toLowerCase())
    );
    const added = recognized
      .split(/\r?\n/)
      .filter((line) => !lines.has(line.trim().toLowerCase()))
      .join('\n')
      .trim();
    const text = [selectable, added].filter(Boolean).join('\n\n');
    if (text) {
      hasText = true;
      blocks.push(pdfLiteral(text));
    }
    if (added) recognizedPages++;
    if (page.issue) {
      unresolved++;
      blocks.push('> Page ' + (index + 1) + ' — ' + page.issue);
    }
  }
  if (!hasText) {
    showToast(
      'No readable text was imported. ' +
        (pages.find((page) => page.issue)?.issue || 'OCR found no text.'),
      { type: 'warning', duration: 0 }
    );
    return false;
  }
  const markdown = blocks.join('\n\n') + '\n';
  assertDocumentSize(markdown);
  const accepted = admit(markdown);
  if (accepted) {
    const notice = recognizedPages
      ? 'Text recognized on ' +
        recognizedPages +
        (recognizedPages === 1 ? ' page.' : ' pages.') +
        ' Check the transcription.'
      : 'PDF imported. Check reading order, especially in columns and tables.';
    showToast(
      notice +
        (unresolved ? ' Pages needing review are marked in the copy.' : ''),
      { type: unresolved ? 'warning' : 'info' }
    );
  }
  return accepted;
}
