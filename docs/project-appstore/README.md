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

**Google Sheet:** [Launch Weekend execution tab](https://docs.google.com/spreadsheets/d/1dGnVfCIzM4rgqb2_QsfNBh_yhvNYdjte0hs0ost1EKo/edit#gid=10312026)

The Markdown plan owns scope/constraints; the live Sheet owns task status/evidence/accepted Decisions. Future work follows repo `CLAUDE.md`, preserves the phone checkout and Developer ID channel, and uses one logical change per PR with rebase merging. Add the next dated numbered tasks file and timeline entry for a future execution session.
