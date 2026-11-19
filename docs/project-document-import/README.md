# Source editing and experimental document import

Product definition and delivery planning for lightweight Markdown source editing and experimental conversion of other documents into Markdown reading copies.

Current status — edit/save development builds are implemented locally on `codex/source-edit-save-dev`. Desktop smoke checks and iPhone/iPad native save tests have passed. Owner accessibility/provider and other-platform acceptance remains open. Word (.docx) and PDF files open as locally converted Markdown copies in direct desktop and iOS Dev. Sparse PDF pages receive local English OCR. The earlier MarkItDown experiment is recorded separately. See the [development acceptance record](2026-11-18-spec-edit-save-dev-acceptance.md).

## Linear planning

- [Project — SpecDown Source Editing and Experimental Import](https://linear.app/zilla151/project/specdown-source-editing-and-experimental-import-b0fb837c00d9)
- [Functional PRD draft](https://linear.app/zilla151/document/specdown-source-editing-and-experimental-import-functional-prd-f34959d12c32)
- [Execution plan](https://linear.app/zilla151/document/specdown-source-editing-and-experimental-import-execution-plan-8e3dae87eb96)

The project contains 21 issues, ZIL-198 through ZIL-218, across six milestones covering source editing, import readiness, experimental import, next-version acceptance, Google Docs access, and scanned-PDF recognition. Desktop and mobile have independent execution and acceptance tracks. Ordinary Markdown editing has no dependency on import discovery. The editing issues and MarkItDown discovery are In Progress; acceptance gaps are recorded in their descriptions.

The completed advisory draft review has four proposed refinements in the [review issue log](../reviews/REVIEW_ISSUES.md). They remain owner-review proposals.

## Timeline

| Date              | Type  | Document                                                                                                           |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| November 18, 2026 | Spec  | [Document import PRD](2026-11-18-spec-document-import-prd.md)                                                      |
| November 18, 2026 | Tasks | [Session 01 — PRD and Linear execution planning](2026-11-18-tasks-session-01-prd-linear-plan.md)                   |
| November 18, 2026 | Tasks | [Session 02 — source editing and experimental import planning](2026-11-18-tasks-session-02-source-editing-plan.md) |
| November 18, 2026 | Tasks | [Session 03 — edit/save development builds](2026-11-18-tasks-session-03-edit-save-dev.md)                          |
| November 18, 2026 | Spec  | [Edit/save Dev acceptance and import feasibility](2026-11-18-spec-edit-save-dev-acceptance.md)                     |
| November 18, 2026 | Tasks | [Session 04 — contextual editing in Dev builds](2026-11-18-tasks-session-04-contextual-editor-dev.md)              |
| November 18, 2026 | Tasks | [Session 05 — Open Word and save Markdown in Dev](2026-11-18-tasks-session-05-word-open-dev.md)                    |
| November 18, 2026 | Tasks | [Session 06 — PDF text import in Dev](2026-11-18-tasks-session-06-pdf-open-dev.md)                                 |
| November 18, 2026 | Tasks | [Session 07 — Local PDF OCR in Dev](2026-11-18-tasks-session-07-pdf-ocr-dev.md) |

## Naming

Use `YYYY-MM-DD-spec-<detail>.md` for product requirements and `YYYY-MM-DD-tasks-session-NN-<detail>.md` for session records. The linked PRD describes user functionality and behavior. Linear holds the execution sequence and acceptance work.
