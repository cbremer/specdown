# Session 07 — Local PDF OCR in Dev

Open File recognizes English text on sparse PDF pages in direct desktop Dev and iOS Dev. The importer uses the existing page-number and fewer-than-12-alphanumerics checks. It rasterizes one flagged page at a time, up to 2,200 pixels on the long edge. Desktop uses a bundled Tesseract worker and English model. iOS uses Apple Vision on the provider read queue. The converted text enters the existing Markdown editing, draft recovery and export flow.

Each import attempts up to 24 flagged pages and starts recognition jobs for up to 90 seconds. Pages with an OCR error, no readable text or a skipped attempt get numbered notes when the document contains readable text. Image regions on pages with substantial selectable text can still require manual transcription. Complex layouts and recognition errors require proofreading.

The packaged arm64 desktop viewer passed an Electron Open File, edit and export check with HTTP and HTTPS requests blocked. It recognized a scan-only fixture and inserted scanned text between selectable paragraphs in a mixed fixture. The saved Markdown contained the edit and the source PDF bytes matched. The native iPhone simulator test passed the mixed-document export and scan-only open. The scoped Jest suite passed all 1,557 tests across 93 suites. Lint and type checks passed.

The direct desktop Dev app reports 0.0.234. The paired phone reported SpecDown Dev 1.0.4 (251) after local installation. The phone was locked during the launch attempt. Physical interaction with the Files picker and OCR remains unverified. The root README now maps the independent build channels and version sources.
