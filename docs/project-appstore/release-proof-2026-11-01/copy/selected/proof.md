# SpecDown 1.0.1 — selected release copy

**Selected for this release pass: the retained copy saved in App Store Connect during Session 43.** The optional AI-workflow refinements from Session 49 are preserved separately and are deferred; their synchronization is not a release blocker. Chris still proofs the selected wording and final production TestFlight builds before app-build App Review. Public release stays manual.

This proof uses exact copies of the retained baseline field files. The historical portal readbacks cover iOS promotional text, description, What’s New, keywords and reviewer notes, and Mac promotional text, description, keywords and reviewer notes. This selection task did not access or change the portal. Subtitle, URLs and other App Information values are retained baseline values; no fresh portal verification is claimed. Mac What’s New remains prepared reference text because the initial Mac version did not expose that field.

- Shared selected subtitle: **Markdown & Mermaid viewer**.
- [Selection and provenance](../selection.json).
- [Selected copy validation](validation.json).
- [Optional later AI-workflow proof](../proof.md), preserved unchanged during this selection task. Its original “current local draft” and pending-sync wording describes that earlier proposal, not the copy selected by Session 51.

## iPhone and iPad

### Name

SpecDown

### Subtitle

Markdown & Mermaid viewer

### Promotional text

Read Markdown on iPhone and iPad. Explore Mermaid diagrams, inspect code and tables, and keep your specs, plans and READMEs easy to follow.

### Description

Turn saved Markdown into a clear, readable document on iPhone and iPad.

SpecDown helps you review specs, plans, READMEs and technical notes, with formatted tables, highlighted code and interactive Mermaid diagrams. Open Markdown created in your preferred editor or AI assistant, then take a closer look at the details.

READ YOUR DOCUMENTS
• Open Markdown from Files or iCloud Drive
• Send a Markdown document to SpecDown from another app
• Read headings, lists, tables and highlighted code
• Jump between sections with the table of contents
• Find text and move through matching passages
• Switch between the rendered preview and raw Markdown
• Keep several documents open in tabs

EXPLORE MERMAID DIAGRAMS
• View flowcharts, sequence diagrams, state diagrams and Gantt charts
• Expand a diagram to zoom and pan
• Use Reset to fit the diagram to the current view

MAKE READING COMFORTABLE
• Choose light, dark or system appearance
• Use the iPad sidebar to open files and bundled examples
• Choose from eight app icons, including a separate Light option

The bundled Sample and Diagram Showcase work offline. Local documents render on your device. Opening an online document or loading a remote image connects to its host.

No account is required. SpecDown has no ads or analytics.

### Keywords

readme,flowchart,sequence,gantt,uml,specs,docs,reader,code,tables,architecture,planning

### What’s New

Security and reliability improvements for reading Markdown.

• Safer handling of document content, large files and complex diagrams.
• Web documents and remote images now require HTTPS.
• Rejected documents leave your current document intact.
• Improved Find behavior for documents with many matches and when the keyboard is open.
• Diagram zoom controls center the diagram, and Reset fits the current view.
• Better fullscreen focus and cleanup when switching documents or views.
• A separate Light app icon, plus improved sizing for the existing alternate icons.

### App Review notes

SpecDown is a viewer for Markdown (.md/.markdown) documents and Mermaid diagrams. No account, sign-in or purchase is required. The viewer and bundled Sample/Diagram Showcase work offline. It reads saved documents from external editors or AI tools; it does not generate text or run an AI model.

Review on iPhone or iPad:
1. Launch SpecDown and choose Open Diagram Showcase from the start view, or from the sidebar on iPad.
2. Expand a diagram. Try the zoom controls, pan and Reset, then close fullscreen.
3. Use Contents, Raw/Preview and Find. Try Find with the keyboard open, then dismiss it.
4. Open Sample to inspect headings, tables, code and document comments.
5. Use Open or Open Markdown File to choose a Markdown file from Files/iCloud Drive. Opening a document from another app is also supported.
6. Open another document and switch tabs. Try light/dark appearance and the App Icon choices.

Remote documents and images loaded by the viewer require HTTPS. Tapped external web links open in the system browser. Documents are limited to 8 MiB, with additional rendering limits. Document-supplied active HTML, forms and styling are removed.

