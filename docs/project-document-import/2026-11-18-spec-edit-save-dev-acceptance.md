# Edit/save Dev acceptance and import feasibility

November 18, 2026. Local development evidence; owner release acceptance is open.

## Delivered development behavior

The shared viewer has Edit/Preview, Save, Save As and Cancel controls, a labeled Markdown textarea, per-tab drafts and native undo/redo, explicit unsaved status, and retained textarea selection/scroll across preview and tab switches. Controls are available in the shared document area and iPhone action sheet. Preview uses the real existing Markdown/Mermaid renderer.

Desktop saving passes through the trusted preload/main bridge and current file-access capabilities. Saving compares accepted source bytes, stages and syncs a replacement, then rechecks the source before rename. A changed version offers Keep editing, Save As, an explicit overwrite of the observed version, or discard/reload. Every overwrite attempt rechecks the observed version. Failed or canceled saves retain drafts. Save acknowledgments advance only the submitted version. Live reload cannot replace an open editor draft. Same-source note identity is retained; Save As opens an independent source and collection. If the copy cannot open, the original draft stays recoverable.

iOS uses retained native document IDs and security-scoped, coordinated atomic writes. A path or restored draft grants no access. Copy saving uses the system export picker; reusable returned destinations receive a separate bookmark/identity. Successful local provider completion does not claim remote synchronization. Export cancellation retains the draft.

Recoverable drafts persist in local app-profile storage on each change. Restart offers an explicit Recover unsaved drafts command with Restore, Discard and Later per affected source. Restoring never writes automatically. Storage failures retain the in-memory draft and report the recovery limitation. This storage is bounded by the host's quota, rather than a promise that every 8 MiB source can be retained.

## Artifacts and reproduction

- macOS arm64: `dist/development-edit-save/mac-arm64/SpecDown Dev.app`, desktop version `0.0.234`, identity `com.specdown.desktop.dev`, isolated `specdown-dev` profile, updater disabled. Local unsigned development output; no notarization/public distribution.
- iOS/iPadOS simulator: `ios/DerivedData/EditSaveDev/Build/Products/Dev Debug-iphonesimulator/Specdown.app`.
- Locally signed iOS/iPadOS device build: `ios/DerivedData/EditSaveDevice/Build/Products/Dev Debug-iphoneos/Specdown.app`.
- Both native artifacts identify `com.mosaicpando.specdown.dev`, display SpecDown Dev, version `1.0.4`, build `245`. Production/beta identities were not built or installed by this session.
- Rebuild local desktop/simulator output with `scripts/build-edit-save-dev.sh`; add `--run` to launch the desktop app. The generated Xcode project must retain owner signing settings. Build the device artifact with the same Dev scheme/configuration and `generic/platform=iOS`, omitting the simulator signing override. No provisioning updates are needed for the successful local configuration observed here.

The initially generated Xcode project was stale: it lacked existing RecentDocuments, delivery/resource and diagram-export source entries. Its signing settings were preserved in a temporary local backup, and the project was regenerated from `ios/project.yml` with those per-configuration settings overlaid. No portal/account settings changed. No dependency manifest changed, so dependency reinstall was unnecessary. Vite was available and the generated bundle contained the current `0.0.234` version.

## Observed validation

