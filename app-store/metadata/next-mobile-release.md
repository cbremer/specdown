# Next mobile revision — draft release material

Prepared October 31, 2026. This is review material, not an uploaded release. The approved 1.0 (11) source identity remains unchanged; choose the next marketing version and a build number above the latest accepted Apple build when Chris is ready to use App Store Connect.

## What's New draft

Improved security and reliability when opening Markdown documents, with safer handling of document content and large files. Web documents and images now use secure HTTPS connections, and recent web documents reopen only when you choose them.

Add a sentence about folding/resizing improvements only after the final iPhone Duo candidate passes its native pose and continuity checks. Do not claim Duo optimization from compilation alone.

## Reviewer context for the security revision

The Markdown viewer is bundled locally. There is no account or sign-in. External document and image loads use HTTPS; the prior arbitrary HTTP web-content exception has been removed. Tapped external links open in Safari.

Documents are limited to 8 MiB with additional rendering bounds to prevent unresponsive views. Unsupported active HTML, forms and document-provided styling are removed. Bundled Sample and Diagram Showcase remain available offline.

## Before upload

- Review the final source commit, CI, production web bundle and native candidate identity together.
- Verify Files/iCloud open, multiple tabs, comments, annotations, secure URL failures, oversized-file messages, light/dark appearance and keyboard/action-sheet behavior on physical iPhone and iPad.
- Complete the Duo open/closed/partly folded, rotation and continuity matrix before advertising support or adding Duo screenshots.
- Replace the old HTTP-exception paragraph in the existing App Review notes with the reviewer context above.
- Chris handles Apple sign-in and existing signing credentials manually. No other owner computers may be accessed.