Annotation display, editing, import and export are disabled on native iPhone/iPad in this release. Existing stored annotation data is left untouched. HTML comments already present in a document are a separate viewing feature.

No ads, analytics or tracking SDK is included. Local documents render on the device; online documents and remote images contact their hosts. The app does not require an AI account.

### Support URL

https://specdown.mosaicpando.com/support.html

### Marketing URL

https://specdown.mosaicpando.com/

### Privacy policy URL

https://specdown.mosaicpando.com/privacy.html

### Copyright

2026 SpecDown

## Mac App Store

### Name

SpecDown

### Subtitle

Markdown & Mermaid viewer

### Promotional text

Read Markdown beside your editor. Compare source and preview, explore Mermaid diagrams, and inspect the details in specs, plans and READMEs.

### Description

Keep a clear view of your Markdown on Mac.

SpecDown is a reader for specs, plans, READMEs and technical notes. Review saved Markdown from your editor or AI assistant as a formatted document, with tables, highlighted code and interactive Mermaid diagrams.

SEE SOURCE AND RESULT
• Open Markdown files from your Mac
• Compare raw Markdown and the rendered preview in split view
• Keep several documents open in tabs
• Jump through headings with the table of contents
• Find text with Command-F

EXPLORE THE DIAGRAMS
• View Mermaid flowcharts, sequence diagrams, state diagrams and Gantt charts
• Expand a diagram to zoom and pan
• Use Reset to fit the diagram to the current view

FOCUS ON THE DETAILS
• Read formatted headings, lists, tables and highlighted code
• Choose light, dark or system appearance
• Try the bundled Diagram Showcase offline

Open a file through the system file picker to give SpecDown access to it. Local documents render on your Mac. Opening an online document or loading a remote image connects to its host.

No account is required. SpecDown has no ads or analytics.

### Keywords

preview,readme,flowchart,sequence,gantt,uml,specs,docs,code,tables,architecture,split

### What’s New

SpecDown arrives on the Mac App Store.

Read Markdown with tables, highlighted code and Mermaid diagrams. Compare source and preview in split view, keep documents in tabs, and explore diagrams with fullscreen zoom, pan and Reset.

### App Review notes

SpecDown is a sandboxed Mac viewer for Markdown (.md/.markdown) documents and Mermaid diagrams. No account, sign-in or purchase is required. It reads saved documents from external editors or AI tools; it does not generate text or run an AI model.

Review on Mac:
1. Launch SpecDown and click Try diagram showcase on the start view for an offline review.
2. Choose File > Open... (Command-O) and select a Markdown file. The system picker grants access to the selected file.
3. Expand a Mermaid diagram. Try zoom, drag to pan and Reset, then close fullscreen.
4. Use Raw/Preview or Split to inspect the source and result. Try Contents, Command-F and more than one document tab.
5. Quit and relaunch, then try File > Open Recent for the chosen file. If access is no longer available or the file moved, choose the file again through the system picker or the Locate access prompt. No Full Disk Access is required.

This Mac App Store build uses the App Sandbox and security-scoped bookmarks for user-selected files. It contains no self-updater or GitHub update check; updates are delivered through the App Store.

The viewer and bundled examples are local. Online documents and remote images require HTTPS and contact their hosts; external web links open in the system browser. Documents are limited to 8 MiB, with additional rendering limits. Document-supplied active HTML, forms and styling are removed.

This is a document viewer, not a Markdown editor. No ads, analytics or tracking SDK is included.

### Support URL

https://specdown.mosaicpando.com/support.html

### Marketing URL

https://specdown.mosaicpando.com/

### Privacy policy URL

https://specdown.mosaicpando.com/privacy.html

### Copyright

2026 SpecDown

## Remaining proof

- [ ] Chris proofs the selected wording and final required screenshots.
- [ ] Verify the selected values against the applicable draft listing before final submission; preserve existing reviewer contacts and account/legal answers.
- [ ] Complete exact production 1.0.1 (229) signing, TestFlight acceptance and owner release proof.
- [ ] Submit app builds only after those gates; keep public release manual.

The approved Halo Header remains unchanged. Search Results artwork is Waiting for Review following Session 50; that separate creative review is not a prerequisite to starting build delivery.
