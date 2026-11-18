# SpecDown source editing and experimental document import PRD

Status — updated planning draft, November 18, 2026. The owner confirmed source editing for the next version and experimental document import. Detailed behaviors below remain the planning specification.

## Product outcome

Read Markdown, choose Edit, make a quick source change, and save it from SpecDown. The next version includes lightweight source editing and an experimental document-import integration. Imported content opens as a converted Markdown copy that can also be edited, saved, or shared. Local documents convert on the device. People can understand where a copy came from, what conversion may have lost, and how to reopen the source.

The intended reader has specs, reports, plans, and research in several formats and wants a consistent reading experience with headings, search, readable tables, code, and accessible navigation.

## Direction supplied by the owner

- Cover Word, PDF, and Google Docs.
- Develop desktop and mobile in parallel.
- Prefer on-device processing.
- Produce a functional PRD and an execution plan in Linear at this stage.
- Include lightweight Markdown source editing and saving in the next version.
- Treat document import as an experimental integration in that version.

## Proposed product decisions

These choices make the draft actionable and remain open to owner revision.

- Desktop covers direct macOS, Windows, and Linux editions plus the sandboxed Mac App Store edition. Mobile covers the existing iPhone and iPad app. Android and browser/PWA import are future scope.
- The next version provides source editing for existing Markdown documents on desktop and iPhone/iPad. The import experiment initially qualifies local DOCX and text-bearing PDF on-device. MarkItDown is the named experiment candidate; whether it can deliver the preferred local behavior on each platform is a discovery outcome.
- Scanned PDF support is a follow-on increment with its own on-device recognition acceptance. Mixed PDFs disclose pages that need recognition in the initial release.
- Direct Google Docs opening remains planned as an extension with its own account-access qualification. Downloaded DOCX is an alternate path through the experiment. Proposed sequencing places Google authorization after the first local-import experiment, without making it a prerequisite for the next version.
- Local import has no account requirement. Conversion has no hosted fallback. An unavailable local capability produces actionable guidance.
- A successful import creates a managed reading copy on this device. Refresh is an explicit action. Markdown export is an independent copy.
- Source editing uses explicit saves. Recoverable local drafts support interruption recovery. Source conversion and remote refresh cannot replace an unsaved edit draft.

## Next-version source editing

### Edit journey

1. Open an existing Markdown document and choose Edit from desktop controls or mobile document actions.
2. Edit its Markdown source in a lightweight text area with selection, copy/paste, multiline input, and undo/redo.
3. Switch to Preview to check rendered text and Mermaid diagrams, then return to the same unsaved draft and editing position.
4. Choose Save, Save As, or Cancel. Show an unsaved-changes indicator whenever the draft differs from its last saved state.
5. Before an action that discards edits, offer Save, Discard, and Keep editing. Merely switching tabs or checking Preview preserves the draft.

### E1 — Draft and preview

Editing is an explicit mode on the current document. Each tab has its own draft and undo history. Ordinary navigation and opening another document retain the draft. Preview renders the current draft and reports malformed Mermaid without losing the source. Cancel discards changes only after an explicit discard choice when the draft is dirty and returns to the last accepted reading version. Undoing all changes clears the unsaved indicator. Existing Markdown characters and document content outside the intended edit are preserved, including significant whitespace.

### E2 — Save destination

| Document origin                                  | Save outcome                                                                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Markdown with valid write access           | Save updates that selected original file. Save As chooses a different destination.                                                                                                                                  |
| Read-only or unavailable local/provider document | Retain the draft and offer Retry, reconnect/locate when relevant, or Save As.                                                                                                                                       |
| URL, sample, or saved snapshot                   | Save As creates a Markdown file at the user's chosen destination. The destination becomes the active saved source when the app has reusable access; otherwise the document remains a clearly identified saved copy. |
| Experimental Word/PDF/Google-derived copy        | Save updates the local Markdown reading copy. Save As exports Markdown and any retained assets using F5. Its origin remains visible.                                                                                |

The action and destination make it clear whether the user is updating a file, updating a local converted copy, or creating an exported Markdown copy. Saving a converted copy writes Markdown and preserves its source reference. It does not update the original Word/PDF/Google document. The user confirms any destination overwrite. Existing source permissions are rechecked for the requested write.

### E3 — Save completion and conflict behavior