- Scoped full Jest, ESLint and strict checkJs results are recorded in Session 03. The suite stays rooted at `tests/`; lint excludes ignored agent worktrees. Retained archives remain untouched.
- `scripts/test-source-editing-desktop.js` runs the real Electron viewer, native undo/redo, trusted IPC and real filesystem against synthetic temporary files and an isolated app profile. It verifies source whitespace, preview/Mermaid, same-source and independent-copy annotation identities, save conflicts/explicit overwrite, forced restart/recovery, copy saving and canceled destination selection. Destination chooser results are deterministic test substitutes; native picker interaction is separate acceptance.
- `NativeDocumentTests.testSourceEditingSaveConflictAndDraftPreview` passed on iPhone 17 Pro and iPad Pro 13-inch simulators (iOS 26.4), exercising real WKWebView requests, original-source save/reopen bytes, preview, external-change detection and explicit overwrite.
- Signed device compilation and `codesign --verify --deep --strict` passed. No physical device installation/provider interaction is claimed. Xcode emitted the benign no-AppIntents metadata-extraction warning. Moving this session's new derived output under the ignored DerivedData folder initially emitted stale-build-path warnings; subsequent native test builds passed without those diagnostics.
- New editor, save helper, Dev config, desktop probe and JavaScript tests are Prettier formatted. Whole-file checks on the nine modified legacy JS/HTML/type files report pre-existing nonconformance, verified against `HEAD`; broad reformatting was avoided. `styles.css` is untouched. `git diff --check` passed.

## Remaining acceptance boundaries

B1–B7/B9 have automated development evidence, not complete owner signoff. B8 is deferred with import. B10 still needs physical VoiceOver, large-text, iPad hardware-keyboard/keyboard-visible testing and third-party provider acceptance, including offline/full-storage/permission-loss cases. Windows, Linux and the provisioned Mac App Store sandbox have not been run on this host; their save capability handling shares the implementation but is unqualified. MAS may deny staging beside a file-only grant; a failure retains the draft and offers Save As.

The desktop filesystem provides no cross-process compare-and-swap rename. A very narrow external-write race remains between the final synchronous check and replacement; do not claim exhaustive B4 acceptance. iOS coordination serializes cooperating providers; uncoordinated external writers are likewise outside that guarantee. The system iOS export picker can confirm replacement of an existing selected destination; choosing the original as that destination still needs explicit source-identity acceptance before release. Undo history is retained during a running editor session; restored drafts restart undo history.

No advisory reviewer has inspected a committed implementation in this session. Earlier import PRD feedback remains proposed and is not implemented by this change. No review availability gate, PR merge, upload, TestFlight submission or public release occurred.

## MarkItDown experiment

[Microsoft MarkItDown](https://github.com/microsoft/markitdown) is Python based and supports optional DOCX/PDF dependencies. Its documentation explicitly distinguishes text-analysis conversion from high-fidelity human reading. This checkout ships Electron and Swift shells and contains no Python runtime or bundled converter.

A disposable Python 3.12 environment installed MarkItDown `0.1.9` with only DOCX/PDF extras. The synthetic qualification script is `scripts/evaluate-markitdown.py`; no user document was used. Running it with macOS process networking denied (`sandbox-exec -p '(version 1)(allow default)(deny network*)' <environment-python> scripts/evaluate-markitdown.py <temporary-output-directory>`) produced:

| Input             | Observed output                                                                                  | Conversion time |
| ----------------- | ------------------------------------------------------------------------------------------------ | --------------- |
| Synthetic DOCX    | Heading, paragraph and two table cells retained; tested insertion included and deletion excluded | 0.013 s         |
| One-page text PDF | Both expected text lines retained; no claim of general layout fidelity                           | 0.007 s         |

These are single small-fixture timings. They do not establish page, memory or fidelity limits. The local environment occupies approximately 205 MiB and references the host Homebrew Python executable; it is not a relocatable app runtime. Dependencies include platform-specific ONNX Runtime, NumPy, lxml, cryptography and PDFium binaries. A successful host conversion is not evidence of an iOS-compatible embedded runtime or a signed/sandbox-qualified desktop distribution.

In-app import is deferred in these Dev builds: packaging/qualifying that runtime across the app distributions remains unfinished, and no embedded iOS converter exists. No hosted service, document upload, OCR or Google authorization workaround was introduced. Embedded assets, complex layouts, malformed/protected inputs, resource limits and native packaging still require qualification. ZIL-199 remains in progress; ZIL-218/B8 remains future import work. The successful host-only experiment is reproducible but is not presented as a working app integration.
