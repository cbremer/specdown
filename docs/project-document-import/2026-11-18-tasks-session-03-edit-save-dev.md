# Session 03 — edit/save development builds

Date — November 18, 2026.

## Baseline and authorization

Owner authorized implementation, validation and local desktop/iOS Dev builds, with edit/save independent of experimental import. Main fast-forwarded from `d3e5256` to `5663102`. Planning changes were stashed during refresh and restored on `codex/source-edit-save-dev`. No new worktree. Preserve ignored archives and signing settings.

## Implementation plan

1. Add `features/source-editor.js` and its stylesheet: per-tab textarea instances retain selection and native undo; draft state is separate from accepted source. Shared controls remain outside the hidden iPhone desktop toolbar. Preview uses the existing renderer including Mermaid. Persist recoverable drafts locally with explicit restore/discard and no restored access grants.
2. Integrate tabs, view mode, and desktop live reload. Dirty drafts and pending saves cannot be replaced by watch events. Guard close/cancel with Save, Discard and Keep editing. Save acknowledgment advances only the submitted baseline; newer typing stays dirty.
3. Add a narrow save command through `platform/bridge.js`/preload and trusted main IPC. Reuse file-access capabilities, verify expected source before writing, and use native Save As destination confirmation. Preserve existing same-source annotation identity; Save As opens a separate source.
4. Add iOS save requests to `WebBridge.swift`, using existing native document IDs, coordinated security-scoped writes and an explicit export picker for copies. Report local provider completion separately from remote synchronization.
5. Verify regression scenarios B1–B7/B9 with meaningful tests and smoke probes; record B10 physical accessibility/provider gaps honestly. Run scoped Jest, lint, checkJs, touched-file formatting, web build/version verification and native Dev builds. Do not regenerate the Xcode project unless required.
6. Evaluate actual MarkItDown runtime/distribution feasibility after core editing. Record concrete unsupported platform combinations; do not add uploads or delay edit/save delivery.

## Evidence and remaining work

Implemented the shared editor, capability-checked desktop saves, coordinated iOS saves/export, dirty-draft live-reload protection and local recovery. Added failure, conflict, newer-typing acknowledgment, failed-copy admission and explicit recovery/close regressions. The real Electron smoke test and native original-source save/conflict test passed on iPhone 17 Pro and iPad Pro 13-inch simulators. Signed iOS Dev device output also built successfully and passed signature verification; no physical installation occurred.

The [acceptance/build record](2026-11-18-spec-edit-save-dev-acceptance.md) contains exact relative artifact paths, reproduction instructions, checks and remaining platform/provider/accessibility boundaries. MarkItDown 0.1.9 converted small synthetic DOCX/PDF fixtures with macOS networking denied. Its host environment is not relocatable or iOS compatible; no in-app import integration is claimed.

Linear ZIL-213 through ZIL-217 and ZIL-199 are In Progress with this evidence and the acceptance gaps appended. Import work does not gate edit/save Dev delivery. The previous four advisory import suggestions remain proposed. No independent code reviewer is claimed, and no PR merge, upload or public release occurred.

## Final checks

- Scoped full Jest: 93 suites, 1,554 tests passed. The run included non-failing SQLite/Node listener warnings and a Git subprocess diagnostic; no failed tests.
- Scoped ESLint and strict checkJs passed. New-source/test/project-document Prettier checks and `git diff --check` passed; legacy whole-file formatting exceptions are recorded in the acceptance document.
- Rebuilt the final desktop and simulator artifacts with the checked-in Dev build script. Verified packaged desktop source/Dev metadata and byte-for-byte current web resources in both native artifacts. Rebuilt and verified the signed device artifact after the final viewer build.
- macOS Dev process launched. A final accessibility-tree inspection was unavailable because the Mac was locked; no unlock was attempted. The isolated Electron runtime probe supplied the UI/save evidence.
- Owner clarified to avoid App Store Connect. It was not accessed; local signing did not use provisioning updates. No App Store Connect access is authorized by this work.