The current draft stays available throughout saving. Report Saved only after the destination confirms success. Permission loss, provider failure, full storage, and canceled destination selection retain the unsaved draft and offer recovery. A successful save applies to the version submitted; typing more while that save is pending leaves the newer draft marked unsaved.

If a source changes outside SpecDown while its draft is dirty, preserve the draft and identify the conflict. Offer Save As, explicitly confirmed overwrite of the current source, or an explicitly confirmed discard/reload. Live reload cannot silently overwrite edits. If a source changes again during a conflict decision or save, re-evaluate that conflict rather than overwriting a newly changed version. SpecDown's own successful save updates the reading view and file state without creating a duplicate external-change warning. Closing a tab/window with unsaved changes offers Save, Discard, and Keep editing. Choosing Save closes only after successful completion.

### E4 — Recovery and mobile behavior

Retain recoverable unsaved drafts locally across supported app interruption and restart behavior. On reopening, offer Restore draft or Discard draft and show the affected source. Restoration grants no file access and never writes to the source automatically. If recovery storage fails, keep the in-memory draft, explain the limitation, and offer saving/export. Recovery storage stays on the device and removal is explicit.

iPhone and iPad expose edit, preview, save, save-as, and cancel through reachable controls with the keyboard visible, large text, VoiceOver, touch, and hardware keyboards. File-provider write permission and successful local saving remain distinct from a provider finishing its own remote synchronization. Label provider failures honestly. Offline editing and saving work when the selected source/destination is available locally.

### E5 — Existing reading, notes, and refresh

Editing applies to Markdown already supported by SpecDown and to accepted experimental converted copies. It requires no document-import capability for ordinary Markdown. Existing Markdown reading, recents, bookmarks, and source identity continue to work. Same-name documents and their drafts remain distinct. Saving to the same authorized document retains its established note collection; changed or removed passages follow existing unresolved-note/recovery behavior. Save As creates an independent source and does not silently attach the old collection.

Import refresh, Replace copy, reload, and conversion completion cannot discard a dirty source draft. The user first chooses Save, Discard, or Keep editing, and can preserve a separate version. Refresh after local edits to a converted reading copy also requires an explicit replacement/keep-both choice even when the local edits have already been saved. Retain local assets when edited converted copies are saved, and disclose asset omissions in text-only exports.

### Editing acceptance

| ID  | Scenario and required result                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Open local Markdown, edit a paragraph or Mermaid source, preview, save, and reopen. The intended change persists and unrelated content remains intact.                                            |
| B2  | Keep separate drafts in two tabs, preview and return, undo/redo, and switch documents. Drafts and undo histories remain independent.                                                              |
| B3  | Close/cancel with dirty content and exercise Save, Discard, and Keep editing. Failed or canceled saving retains the draft and prevents the requested close.                                       |
| B4  | Another app changes the source while editing, or the source changes again during save. Preserve the draft and resolve the conflict explicitly.                                                    |
| B5  | Lose file permission, fill storage, or fail provider saving. Preserve edits and offer Retry/Save As. A late save acknowledgment cannot mark newer edits as saved.                                 |
| B6  | Background/restart on iPhone/iPad and restart desktop. Offer recoverable local drafts, retain source identity, and require explicit restoration. Report recovery-storage failure.                 |
| B7  | Edit a URL, sample, read-only file, or snapshot and save a Markdown copy to an explicit destination. Verify overwrite, cancellation, and actual destination behavior.                             |
| B8  | Edit a converted document, save its local Markdown copy, export its assets, and attempt source refresh. Preserve edited content until the user's explicit replacement decision.                   |
| B9  | Edit an annotated desktop file and use Save and Save As. Notes remain with the proper source and changed anchors enter established recovery behavior.                                             |
| B10 | Complete editing and save actions with VoiceOver/large text, desktop keyboard, touch, and iPad keyboard. Offline edits work for local files, with provider status distinguished from remote sync. |

## User journeys

### Open a document on desktop

1. Choose Open or drag a DOCX/PDF into the viewer. An Import document command provides another discoverable entry point.
2. See the filename and a conversion state. Continue using other open documents while conversion runs.
3. Read the completed copy in a new document tab. Its details identify the original format, source name, conversion time, and any detected conversion limitations.
4. Search, navigate headings, change reading appearance, and use the reading controls available in that edition.
5. Choose Open original, Save as Markdown, or Refresh from source when applicable.

