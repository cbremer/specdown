import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DOCUMENT_MAX_BYTES } from '../core/document-limits.js';

/** PDF bytes came from the bounded native reader. Load the parser only for PDF.
 * @param {string} encoded @returns {Promise<string[]>} */
export async function extractDesktopPdf(encoded) {
  const { getDocument, PDFWorker, PermissionFlag } = await import('pdfjs-dist');
  const binary = atob(encoded);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < data.length; i++) data[i] = binary.charCodeAt(i);
  const port = new Worker(workerUrl, { type: 'module' });
  const worker = PDFWorker.create({ port });
  const task = getDocument({
    data,
    worker,
    stopAtErrors: true,
    useWasm: false,
    useWorkerFetch: false,
    cMapUrl: new URL('pdf-data/cmaps/', document.baseURI).href,
    standardFontDataUrl: new URL('pdf-data/standard_fonts/', document.baseURI).href,
    disableFontFace: true,
    useSystemFonts: false,
  });
  let timer;
  async function extract() {
    const pdf = await task.promise;
    if (pdf.numPages > 500)
      throw Error('Choose a PDF with 500 pages or fewer.');
    const permissions = await pdf.getPermissions();
    if (permissions && !permissions.has(PermissionFlag.COPY))
      throw Error('This PDF restricts text copying.');
    const pages = [];
    let length = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const reader = page.streamTextContent().getReader();
      const parts = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const item of value.items) {
          if (typeof item.str !== 'string') continue;
          const fragment = item.str + (item.hasEOL ? '\n' : '');
          length += fragment.length;
          if (length > DOCUMENT_MAX_BYTES)
            throw Error('Extracted PDF text exceeds 8 MiB.');
          parts.push(fragment);
        }
      }
      pages.push(parts.join(''));
      page.cleanup();
    }
    return pages;
  }
  try {
    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(
        () => reject(Error('This PDF took too long to import.')),
        20000
      );
    });
    return await Promise.race([
      extract(),
      /** @type {Promise<never>} */ (timeout),
    ]);
  } finally {
    clearTimeout(timer);
    // Terminate the dedicated parser even when it cannot respond to cancellation.
    void task.destroy().catch(() => {});
    worker.destroy();
    port.terminate();
  }
}
