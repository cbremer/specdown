# Session 04 — contextual editing in Dev builds

November 18, 2026.

Owner selected the first displayed design concept and authorized applying it to the actual desktop and iOS Dev builds. Preserve the save, conflict, local draft recovery and source-identity behavior. App Store Connect remains explicitly out of scope.

Baseline: clean `codex/source-edit-save-dev` at `01949ac`; upstream fetch completed without source changes. Continue the existing feature branch and preserve ignored native outputs and owner signing settings.

## Implementation and validation plan

- Reuse the existing document header for Edit while reading, then Source/Preview, Save and More while editing. Remove the extra editor row. More contains Return to reading, Save As and confirmed discard.
- Separate the editing workspace from source/preview visibility so returning to reading retains drafts, recovery data, textarea selection and undo. Reuse all existing native save/recovery code.
- Fit compact desktop controls (32–34 px height, 13–14 px labels, 16 px icons) and 44 px touch targets on iOS/coarse-pointer surfaces. Keep iPhone actions reachable without the hidden desktop toolbar.
- Add meaningful navigation/state regression checks, retain existing save/recovery tests, and exercise the real Electron and WKWebView save paths. Check desktop/narrow layouts and native control dimensions.
- Run scoped full Jest, lint, strict checkJs, touched-file formatting checks, web version verification, desktop Dev packaging, iOS Dev simulator/device builds and signature checks. Use Dev 1.0.4 (248); no portal access, upload, release or protected approval.

## Delivered

The editor now replaces the reading actions inside the existing document header. Source and Preview share one workspace; Return to reading retains the draft and undo history. Save As and explicit discard live in More. Desktop controls measure 32–34 px with 16 px icons; iOS retains 44 px touch targets and 16 px source text. Dirty tabs use a small accessible dot.

Owner reported that Discard Changes moved large controls to the upper left on iOS. Reproduction confirmed the global CSS reset removed the native dialog's default centering margins and padding. Restore explicit centered margins, 20 px padding and viewport bounds. Direct discard now uses a compact two-action confirmation (Cancel / Discard changes), separate from the close-document Save prompt. Cancel retains recovery; confirmed discard restores saved reading content without writing the source. No native save or recovery storage schema changes were needed.

## Evidence

- Full scoped Jest passed before native packaging: 93 suites / 1,556 tests for the contextual header. A further direct-discard regression was added and observed failing against the prior generic Save prompt; its final focused run passed all 11 editor tests. Final full-suite validation passed 93 suites / 1,557 tests. Existing nonfailing Node listener/SQLite warnings remain.
- Scoped ESLint and strict checkJs passed. Touched new editor code, tests and scripts are Prettier formatted; legacy HTML/tabs retain existing formatting. `git diff --check` passed.
- Real Electron synthetic-file probe passed undo/redo, real Markdown/Mermaid preview, trusted IPC saves, conflicts, overwrite, restart/recovery, independent Save As, canceled destination, return/resume, centered padded confirmation, Cancel retention and confirmed discard to saved reading.
- Native WKWebView original-source save/conflict and editor navigation tests passed on iPhone 17 Pro and iPad Pro 13-inch simulators (iOS 26.4). Updated iPhone and iPad testing additionally checks the two-action discard, dialog bounds, 44 px touch targets, Cancel recovery retention and confirmed discard without a file write.
- Local web build and isolated unsigned desktop Dev packaging succeeded. The packaged desktop viewer bytes match the current web build. Desktop version remains 0.0.234; native Dev version is 1.0.4 (248).
- Signed device build and strict signature validation passed. All packaged device viewer bytes match the current build. Dev 246 was installed and launched on the verified physical iPhone Z. After owner feedback, Dev 247 was installed with the centering fix; launching was denied because the phone was locked. Dev 248, containing the simplified confirmation, was installed, queried on-device to confirm version/build and successfully launched after the phone became available. This supersedes the interim 246/247 artifacts.
- App Store Connect, production/beta identities, signing configuration, provisioning updates, uploads and public release were untouched. Existing ignored archives were preserved. No project regeneration or dependency installation was required.

Native tests and synthetic browser/Electron screenshots are development evidence, not physical owner acceptance. Provider-specific/offline/full-storage behavior, physical VoiceOver/large-text and Windows/Linux/MAS acceptance remain open as described in the acceptance note. The owner should retry Discard Changes on the phone to confirm the reported behavior is resolved.

No advisory code review was requested for this local Dev UI update. No source was pushed, merged or published.