OS Open With is supported when the OS offers SpecDown for the selected file type. Installing SpecDown leaves default file-handler choices to the user. Selecting several files presents independent imports with individual results.

### Open a document on iPhone or iPad

1. Choose Open document from SpecDown's mobile actions and select a file through Files or a compatible provider. Open in SpecDown from another app accepts an actual supported file when supplied.
2. See an accessible conversion state with Cancel. The current document remains available while the import is pending.
3. Read the completed copy. All new actions are reachable from the iPhone action sheet and iPad controls.
4. Save or share the converted copy through the system destination chooser.

If another app supplies a Google Docs link instead of a file, SpecDown offers the Google Docs journey. If it supplies an unsupported link or payload, SpecDown explains what can be opened and offers file selection. A dedicated extension inside every source app's share menu is outside the initial scope.

### Open a Google Doc — planned extension

1. Choose Open Google Doc and paste a normal Google Docs document link.
2. If access requires it, connect a Google account and authorize access to the selected document. See which account is being used and an explanation of the requested access.
3. Retrieve the document and open its converted reading copy. Display its title, Google Docs origin, and last retrieved time.
4. Reopen the saved copy offline. Choose Refresh from Google Docs when online to retrieve a newer version.
5. Choose Open original to open the Google Docs URL, or disconnect Google from SpecDown settings.

Permission denied, wrong account, canceled authorization, revoked access, offline retrieval, and export restrictions each produce a specific recovery action. A public-looking link still follows Google's actual permissions. Unsupported Docs link variants receive guidance. Existing HTTPS Markdown opening continues to use its established behavior.

Disconnecting stops future access through SpecDown and explains how to remove retained local copies separately. It preserves the user's existing reading copy until the user removes it. A user can also download a Google Doc as DOCX using Google and import that file locally.

## Format behavior

| Source               | Planned import behavior                                                                                                                                        | Conversion limitations to surface                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOCX                 | Preserve supported headings, paragraphs, emphasis, lists, links, simple tables, and embedded raster images in document order.                                  | Complex layout, text boxes, equations, charts, comments, tracked changes, and unsupported drawings may lose structure or content.                          |
| Text-bearing PDF     | Extract available text into a readable document with page references where available. Preserve reliable paragraph order and simple structure when recoverable. | Columns, tables, headers/footers, figures, and positioned text can be ambiguous. Extracted text alone does not establish correct reading order.            |
| Google Docs          | Retrieve the selected document through Google's permitted export and display a local reading copy. Apply the same reading and quality rules.                   | Export may omit Google-specific features, comments, suggestions, or visual structure.                                                                      |
| Scanned or mixed PDF | Identify pages with little or no extractable text and identify affected pages when possible. Offer the readable portion with a warning when useful.            | An image-only document has a clear recognition-needed result rather than an empty successful document. On-device recognition follows in a later increment. |

Legacy `.doc`, encrypted/password-protected documents, spreadsheets, presentations, handwriting recognition, and diagram-to-Mermaid generation are outside the initial supported format set. A protected document offers guidance to create an accessible copy in the source app. SpecDown never requests a document password in this release.

For DOCX tracked changes, display the final document text with insertions included and deletions excluded, and disclose that revision history and comments are omitted. If a candidate converter cannot reliably honor that rule, return an unsupported-content result for that document. Preserve equations/charts as source images where available, otherwise identify the omission. Detectable missing content always produces a warning.

## Functional requirements

### F1 — Select and acquire a document

Use the access the user grants for the selected item. A filename or prior import never grants access to another item. Provider download has its own state when the selected file is stored online. Already accessible local files can be imported in airplane mode. Importing a new file keeps each existing reading copy available.

### F2 — Conversion lifecycle

The user can distinguish waiting for a provider, retrieving a Google Doc, converting, ready, ready with warnings, canceled, and failed. Show determinate progress only when it can be measured. Repeated activation while one import is pending focuses that import instead of producing accidental duplicates. An intentional separate import can create another copy.

Cancel stops that request from becoming an accepted reading copy, including a late result. Failure or cancellation leaves existing documents and saved copies usable. After an interruption or app termination, an incomplete import is offered for retry when access remains available. A successful import appears in recents once.

### F3 — Reading and conversion disclosure

