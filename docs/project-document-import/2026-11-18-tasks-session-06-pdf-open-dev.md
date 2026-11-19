# Session 06 — PDF text import in Dev

November 18, 2026.

Open File accepts PDF in desktop Dev and iOS Dev. Electron extracts text using a bundled PDF.js worker and offline character maps and fonts. iOS extracts page strings with PDFKit during the coordinated provider read. Both feed the shared Markdown editor, recovery store and Save as Markdown action. The original PDF has no writable tab path or native editing URL.

Page order is preserved. For a mixed file, empty pages and pages with little text get an editable, numbered OCR notice in the reading copy and the saved Markdown. The sparse-page check uses fewer than 12 letters or digits, or a page-number pattern. An image-only PDF shows an OCR message and keeps the current document open. OCR flags are a heuristic. A blank page can be flagged and an image on a page with substantial selectable text can go undetected. Columns and table geometry can flatten during extraction.

Local limits are 500 pages and the existing 8 MiB document size limit. Password-protected or copying-restricted PDFs require an accessible copy.

Electron checks exercised Open File for text-only, two-column/table, mixed and image-only fixtures. The two-column fixture retained the expected fields and column order. The mixed-file export included the edit and page 2 OCR notice. The original PDF bytes matched after export. iPhone simulator tests used the native open and export picker controllers with synthetic selections, including the scanned-file rejection and saved bytes. DOCX regression, scoped Jest (93 suites, 1,557 tests), lint and strict type checking passed.

The macOS arm64 Dev package and locally signed iOS Dev package matched the validated viewer assets. The paired iPhone reported SpecDown Dev 1.0.4 (250) installed. iOS declined remote launch while the phone was locked. Physical interaction with Files remains unverified.
