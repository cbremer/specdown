# Session 41: Mac TestFlight retained QA session

**Date:** 2026-11-01. **Result:** Chris's installed TestFlight app now starts at
the empty screen without the `qa-moved.md` permission toast after an ordinary
quit and relaunch. No app update, signing or upload was needed for this recovery.
Broader Mac TestFlight acceptance remains in progress.

## Report and verified identity

Chris reported the old QA prompt on his first launch after installing from
TestFlight. His screenshot and the installed app's accessibility tree showed:
`SpecDown needs permission to open “qa-moved.md”.` with a `Locate…` action.

- Running executable before recovery: `/Applications/SpecDown.app/Contents/MacOS/SpecDown`.
- Installed Store identity: `com.mosaicpando.specdown`, **1.0.1 (228)**, Store receipt present.
- Installed `app.asar` SHA-256:
  `b299e08b4bd6f8d54e135ee877a2ec8221d879b37133aaef20c6847aa394dcf7`.
  This exactly matches the uploaded artifact from `eed62c9`.
- Existing direct-download app remains `/Applications/Specdown Desktop.app`,
  `com.specdown.desktop`, **0.0.193**. It was not launched or modified.
- Root remains `729258b` on `codex/local-ios-1-0-1`; the separate Mac worktree
  remains clean at `eed62c9` on `codex/mas-startup-delivery`.

## Cause and evidence limits

The installed app's **File → Open Recent** menu showed exactly the old
`qa-moved.md` and `qa.md` sandbox test entries. The exact moved filename is
recorded in [October 12's native sandbox tests](2026-10-12-tasks-session-03-mac-app-store.md),
including a later deleted-file test that intentionally produced the Locate toast.
This is retained local Store-app history, not a QA file included in TestFlight.

Independent inspection of the uploaded artifact found no QA filenames, QA
profile data, synthetic test markers or hardcoded QA launch override among
8,683 ASAR leaf files and 267 other regular app files. The package contains only
the app and no installer scripts. The installed ASAR matches that audited ASAR.

At the frozen source, `restoreSession()` in `desktop/main.js` reopens saved
file paths. A missing or unusable sandbox grant emits `file-access-needed`;
`markdown-viewer/src/platform/desktop.js` displays the basename in this toast.
An empty default store has no saved tabs and cannot invent the QA filename.

macOS denied the focused read of `specdown-state.json`, including with approved
scoped execution. No alternate access path or privacy-setting change was used.
Therefore the exact stored tab list and whether the old grant was absent,
revoked or unresolved were not directly inspected. Visible history, the source
trace and successful session-only recovery establish the retained-session
behavior without claiming a particular native bookmark failure.

The earlier [Session 39 launcher correction](2026-11-01-tasks-session-39-mac-test-launcher.md)
selected a separate local QA directory. It did not clean the normal Store
profile reused by this installation. Retained launcher evidence verifies the
argument; it does not directly measure Electron's actual storage paths.

## Recovery through the app

1. Confirmed the installed app had no open document tabs and showed the QA toast.
2. Opened **Try diagram showcase**, the bundled pathless sample. It rendered a
   document and diagrams. Normal tab admission saves the current native session;
   pathless sample tabs are excluded from saved file paths.
3. Closed that sample tab, saving an empty native startup session.
4. Quit and relaunched **the exact installed `/Applications/SpecDown.app`** normally.
5. Verified the empty start screen had **no QA permission toast**. Reopened the
   File menu and verified both old recent-file entries were still present, then
   closed the menu and left the app ready for Chris.

No Locate action, new file grant, Clear Recent Files, profile reset, uninstall,
direct JSON edit or document deletion occurred. No live note store was inspected
or directly edited. Ordinary sample rendering may perform the app's existing
annotation-anchor maintenance, so this is not a byte-for-byte note-store audit.

## Follow-up

- **WK-32:** provide an explicit, accessible option to stop reopening an
  unavailable saved tab. Current toast-body click dismisses the visible message
  only; it does not remove the startup reference, and the choice is undiscoverable.
- Keep Locate as an explicit user-selected grant flow. A future forget action
  must affect only the selected saved startup reference, preserve documents,
  annotations, recents and unrelated grants, and handle multiple unresolved tabs
  without suppressing failures or weakening the sandbox.
- Regression acceptance should cover fresh empty profiles, mixed valid and
  unavailable restored tabs, cancellation/dismissal, persistence across relaunch,
  and unchanged direct-download behavior. This task is recorded, not implemented.
- **WK-12:** continue physical Mac TestFlight acceptance. This recovery is one
  observed startup pass, not full feature acceptance or App Review readiness.

## Retained evidence

`ios/DerivedData/mas-testflight-startup-20261101/`:

- `before-ui.txt/.png` and `after-relaunch-ui.txt/.png`.
- `installed-identity.json`: installed identities and matching ASAR hash.
- `artifact-audit.json`: independent shipped-content audit and exact scan scope.
- `recovery-review.json`: independent source analysis of recovery effects/limits.

No source change, build, signing, upload, App Store Connect change, App Review
submission or public release was performed in this session.