The document header identifies a converted copy. Details explain its source, time, local processing, and detected omissions. A compact notice links to details when conversion has warnings. Every converted PDF also explains that layout and reading order may differ even when no specific loss is detected. Avoid an inferred quality percentage.

Support search, table of contents when headings exist, source/preview viewing, appearance controls, and supported print/export actions. Raw view displays the converted Markdown. Converted diagrams remain images unless a valid Mermaid block is already available as text. Desktop notes use existing annotation behavior. Native iOS follows its current reading capabilities.

### F4 — Images, tables, and links

Embedded images needed for the accepted reading copy remain available offline within supported resource limits. Give images accessible descriptions when source descriptions exist. Mark unsupported or omitted visuals in the conversion details. Simple tables remain readable, including horizontal navigation on small screens. Complex tables may become readable text with a warning.

External links open through established link behavior. Remote images and linked external resources require an explicit user action before fetching in a converted document. Explain that loading them contacts their host. Follow source-internal links when the corresponding destination survives conversion. Explain unavailable destinations when activated. Import never executes source scripts, macros, or embedded active content.

### F5 — Save and share

Save as Markdown proposes the source document name with `.md`. The user chooses the destination and confirms any overwrite through the platform's normal behavior. The original stays intact.

Text-only output can be saved or shared as one `.md` file. A copy with local image assets offers a portable ZIP containing Markdown and relative assets. Explain the package before export and offer a text-only `.md` alternative with an omission warning. A separately exported copy opens independently of SpecDown's private storage. Canceling or failing an export leaves the reading copy available and never reports a successful save.

### F6 — Recents, bookmarks, refresh, and removal

Accepted imports appear in recents as saved converted copies with their original format and conversion time. They reopen from local storage after restart and offline, subject to device storage and the user clearing app data. Bookmarking follows existing saved-copy behavior. The user can remove a local imported copy and its retained assets with a clear confirmation. Removing a recent entry alone has no ambiguous deletion side effect. A separate Remove imported copy action identifies what will be deleted. Existing note recovery controls handle notes before their referenced copy is removed.

Refresh requires usable source access or a Locate original action. Selecting a new source explicitly creates a new copy. The old reading copy remains usable until a successful refresh is accepted. If the current copy has notes, let the user keep both versions or explicitly replace the reading copy while retaining the previous note collection for recovery. Never silently move notes onto changed passages. Exports remain independent snapshots.

Original files can move, disappear, become unavailable through a provider, or lose permission. Open original and Refresh explain the recovery action while the saved reading copy stays readable. Same-name sources remain distinct. Google retrieval failure or a Google-side deletion preserves any saved copy and its last retrieved time.

### F7 — Privacy and offline behavior

Local DOCX/PDF processing occurs on the device. Documents, extracted text, and images never upload for conversion. Google retrieval communicates with Google only after the user's action. Source content is excluded from diagnostic reporting. Any future hosted processing requires a separately defined product decision and explicit user consent.

Offline behavior is described per action. Local import and reading a saved copy work offline. Fetching an unavailable provider file, retrieving Google content, and opening remote links require connectivity. Storage failure produces an actionable error and preserves the prior accepted copy. Explain retained local copies and removal in settings/help.

### F8 — Limits and accessibility

Large, malformed, unsupported, and resource-heavy documents fail with an understandable reason and a next action, such as choosing a smaller file or exporting a simpler source copy. Never silently truncate a successful result. A limited result must be labeled partial, identify known omissions, and require the user's choice to keep it.

Document-size, page, image, and processing-time limits are established through representative-device qualification before implementation promises appear in public copy. They are visible before or during rejection. Desktop and mobile may have different documented limits. Numeric values are an explicit discovery deliverable.

Import, warnings, retry, source access, and save actions support keyboard navigation and screen readers. State changes are announced accessibly. iPhone actions remain reachable at large text sizes, and iPad supports both touch and keyboard.

## Acceptance scenarios

