# Session 01 — document import PRD and Linear plan

Date — November 18, 2026.

## Scope

Draft user functionality and behavior for Word, PDF, and Google Docs import. Create an execution plan in Linear, with desktop and iPhone/iPad work able to progress in parallel and on-device conversion preferred.

## Baseline

The checkout was clean on `main` at `d3e5256b46a03a7b2dcee5e9a4869fa5d0a57c47`, with origin `https://github.com/cbremer/specdown`. The connected Linear team is Zilla151 (`ZIL`). Searches found no existing MarkItDown or document-import project to reuse.

## Checklist

- [x] Read repository instructions and the current reading, notes, saved-copy, and native behavior baseline.
- [x] Draft the functional PRD and identify proposed product choices.
- [x] Complete a bounded draft review and record suggested refinements as proposed follow-ups.
- [x] Create and verify the Linear project, PRD document, milestones, issues, and dependencies.
- [x] Record final planning links and document checks.

## Planning records

- [Linear project](https://linear.app/zilla151/project/specdown-document-import-b0fb837c00d9)
- [PRD draft](https://linear.app/zilla151/document/specdown-document-import-functional-prd-draft-f34959d12c32)
- [Execution plan](https://linear.app/zilla151/document/specdown-document-import-execution-plan-8e3dae87eb96)

Created 15 Backlog issues, ZIL-198 through ZIL-212, with acceptance criteria and blocking relationships. The three milestones cover readiness/shared behavior, initial desktop/mobile import, and subsequent scanned-PDF recognition. All issue descriptions link to the PRD. Dates, estimates, and assignees remain unset.

Readback verified all 15 issue statuses, milestone assignments, PRD links, and exact dependency sets. Both platform entry-point issues depend on the shared lifecycle issue and remain independent of each other. The initial acceptance issue excludes the later OCR increment. Remote PRD readback contains F1–F8, A1–A14, and the reference section. The execution document contains every created issue and describes concurrent platform work.

Codex `prd_review` completed a read-only draft review against the baseline commit. Four proposed refinements are recorded in `docs/reviews/REVIEW_ISSUES.md`, covering PDF figures, retained-copy discovery, result acceptance timing, and tracked-change qualification. They remain proposals under repository review policy and introduced no implementation work or extra Linear tasks.

Document formatting was checked with Prettier on the new project documents and the touched review log. `git diff --check` passed. Documentation changes remain uncommitted in the working tree.

## Verification boundary

This session produces documentation and planning records. Device conversion quality, runtime feasibility, numeric resource limits, and release acceptance remain execution-plan work.
