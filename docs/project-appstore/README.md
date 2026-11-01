# Project: App Store release preparation

End-to-end preparation of SpecDown's iPhone/iPad and native Mac App Store versions, with traceable builds, native QA, screenshots, complete draft listings and an explicit later submission boundary.

**Status as of 2026-10-31:** iPhone/iPad 1.0 is publicly available on the US App Store. Security fixes, website updates and next Store candidates are in preparation; Mac App Store distribution signing remains pending. See the canonical plan and its live Google Sheet link below.

## Timeline

| Date         | Type      | Document                                                                              | Summary                                                                                                    |
| ------------ | --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Sep 28, 2026 | Spec/plan | [Release preparation plan](2026-09-28-spec-appstore-release-plan.md)                  | 50 stable task IDs, source-backed gates, 21 QA scenarios, decisions and nine kickoff/resume prompts.       |
| Sep 28, 2026 | Tasks     | [Session 01: preparation](2026-09-28-tasks-session-01-release-preparation.md)         | This session's documentation and native Google Sheet deliverables; no app implementation.                  |
| Sep 28, 2026 | Tasks     | [Session 02: owner archives](2026-09-28-tasks-session-02-owner-archive.md)            | Require recoverable copies of code/artifacts and actual generated reusable credentials; plan revision 1.1. |
| Oct 12, 2026 | Interface | [MAS access contract](mas-interface.md)                                               | AS-021 sandbox spike results: proven grant/bookmark/watch mechanisms, storage, recovery UX, entitlements.  |
| Oct 12, 2026 | Tasks     | [Session 03: Mac App Store build](2026-10-12-tasks-session-03-mac-app-store.md)       | AS-021..026 MAS lane: spike, channel separation, grants, packaging.                                        |
| Oct 13, 2026 | Tasks     | [Session 03: 1.0 submitted, 1.1 backlog](2026-10-13-tasks-session-03-v1-1-backlog.md) | iOS 1.0 (11) submitted for review; deferred items and owner follow-ups.                                    |
| Oct 31, 2026 | Tasks | [Session 07: launch weekend](2026-10-31-tasks-session-07-launch-weekend.md) | Public iOS launch verified; shared/native security fixes, website updates, candidate validation and owner login gates. |
| Oct 31, 2026 | Spec | [Build-tool advisories](2026-10-31-spec-toolchain-advisories.md) | Scoped dependency updates, unsigned packaging evidence and unresolved upstream constraints. |
| Oct 31, 2026 | Tasks | [Session 08: iPhone Duo](2026-10-31-tasks-session-08-iphone-duo.md) | Adaptive layout and retained document state; exact simulator evidence and remaining unlocked-Mac touch checks. |
| Oct 31, 2026 | Tasks | [Session 09: updater security](2026-10-31-tasks-session-09-updater-security.md) | Direct desktop cached-update filename containment; real dependency regressions and preserved release guards. |
| Oct 31, 2026 | Tasks | [Session 10: annotation storage](2026-10-31-tasks-session-10-annotation-storage.md) | Preserve corrupt, unsupported and temporarily unavailable note stores; exact recovery backups and bounded schema-aware imports. |
| Oct 31, 2026 | Tasks | [Session 11: Electron security](2026-10-31-tasks-session-11-electron-security.md) | Electron 44.10.1 same-major update; unsigned universal direct/MAS packaging, hidden runtime checks and exact artifact evidence. |
| Oct 31, 2026 | Tasks | [Session 12: document context](2026-10-31-tasks-session-12-document-context.md) | Reject stale annotation actions while preserving drafts; guard asynchronous document/diagram completions and captured PDF titles. |
| Oct 31, 2026 | Tasks | [Session 14: Duo runtime](2026-10-31-tasks-session-14-duo-runtime.md) | Unlocked-Mac touch testing, centered diagram zoom/resize, and compact keyboard Find corrections. |
| Oct 31, 2026 | Tasks | [Session 15: centered desktop artifacts](2026-10-31-tasks-session-15-centered-desktop-artifacts.md) | Refresh unsigned direct/MAS packaging from the centered shared viewer; preserve owner signing gates. |
| Oct 31, 2026 | Tasks | [Session 16: TestFlight and iOS annotation boundary](2026-10-31-tasks-session-16-testflight-boundary.md) | TestFlight-before-submission direction, consistent deferred annotation behavior, and exact-build acceptance checklist. |
| Oct 31, 2026 | Tasks | [Session 17: final source review and TestFlight preparation](2026-10-31-tasks-session-17-testflight-preparation.md) | Signed-in portal verification, final mobile review corrections and owner-signing handoff. |
| Oct 31, 2026 | Tasks | [Session 18: security-update numbering](2026-10-31-tasks-session-18-security-update-numbering.md) | Owner-selected 1.0.1 (228), regenerated unsigned artifacts and replacement signing packet. |
| Oct 31, 2026 | Tasks | [Session 19: desktop refresh acceptance](2026-10-31-tasks-session-19-desktop-refresh-acceptance.md) | Reject watched/manual updates before tab mutation, preserve accepted documents, and gate renderer recents and Updated feedback. |
| Oct 31, 2026 | Tasks | [Session 23: fullscreen focus](2026-10-31-tasks-session-23-fullscreen-focus.md) | Isolated Find/fullscreen focus correction, nested keyboard ownership and real-browser regressions; root phone candidate preserved. |
| Oct 31, 2026 | Tasks | [Session 24: presentation focus](2026-10-31-tasks-session-24-presentation-focus.md) | Presentation Find boundary, enabled-control keyboard navigation and safe focus restoration; document replacement teardown remains separate. |
| Oct 31, 2026 | Tasks | [Session 25: desktop open acknowledgment](2026-10-31-tasks-session-25-desktop-open-acceptance.md) | Gate main-process and OS recents on bounded, current renderer acceptance receipts; preserve the frozen mobile candidate. |
| Oct 31, 2026 | Tasks | [Session 26: integrated review baseline](2026-10-31-tasks-session-26-integrated-review.md) | Exact reviewed desktop and focus changes combined for independent validation; no new lifecycle behavior or phone promotion. |
| Oct 31, 2026 | Tasks | [Session 27: accepted-view overlay lifecycle](2026-10-31-tasks-session-27-accepted-overlay-lifecycle.md) | Synchronous accepted-view cleanup, preserved rejection/background state, and isolated old presentation/minimap callbacks. |
| Oct 31, 2026 | Tasks | [Session 28: support contact clarity](2026-10-31-tasks-session-28-support-contact.md) | Email-first reporting, retained public GitHub issue browsing and explicit account requirement; no reproduced dead URL or live deployment. |
| Oct 31, 2026 | Tasks | [Session 29: separate iOS Light icon](2026-10-31-tasks-session-29-ios-light-icon.md) | Approved full-bleed Light master, manual iOS alternate and reproducible opaque exports; existing icons and desktop remain unchanged. |
| Oct 31, 2026 | Tasks | [Session 30: existing iOS icon geometry](2026-10-31-tasks-session-30-ios-icon-geometry.md) | Master-derived full-edge iOS exports remove the six alternates' extra inset; Original, Light and desktop geometry preserved. |
| Oct 31, 2026 | Spec | [iOS development channels](2026-10-31-spec-ios-development-channels.md) | Separate Dev/Beta/production identities, one source tree, owner setup and reversible workflow. |
| Oct 31, 2026 | Tasks | [Session 32: iOS development channels](2026-10-31-tasks-session-32-ios-development-channels.md) | Three explicit schemes, channel-aware default icons and compiled identity checks; Apple setup remains owner-led. |

**Google Sheet:** [Launch Weekend execution tab](https://docs.google.com/spreadsheets/d/1dGnVfCIzM4rgqb2_QsfNBh_yhvNYdjte0hs0ost1EKo/edit#gid=10312026)

The Markdown plan owns scope/constraints; the live Sheet owns task status/evidence/accepted Decisions. Future work follows repo `CLAUDE.md`, preserves the phone checkout and Developer ID channel, and uses one logical change per PR with rebase merging. Add the next dated numbered tasks file and timeline entry for a future execution session.