| ID  | Scenario and required result                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | In airplane mode, open a local DOCX containing headings, lists, links, a simple table, and an embedded image. The converted copy is readable and searchable, and its image survives restart.                  |
| A2  | Open an ordinary text PDF. All expected substantive text is present in the qualification comparison, and the reader sees the PDF conversion disclosure.                                                       |
| A3  | Open a multicolumn/table-heavy PDF. Detected issues have actionable warnings, and the source can be reopened for comparison. Record any undetected loss as a qualification failure.                           |
| A4  | Open an image-only or mixed PDF. Identify recognition-needed pages and offer a labeled partial result only when useful.                                                                                       |
| A5  | Cancel, repeat, retry, or interrupt an import. Existing copies remain available, late results are ignored, and accepted recents avoid accidental duplicates.                                                  |
| A6  | Open a private Google Doc using an authorized account, refresh it, and then reopen its saved copy offline. The displayed origin and retrieved time are accurate.                                              |
| A7  | Deny or revoke Google access, use the wrong account, or go offline during retrieval. Recovery actions match the cause and the old copy stays readable.                                                        |
| A8  | Save a text-only Markdown file and a package with embedded images. Reopen both outside the originating app storage and verify content and relative assets. Cancel or fail saving and verify no success claim. |
| A9  | Import different same-name documents and refresh an annotated desktop copy. Their copies and note collections stay distinct, with explicit replacement/recovery behavior.                                     |
| A10 | Lose source permission or move/delete the original. The reading copy opens, while Open original and Refresh offer recovery.                                                                                   |
| A11 | Exceed a supported resource limit or encounter a malformed/protected file. The app remains usable and reports the specific outcome without silent truncation.                                                 |
| A12 | Use VoiceOver, large text, desktop keyboard navigation, and iPad keyboard controls to complete opening, warnings, retry, export, and removal.                                                                 |
| A13 | Inspect network activity during local import and saved-copy reopening. Conversion content has no outbound requests. Remote resources load only after the user's explicit action.                              |
| A14 | Import a DOCX with insertions, deletions, and comments. Final text follows the declared tracked-change rule and omitted collaboration history is disclosed.                                                   |

## Delivery sequence and evidence

1. Start shared source-editing behavior and parallel desktop/mobile save work independently of import discovery. Qualify B1–B10 for the next-version editing capability.
2. Establish synthetic/licensed import documents, expected readable content, source-loss checks, and measured limits. Evaluate an experimental MarkItDown integration against on-device and distribution needs on each platform.
3. Develop desktop and iOS/iPadOS experimental local-import experiences concurrently against the same behavior. Shared reading, storage, and export work can advance alongside both platform tracks. Explicitly label experimental opening and identify supported formats and known limitations.
4. Qualify the experimental DOCX/text-PDF subset, saved-copy editing, refresh protection, export, and resource/privacy outcomes on desktop and physical iPhone/iPad. The next-version acceptance record distinguishes ordinary editing support from experimental import coverage. Unqualified format/platform combinations remain unavailable with clear guidance.
5. Develop direct Google Docs access as a separately planned extension after local saved-copy behavior is established. Its A6–A7 acceptance accompanies that extension. Add on-device recognition for scanned/mixed PDFs in a subsequent increment.

Success means users can complete a quick Markdown edit and confirmed save without losing drafts or overwriting unexpected source changes. For import, the qualification set preserves expected substantive content or produces the expected warning/rejection, accepted copies reopen offline, and people can identify the original and conversion caveats. Record supported experimental combinations, conversion duration, resource behavior, and warnings from synthetic documents. User document collection or production analytics is unnecessary for acceptance.

## Decisions for discovery

- Select the first-release size/page/image/time limits for each platform using measured results.
- Determine reliable handling of complex PDF layout and which omissions can be detected automatically.
- Confirm embedded-image fidelity and portable export behavior for Google Markdown exports.
- Confirm Google access scope, supported link variants, export restrictions, and account-authorization requirements.
- Establish the language/device coverage for the later on-device OCR increment.

These are execution-plan discovery tasks. They do not require a conversion library, model provider, backend, or public release commitment in this PRD.

## Reference context

The current SpecDown README documents source identity, saved copies, mobile actions, and annotation availability. It provides the compatibility baseline for this proposal. [SpecDown README](../../README.md)

Google lists Markdown as a supported Google Docs export format. Authentication and document access remain part of the Google opening journey. [Google export formats](https://developers.google.com/workspace/drive/api/guides/ref-export-formats)

MarkItDown inspired this feature and documents format extraction and fidelity limitations. The product requirements describe observable conversion behavior and leave tool selection to discovery. [MarkItDown](https://github.com/microsoft/markitdown)
