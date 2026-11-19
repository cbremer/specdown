# Source editing and experimental document import

Product definition and delivery planning for lightweight Markdown source editing and experimental conversion of other documents into Markdown reading copies.

Current status — edit/save development builds are implemented locally on `codex/source-edit-save-dev`. Desktop smoke checks and iPhone/iPad native save tests have passed. Owner accessibility/provider and other-platform acceptance remains open. MarkItDown host conversion succeeded on small synthetic fixtures, but in-app import is deferred pending runtime packaging and qualification. See the [development acceptance record](2026-11-18-spec-edit-save-dev-acceptance.md).

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

## Naming

Use `YYYY-MM-DD-spec-<detail>.md` for product requirements and `YYYY-MM-DD-tasks-session-NN-<detail>.md` for session records. The linked PRD describes user functionality and behavior. Linear holds the execution sequence and acceptance work.
