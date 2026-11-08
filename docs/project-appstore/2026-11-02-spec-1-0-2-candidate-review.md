# Proposed 1.0.2 release notes and candidate review

Development batch, November 2, 2026. These notes describe intended scope and are
not a declaration that every item has passed acceptance. See Session81 for exact
commits, draft PRs, test evidence and open gaps. Do not submit this text to Apple
before the corresponding behavior is accepted.

## Proposed release notes

- Reopen accepted iPhone/iPad documents from Recent Files, with permission-aware recovery when a file moves or becomes unavailable.
- View local raster images alongside Markdown after explicitly choosing the containing folder.
- Save or share diagram PNG and SVG files through native iOS controls, including Files.
- Choose the approved Light icon on desktop alongside the existing artwork choices.
- Browse public GitHub repositories and branches without signing in, with clearer unavailable/rate-limit messages.
- Keep annotations separate for different documents, and preserve, back up, preview, explicitly reconnect and undo recovered notes safely.
- Start with Starfield across web, desktop, Mac Store and iOS; choose Basic or another theme whenever you prefer.

## App Store feature description

The [draft iOS and Mac descriptions](submission-copy-1.0.2-draft/README.md) now
include the existing diagram presentation feature:

> Focus on just the diagrams in Presentation mode, moving through them one at a time with zoom and pan.

Both drafts also describe the initial Starfield theme and the Basic, Aurora and
Blueprint choices. Saved theme selections remain respected. These drafts have
not been applied to App Store Connect.

Native iOS annotation editing remains disabled. No hosted diagram-link sharing is
introduced. Running Dock/window icon changes do not replace Finder or installed
shortcut artwork. Direct desktop numbering remains independent of Store 1.0.2.

## Owner review before release preparation

1. Review the draft PRs and combined candidate at their recorded exact revisions;
   confirm all required CI and independent-review findings are resolved.
2. Finish source/simulator review first. Separately authorize a candidate Dev
   build and physical installation before the device checks below. Use disposable
   documents in the separate Dev identity; confirm production/Dev/Beta names,
   icons and data remain distinct. Existing 230 artifacts are historical.
3. On iPhone and iPad, open different `README.md` files, restart and reopen each
   recent. Try moved/deleted files, revoked permissions and offline/downloaded
   iCloud/Dropbox/OneDrive documents. Check Retry/Locate and current-document
   preservation, plus rapid A→B→A opens.
4. Open a document with `./diagram.png` and an encoded-space filename. Explicitly
   choose its folder; test after switching tabs, raw/preview and reopening. Check
   traversal/symlink attempts and oversized resources remain blocked.
5. For an intended diagram on both phone and tablet, save PNG and SVG through
   Files and share them. Reselect the actual files, confirm format/content, cancel
   a sheet, repeat requests and switch documents while an export is pending.
6. On desktop, select Light, quit/relaunch, then reset Original. Inspect geometry
   on light/dark backgrounds. Finder/shortcut artwork keeps its shipped value.
7. Browse a public repository, a nondefault slash branch and a folder URL; filter
   and select files. Try unavailable and rate-limited repositories. Confirm raw
   Markdown URLs still open and a late response cannot replace a newer document.
8. With **synthetic notes only**, exercise capture → preserve/archive → actual
   downloaded/reselected backup → restore preview → selected occurrence association
   or explicit reconnect → undo. Try same-name unrelated documents, duplicate
   notes, corrupt/future archives, simultaneous windows and an edit after association.
   Never run the development matrix against live notes or delete evidence to make space.
9. Recheck centered diagram zoom, Find focus/keyboard, Close Folder, Live reload,
   document rejection and restart on the integrated candidate.
10. After physical acceptance, separately authorize Store build-number selection,
    release signing and any Beta delivery. Apple upload, submission, manual release
    and website deployment are separate actions.

## Evidence boundaries

Automated synthetic tests, real-library browser tests, unsigned simulator runtime,
configured direct Electron and signed MAS/device behavior are distinct evidence.
Provider entitlement/move behavior requires the final signed sandbox; simulator
success cannot close that gap. The annotation contract's 36 rows must be tracked
individually; a working export helper or aggregate test count is insufficient.
