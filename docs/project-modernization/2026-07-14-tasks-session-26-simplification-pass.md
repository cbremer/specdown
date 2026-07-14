# Tasks — Session 26: Simplification Pass

**Date:** 2026-07-14
**Scope:** The "worth it" list from a dedicated simplification audit
(post-Waves A–C). Verdict from the audit: the codebase is low-fat; genuine
reducible weight was concentrated in styles.css and stale artifacts. This
session removes it and then deliberately stops.

## Checklist

- [x] **Toolbar-button CSS consolidated.** Ten content-header action buttons
      carried byte-identical 12-property base rules plus identical accent
      hover/active blocks. Collapsed into one grouped base selector, one
      grouped count-badge padding override, and one grouped accent rule.
      Real deviations (watch-active green, annotate-active orange, count
      badges, view-toggle icon typography) stay as the only per-button rules.
      styles.css 2,944 → 2,773 lines (−171; diff is +42/−213, no reformat
      noise — the file is not Prettier-conforming, so whole-file formatting
      was deliberately avoided).
- [x] **Dead CSS deleted:** `.load-new-button` (+ hover) — unreferenced in
      HTML/JS/Swift/samples — and the orphaned "Print Button" section header.
- [x] **Stale root doc deleted:** `TEST_COVERAGE_ANALYSIS.md` (dated
      2026-01-24, pre-modernization; superseded by docs/project-modernization).
- [x] **Dead test-mock surface trimmed:** the `mermaidAPI` block in
      tests/mocks/mermaid.js and `Renderer`/`setOptions` in
      tests/mocks/marked.js — none referenced anywhere.
- [x] **Dead export removed:** `isCommentsHidden()` in features/comments.js
      (exported, imported nowhere in src or tests).
- [x] **Dead devDependencies removed:** `@testing-library/dom` (referenced
      only in package.json) and `@testing-library/jest-dom` (loaded in
      tests/setup.js but zero tests use its matchers) + the setup require.
- [x] **drag-drop duplication collapsed:** `handleDrop` and the
      document-level drop now share one `openDroppedTransfer(dataTransfer,
    shouldOpen)` core, differing only by the open-tab guard.

## Explicitly left alone (audit: churn > benefit)

- Per-module `el()` helpers (intentional under the eval test harness's
  global-scope inlining; identical duplicates are free, renames are risky).
- index.html static SVGs vs core/icons.js (only ~6 of 20 overlap; hydration
  would add code and a no-JS flash for zero net lines).
- desktop/main.js as a single file (cohesive main-process closure; splitting
  adds parameter plumbing and breaks the test suite's direct require).
- Passthrough DOMPurify/marked mocks (intentional, documented in CLAUDE.md).
- package.json test-script variants (cheap ergonomics).

## Verification

`npm test` — 483 passing. `npm run lint` — 0 errors/0 warnings (enforced).
`npm run typecheck` clean. `npm run build` green. Net: **−1,060 lines**
across code, CSS, mocks, and stale docs; 2 fewer devDependencies.
