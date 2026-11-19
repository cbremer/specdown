# Session 05 — Open Word and save Markdown in Dev

November 18, 2026.

- Added DOCX to the existing Open File pickers in macOS desktop Dev and iOS Dev. Both shells use their existing bounded file reader and deliver the document to the same local WordprocessingML converter. The desktop tab has no writable Word path. The iOS source can be reopened from recents and receives no editing URL for the Word file.
- Edit opens the converted Markdown. Save as Markdown suggests the source basename with a .md extension and uses the existing system destination picker. After a successful export the saved Markdown opens in its own tab. Draft recovery retains the Word import marker and export behavior.
- The reader extracts main-document text, common heading styles, bold and italic runs, list items as bullets, and simple tables. Images, page layout, link destinations, headers, footers, comments and complex numbering are outside this subset. Password-protected documents and legacy .doc files are unsupported. The ZIP and main XML part each have an 8 MiB limit.
- The Electron test drives Open File with a deflated DOCX fixture and a test-selected destination. The iPhone simulator test exercises the real WKWebView and native open/export picker controllers with a synthetic selection and provider completion. Tests compare the edited Markdown, original Word bytes, tracked-change text, heading, and table. These checks cover the app flow. Physical Files provider acceptance is still open.
- Local desktop output is `dist/development-edit-save/mac-arm64/SpecDown Dev.app`. The paired phone reported SpecDown Dev 1.0.4 (249) installed. iOS declined the remote launch while the phone was locked. The signed app's bundled viewer matched the validated build. Work used local development signing.
