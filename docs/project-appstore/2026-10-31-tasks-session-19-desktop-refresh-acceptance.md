# Session 19 — desktop refresh acceptance

Date: 2026-10-31 (America/Los_Angeles).

## Reproduction and scope

The independent desktop follow-up found an acceptance gap after the new-document correction in #329. At `e7b842bfee5e360b9e9aaea8285c79c28f6fccbc`, a watched or manually refreshed document replaced its tab's saved source before renderer validation. A rejected 65,537-character line left the old preview visible while the Live chip reported Updated. After opening B and switching back to A, A's tab became active while B's filename and content remained visible; Refresh targeted A.

The fix is isolated on `codex/desktop-atomic-refresh`. The incoming document is prepared and sanitized once before any matching tab changes, including background copies and raw views. Rejection preserves accepted source, the visible view, scroll and document context. Accepted preview refreshes reuse the prepared HTML. The renderer reports whether it completed in the current view, so failed or stale completion cannot restore scroll or pulse Updated. Valid updates still refresh every matching copy and mark background copies as changed.

The desktop file-open listener also honors `createTab(false)` before recording renderer recent files. Native/main-process and OS recent-document lists still record a successfully read file before renderer acceptance; correcting those lists requires a separate acknowledgment contract. This change does not add that protocol or change native file grants.

## Validation

- Negative control on unchanged `e7b842b`: nine new regression cases failed; two valid-refresh controls passed. The original bounded A → rejected refresh → B → A reproduction is retained in the regression suite.
- Corrected focused suites: 67 tests passed across desktop renderer, refresh acceptance, document context and atomic opening. The new file covers active and background copies, raw/manual refresh, parser/sanitizer failure, later tab switching, successful controls, failed renderer completion, and rejected-new-file/tab-limit recents.
- Full suite: **1,007 tests across 60 suites passed**. Lint and type checking passed; the production web build completed with 110 output files.
- Logs: `/private/tmp/specdown-desktop-refresh-{negative,focused,full,lint,typecheck,build}-20261031.log`.

These are source and synthetic DOM checks. No live desktop app, user document/store, native signing, account or other computer was accessed for this fix. Independent review precedes the commit and replacement desktop packaging.

## Artifact and release boundaries

The unsigned direct/MAS packages assembled from `e7b842b` contain the final mobile-review preparation and bounded Find changes. Their contents were independently verified, but they remain provisional desktop artifacts because they predate this refresh correction. The next desktop artifact handoff must identify the reviewed fix commit and rebuilt web bundle before packaging.

The owner-selected **iOS 1.0.1 (228)** packet from Session 18 remains unchanged at `e7b842b`. This desktop-only IPC correction does not change that frozen owner-signing source or its retained unsigned native products. Physical-device/TestFlight acceptance and owner signing remain separate gates. Filename-only annotation identity/recovery (WK-18), signed MAS sandbox/bookmark testing, native/OS false recents, and release authorization remain explicit follow-ups.
