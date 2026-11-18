# Session 02 — source editing and experimental import planning

Date — November 18, 2026.

## Owner direction

Source editing is sufficient. Add lightweight editing/saving to the plan for the next version alongside experimental file import. Continue parallel desktop and iPhone/iPad planning and prefer on-device conversion. This session updates requirements and Linear planning.

## Scope choices

- Editing has Edit, Preview, Save, Cancel, and Save As with per-document drafts, conflict handling, local draft recovery, and explicit destination behavior.
- Ordinary Markdown editing can proceed independently of import discovery.
- Imported copies are edited and saved as Markdown. Changes to original Word/PDF/Google formats require separate functionality.
- MarkItDown is the named experimental candidate. Local runtime/distribution feasibility remains discovery work.
- Proposed sequencing targets DOCX/text-PDF import in the experiment and retains direct Google Docs access and scanned recognition as separately planned extensions.

## Checklist

- [x] Refresh the checkout and existing Linear project/documents/issues.
- [x] Extend the functional PRD with editing requirements E1–E5 and acceptance B1–B10.
- [x] Update the existing Linear plan and related issues/milestones, and add bounded editing work packages.
- [x] Verify planning readback, dependency independence, and document checks.

## Updated planning

- [Project](https://linear.app/zilla151/project/specdown-source-editing-and-experimental-import-b0fb837c00d9)
- [Functional PRD](https://linear.app/zilla151/document/specdown-source-editing-and-experimental-import-functional-prd-f34959d12c32)
- [Execution plan](https://linear.app/zilla151/document/specdown-source-editing-and-experimental-import-execution-plan-8e3dae87eb96)

Added six source-editing work packages, ZIL-213 through ZIL-218, for shared editing/preview, desktop saving, mobile provider saving, local draft recovery, editing acceptance, and editing experimental converted copies. Updated existing import issues and next-version acceptance to distinguish the experimental local subset from later direct Google Docs access and scanned recognition.

The existing project now contains 21 Backlog issues across six milestones. ZIL-213 starts independently of import discovery. ZIL-214 and ZIL-215 each depend on ZIL-213 and remain independent of each other. ZIL-211 combines editing acceptance, converted-copy editing, platform import qualification, and import accessibility. Google authorization and OCR have no blocking path into that next-version acceptance issue.

Readback verified all 21 dependency sets and Backlog statuses, the new E1–E5/B1–B10 PRD coverage, and the updated execution map. The extension was self-reviewed for requirement coverage. The earlier independent advisory review remains scoped to the original import draft.

Prettier checks for the project documents and `git diff --check` passed. Changes remain documentation and Linear planning records, uncommitted locally.

## Baseline

The checkout remains at `d3e5256b46a03a7b2dcee5e9a4869fa5d0a57c47` on `main`. Session 01 documentation changes were already present and are preserved. Initial review findings remain proposed in `docs/reviews/REVIEW_ISSUES.md`; no new independent review is claimed by this update.
