# App Review notes — 1.0.2

Both iOS/iPadOS and Mac App Store 1.0.1 are publicly available. These notes
are for the pending 1.0.2 update. Copy only the matching platform section into
App Store Connect → App Review Information → Notes. No sign-in is required.

## iOS / iPadOS

SpecDown is already available for iPhone, iPad and Mac, including the live Mac App Store edition. This iOS submission updates the published 1.0.1 release to version 1.0.2.

SpecDown is a viewer for Markdown (.md/.markdown) documents and Mermaid diagrams. No account, sign-in or purchase is required. The viewer and bundled Sample/Diagram Showcase work offline. It reads saved documents from external editors or AI tools; it does not generate text or run an AI model.

Review on iPhone or iPad:

1. Launch SpecDown and choose Open Diagram Showcase from the start view, or from the sidebar on iPad.
2. Expand a diagram. Try the zoom controls, pan and Reset, then close fullscreen. The diagram toolbar has no Link action.
3. Use Contents, Raw/Preview and Find. Try Find with the keyboard open, then dismiss it.
4. Open Sample to inspect headings, tables, code and document comments.
5. Choose Open File to select a Markdown file from Files, including iCloud Drive, OneDrive or Dropbox when enabled there. Opening a document from another app is also supported.
6. Open another document and switch tabs. Try light/dark appearance and the App Icon choices.

Remote documents and images loaded by the viewer require HTTPS. Tapped external web links open in the system browser. Documents are limited to 8 MiB, with additional rendering limits. Document-supplied active HTML, forms and styling are removed.

Annotation display, editing, import and export are disabled on native iPhone/iPad in this release. Existing stored annotation data is left untouched. HTML comments already present in a document are a separate viewing feature.

No ads, analytics or tracking SDK is included. Local documents render on the device; online documents and remote images contact their hosts. The app does not require an AI account.

## Mac App Store

SpecDown is already available on the Mac App Store. This submission updates the published 1.0.1 release to version 1.0.2.

SpecDown is a sandboxed Mac viewer for Markdown (.md/.markdown) documents and Mermaid diagrams. No account, sign-in or purchase is required. It reads saved documents from external editors or AI tools; it does not generate text or run an AI model.

Review on Mac:

1. Launch SpecDown and click Try diagram showcase on the start view for an offline review.
2. Choose File > Open File… (Command-O) and select a Markdown file. The system picker grants access to the selected file.
3. Expand a Mermaid diagram. Try zoom, drag to pan and Reset, then close fullscreen. The diagram toolbar has no Link action.
4. Use Raw/Preview or Split to inspect the source and result. Try Contents, Command-F and more than one document tab.
5. With Live reload on, save a change to the open file in an external editor and confirm the viewer updates. Use the Live control beside the filename to pause and resume.
6. Choose File > Open Folder... and select a folder containing two Markdown files. Open both, then choose File > Close Folder. The folder browser closes and the document tabs stay open. Workspace files only hides or shows the browser; it does not close the folder.
7. Quit and relaunch, then try File > Open Recent for the chosen file. If access is no longer available or the file moved, choose the file again through the system picker or the Locate access prompt. No Full Disk Access is required.

This Mac App Store build uses the App Sandbox and security-scoped bookmarks for user-selected files. It contains no self-updater or GitHub update check; updates are delivered through the App Store.

The viewer and bundled examples are local. Online documents and remote images require HTTPS and contact their hosts; external web links open in the system browser. Documents are limited to 8 MiB, with additional rendering limits. Document-supplied active HTML, forms and styling are removed.

This is a document viewer, not a Markdown editor. No ads, analytics or tracking SDK is included.
