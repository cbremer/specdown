# Tasks — Session 15: code-block copy buttons

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 4 / UX polish

A hover **"Copy"** button on every rendered code block — the modern-viewer
affordance SpecDown was missing. Works on all three surfaces; excluded from
print/PDF output.

---

## What shipped

- **`markdown-viewer/src/features/code-copy.js`** (`// @ts-check`):
  `enhanceCodeBlocks(container)` adds a copy button to each `<pre><code>`
  (idempotent — skips blocks already enhanced). Click copies the block's text via
  `navigator.clipboard.writeText`, with a legacy `execCommand('copy')` fallback
  for non-secure contexts; the button briefly flashes **"Copied"**.
- **`main.js`** — calls `enhanceCodeBlocks(markdownContent)` after each render
  (right after `revealHtmlComments`).
- **`platform/ios-chrome.js`** — adds `.code-copy-btn` to the print-clone strip
  list so buttons don't appear in printed/PDF output.
- **CSS** — `.code-copy-btn` positioned top-right of the (now `position:
  relative`) `<pre>`, revealed on hover/`focus-within`, green "copied" state via
  `--color-success`, hidden in `@media print`.

## Verification

- `tests/unit/codeCopy.test.js` (+4): one button per code block, no button for a
  `<pre>` without `<code>`, idempotent re-enhance, click copies the text (mocked
  clipboard) + flashes feedback.
- `npm run build` ✓, `npm run lint` ✓, `npm run typecheck` ✓, `npm test` →
  **375 passed**.

## Manual check (visual)

Open a doc with code blocks → hover a block → a "Copy" button appears top-right →
click → it copies and flashes "Copied". Confirm in light + dark, and that it
doesn't show in Print/PDF.
