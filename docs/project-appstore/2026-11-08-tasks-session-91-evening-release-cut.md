# Session 91: November 8 evening release assessment

## Recommendation

Freeze features for 1.0.2 and aim for App Review submission tonight. Add only a
reproduced release-blocking correction. App Store public availability depends on
Apple's review; a same-evening approval is not promised.

This assessment and the release-copy drafts do not record a merge, Apple upload,
submission or public release. Owner testing is still underway.

## Live backlog triage

Checked GitHub and the current lockfile on November 8, 2026.

| Item                                                                                      | Current evidence                                                                                                                                                                                  | Tonight's recommendation                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Optional updates/beta email signup #413](https://github.com/cbremer/specdown/issues/413) | Explicit future-session backlog; no signup was implemented.                                                                                                                                       | Defer. It adds a service, consent/unsubscribe flow and privacy disclosures.                                                                                                         |
| [Annotation recovery #355](https://github.com/cbremer/specdown/issues/355)                | Issue remains open, while the candidate already contains the implementation and the 36-row evidence ledger. Signed-provider, physical and some stress/platform acceptance remain distinct gaps.   | Reconcile evidence rather than start another implementation. Final Mac backup/restore/reconnect/undo acceptance matters to the Mac release. Native iOS annotations remain disabled. |
| [Development-tool advisories #356](https://github.com/cbremer/specdown/issues/356)        | Fresh `npm audit --omit=dev`: 0 known findings. Full audit: 5 low entries, all from the deepmerge advisory; the older issue's minimatch/moderate inventory is no longer the current audit result. | Defer dependency changes tonight. Preserve and later reconcile this issue; do not dismiss findings to clear a dashboard.                                                            |
| Open Mermaid, marked and development-tool dependency PRs                                  | Separate pending upgrades, not required for the tested candidate.                                                                                                                                 | Defer unless a newly demonstrated release blocker requires one.                                                                                                                     |

## Current candidate and concrete release work

- Phone and iPad Dev **1.0.2 (238)** are installed and metadata-verified. Local
  shared validation passed **88 suites / 1521 tests**, lint and strict types.
  Phone native group: **11 passed**; iPad URL group: **3 passed**, with a further
  rendered/viewport check. These do not substitute for owner physical acceptance.
- Mac Dev 238 is built, signature/content-verified and now installed after the
  owner unlocked the Mac. The app launched and About visibly confirmed
  **SpecDown — Development**, **Version 1.0.2 (build 238)**. The prior Dev 237 app
  and existing app data were preserved.
  The direct-desktop local candidate also matches the 238 shared source; its
  unsigned local package is not a public desktop release.
- Current GitHub main is `a43c96197a684a9bfbbeb3dd0ca2b766c5c65cd3`.
  [Combined candidate #403](https://github.com/cbremer/specdown/pull/403) is still a
  draft and currently conflicts with main. Its older eleven checks passed, but
  that does not validate a new integration. Theme/copy [#404](https://github.com/cbremer/specdown/pull/404)
  is stacked on it. Today's About/URL/Open fixes are still local changes.
- Choose one combined integration, preserving current-main instruction/security
  changes and avoiding duplicate merges of the constituent feature drafts. Run
  the required checks on the actual final source. A production merge may deploy
  the web app and remains a separate owner decision.
- Finish the short owner acceptance pass below, update the listing/release notes,
  verify App Store Connect's current build history and choose upload numbers.
- Build production-identity release artifacts from the frozen final source;
  development-signed `.dev` apps cannot be substituted for Store artifacts.
  Verify the signed archives/packages and any TestFlight acceptance separately
  before the final owner-approved submission.
- Keep direct desktop in the same source wave, with its independent version/tag
  and signing/publication flow. The pending version-only #418 does not itself
  include this unmerged feature wave.

## Short owner acceptance pass

1. **Phone and iPad:** Open two URLs from Open / plus, keep both tabs, rotate,
   type with the keyboard visible, and Cancel without disturbing the document.
2. **Files:** Open a local file, quit/relaunch, reopen from Recent Files, and try
   an unavailable/moved file while preserving the current document. Confirm the
   chosen local-image folder works for a document containing a relative image.
3. **Diagrams:** Use Presentation mode and save/share a real PNG and SVG on the
   devices. Open the exported files and verify the intended diagram.
4. **Mac:** Test the same reading/URL basics and Light icon persistence. Using
   synthetic notes only, verify backup, actual file reselection, restore preview,
   explicit reconnect/association and undo. Signed provider permission and move
   behavior remain named acceptance requirements.

Do not mark unperformed checks passed. A failure in these flows is a candidate
for a narrow fix; extra polish and new features remain outside tonight's cut.

## Reviewable release copy

The [draft copy packet](submission-copy-1.0.2-draft/README.md) includes new iOS/Mac
What's New files. It retains the diagram-only Presentation description,
Starfield initial theme and Basic naming. Validate each feature claim against
owner acceptance before applying it to App Store Connect.

Private current audit reports remain with the Dev 238 build evidence under
`ios/DerivedData/wave-102-local-dev-238/`.
