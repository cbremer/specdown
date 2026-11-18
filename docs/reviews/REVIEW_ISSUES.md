# Advisory review issues

## Document import PRD, 2026-11-18

Reviewer — Codex `prd_review`, completed read-only review of
`docs/project-document-import/2026-11-18-spec-document-import-prd.md` in the working
tree against base commit `d3e5256b46a03a7b2dcee5e9a4869fa5d0a57c47`.
The review covers the owner's functional PRD and planning scope. It does not
establish converter, device, or release acceptance. Suggestions below are proposed
draft refinements. They have no implementation authorization and create no extra
execution tasks or publication gate.

| Concern                                                                                                                | Proposed follow-up                                                                                                                            | Status                             |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| F4's offline-image guarantee and the initial text-PDF scope leave PDF-figure preservation ambiguous.                   | Define format-specific figure guarantees and qualify a PDF containing meaningful figures.                                                     | Proposed — owner decision pending. |
| F6 retains converted copies after removing recent entries but does not name where those copies are subsequently found. | Define a minimal imported-copy management entry point and a locate/delete acceptance scenario.                                                | Proposed — owner decision pending. |
| F2/F6/F8 leave ordinary, partial, and refreshed-copy acceptance timing implicit.                                       | Define automatic first-import acceptance, explicit partial-result acceptance, and refresh replace/keep-both behavior, including interruption. | Proposed — owner decision pending. |
| A14's tracked-change qualification could miss sole-occurrence deletions or unresolved revisions.                       | Add concrete qualification examples distinguishing accepted-changes text from an unsupported-content result.                                  | Proposed — owner decision pending. |

## URL entry, 2026-11-08

Reviewer: Codex `url_entry_review`, completed. Reviewed base commit:
`c0ddabaea9c1cecfbcb6f20b0b05333e74bf3d21` plus the uncommitted URL candidate.
The preexisting About changes were excluded from this review.

| Concern                                                                                                            | Proposed follow-up                                                                                           | Status                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| P1: A native submit Task can start after immediate Cancel, before its JavaScript session exists.                   | Check controller/request ownership before calling JavaScript; cover submit followed synchronously by cancel. | Owner explicitly approved; reproduced by a failing native regression, fixed, and included in the passing 10-test native document group. |
| P2: The loader returns success when tab creation rejects at the tab limit or during document preparation.          | Respect the acceptance result; keep the native URL/error visible and avoid a failed-open recent.             | Owner explicitly approved; reproduced at ten tabs, fixed, and included in the passing 1518-test shared suite.                           |
| Keyboard visibility, compact iPad, large text and VoiceOver are not established by a window-containment assertion. | Record these as pending physical/manual acceptance until observed.                                           | Evidence limitation recorded; no completed acceptance claimed.                                                                          |

## Combined release integration, 2026-11-08

Reviewer: Codex `release_integration_review`, completed read-only review of
`16f2cea71189ef96f0f0d135da413018709923cd` against current main, with the
application pass focused on changes since `c0ddaba`. Copilot review was
requested on [draft PR #419](https://github.com/cbremer/specdown/pull/419);
the request attempt returned success, but live readback has no assigned reviewer
or completed Copilot review. The Codex review above is completed. Neither review gates the
authorized Beta delivery.

| Concern                                                                                                                                                                                                                                                                                              | Proposed follow-up                                                                                                                             | Status                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2: When no iOS document is open, a GitHub chooser's file-fetch failure is written to `#url-error` inside the hidden inline URL section. The native form and chooser have already closed, so no error is visible. Source path: `ios-url-entry.js:30` → `repo-browser.js:56` → `file-loading.js:139`. | Choose a visible error surface when inline URL entry is hidden; cover initial repository file selection with an HTTP, network or size failure. | Owner explicitly approved inclusion after Beta 239 delivery. Reproduced with three failing UI regressions (HTTP, network and oversized response); corrected by selecting the existing visible toast when native inline entry is hidden. Targeted 79-test URL/GitHub group passes; full validation and build 240 preparation are recorded in Session 93. Beta 239 remains frozen. |
| Physical keyboard behavior, compact adaptation, large text, VoiceOver and provider permissions remain distinct from source/static checks.                                                                                                                                                            | Keep owner/native acceptance pending until actually observed.                                                                                  | Evidence limitation recorded. No source defect or passed acceptance inferred.                                                                                                                                                                                                                                                                                                    |

The reviewer found no further actionable issue in About channel/build handling
or the already approved immediate-Cancel and ten-tab refusal corrections.
Current-main instructions, security files and dependencies were preserved.
