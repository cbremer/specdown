import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DOCUMENT_MAX_BYTES } from '../core/document-limits.js';

import { pdfPageNeedsOCR } from '../features/pdf-import.js';
import { showToast, dismissToast } from '../features/toast.js';

async function createPdfOcrWorker() {
  const { createWorker, OEM } = await import('tesseract.js');
  const assets = new URL('pdf-ocr/', document.baseURI);
  return createWorker('eng', OEM.LSTM_ONLY, {
    langPath: assets.href,
    workerPath: new URL('worker.min.js', assets).href,
    corePath: new URL('tesseract-core-lstm.wasm.js', assets).href,
    workerBlobURL: false,
    cacheMethod: 'none',
    errorHandler: () => {},
  });
}

/** PDF bytes came from the bounded native reader. Load the parser only for PDF.
 * @param {string} encoded @returns {Promise<import('../features/pdf-import.js').ImportedPdfPage[]>} */
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
    standardFontDataUrl: new URL('pdf-data/standard_fonts/', document.baseURI)
      .href,
    disableFontFace: true,
    useSystemFonts: false,
  });
  let timer;
  /** @type {ReturnType<typeof createPdfOcrWorker> | undefined} */
  let recognition;
  /** @type {HTMLElement | undefined} */
  let progress;
  let closed = false;
  let attempts = 0;
  const start = performance.now();
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
      /** @type {import('../features/pdf-import.js').ImportedPdfPage} */
      const entry = { text: parts.join('') };
      if (pdfPageNeedsOCR(entry.text)) {
        if (attempts >= 24 || performance.now() - start > 90000) {
          entry.issue = 'OCR limit reached. Open this page in a smaller PDF.';
        } else {
          attempts++;
          progress ??= showToast('Recognizing scanned text…', { duration: 0 });
          progress.textContent =
            'Recognizing text on page ' + i + ' of ' + pdf.numPages + '…';
          const canvas = document.createElement('canvas');
          try {
            recognition ??= createPdfOcrWorker();
            const engine = await recognition;
            if (closed) throw Error('Import ended.');
            const bounds = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({
              scale: Math.min(3, 2200 / Math.max(bounds.width, bounds.height)),
            });
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvas, viewport, background: 'white' })
              .promise;
            const result = await engine.recognize(canvas);
            entry.recognized = result.data.text.trim();
            if (!entry.recognized) entry.issue = 'OCR found no readable text.';
          } catch {
            entry.issue = 'Text recognition failed.';
          } finally {
            canvas.width = canvas.height = 0;
          }
          if (closed) throw Error('Import ended.');
          length += entry.recognized?.length || 0;
          if (length > DOCUMENT_MAX_BYTES)
            throw Error('Extracted PDF text exceeds 8 MiB.');
        }
      }
      pages.push(entry);
      page.cleanup();
    }
    return pages;
  }
  try {
    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(
        () => reject(Error('This PDF took too long to import.')),
        120000
      );
    });
    return await Promise.race([
      extract(),
      /** @type {Promise<never>} */ (timeout),
    ]);
  } finally {
    closed = true;
    if (progress) dismissToast(progress);
    void recognition?.then((engine) => engine.terminate()).catch(() => {});
    clearTimeout(timer);
    // Terminate the dedicated parser even when it cannot respond to cancellation.
    void task.destroy().catch(() => {});
    worker.destroy();
    port.terminate();
  }
}
