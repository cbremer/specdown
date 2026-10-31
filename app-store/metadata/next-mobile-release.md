# Next mobile revision — draft release material

Prepared October 31, 2026. This is review material, not an uploaded release. Source version settings remain 1.0 (11); choose the next marketing version and an unused build number after Chris checks Apple build history. Chris requested TestFlight testing before App Review submission; see [Session 16](../../docs/project-appstore/2026-10-31-tasks-session-16-testflight-boundary.md) for the exact-build handoff and acceptance gates.

## What's New draft

Security and reliability improvements for opening Markdown documents.

- Safer handling of document content, oversized files and complex diagrams.
- Web documents and remote images now require HTTPS.
- Fullscreen diagrams stay centered when the view changes size. Zoom controls center the diagram, and Reset fits the current view.
- Improved layouts during folding and rotation, plus better Find controls when the keyboard is open.

The layout copy describes implemented behavior with simulator interaction evidence in Session 14. Finalize it after the exact TestFlight build passes the applicable physical-device checks; do not claim physical Duo testing or universal compatibility. The initial-release `en-US/ios.json` still needs the accepted next-version What's New text when preparing that version's listing.

## Reviewer context for the security revision

SpecDown is a Markdown viewer with Mermaid diagrams. No account or sign-in is required. The viewer, Sample and Diagram Showcase are bundled and available offline.

To review, open Diagram Showcase, expand a diagram, and try the zoom controls and Reset. Use Contents to navigate and Raw/Preview to switch views. Find remains available while the keyboard is open. Use Open or Browse Files to select a Markdown document from Files.

Remote documents and images loaded inside the viewer require HTTPS. Tapped external web links open in the system browser. Documents are limited to 8 MiB, with additional rendering limits. Document-supplied active HTML, forms and styling are removed.

Annotations are not enabled in this iPhone/iPad release: annotation display, editing, import and export are disabled. Any existing stored annotation data is left untouched.

## Acceptance and submission gates

- Review the final source commit, CI, production web bundle and native candidate identity together.
- Verify Files/iCloud open, multiple tabs, comment viewing, secure URL failures, oversized-file messages, light/dark appearance and keyboard/action-sheet behavior on physical iPhone and iPad using the exact processed TestFlight build. Verify annotations stay unavailable and existing annotation data is preserved.
- Record upgrade-from-1.0 and data-preservation results without deleting the installed app. Keep the physical Duo and remaining runtime gaps explicit; do not count simulator results as physical-device results.
- The HTTP-exception paragraph in `review-notes.md` is already corrected. Incorporate the current reviewer context above when finalizing the next version, and replace the first-release What's New text in `en-US/ios.json`.
- Use a Store-capable upload, then select the same tested build for App Review after the TestFlight gate passes. Public release remains owner-controlled.
- Chris handles Apple sign-in and existing signing credentials manually. No other owner computers may be accessed.
