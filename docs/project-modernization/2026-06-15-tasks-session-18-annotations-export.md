# Tasks — Session 18: annotations 2.0 (export / import)

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 4 — differentiators

Annotations have lived only in `localStorage` (per browser/device). This session
makes them **portable**: export the full store as JSON and import it back,
merging across devices so notes can be shared or backed up.

---

## What shipped

### Export
- `features/annotations.js` gains `getAnnotationsJSON()` (pretty-printed dump of
  the whole `specdown-annotations` store) and `exportAnnotations()`, which
  downloads it as `specdown-annotations.json` via a transient `<a download>`
  blob URL (revoked after the click).

### Import (merge)
- `importAnnotations(jsonText)` parses and **merges** into the existing store:
  per file, incoming notes win on an element-index conflict; untouched files and
  notes are preserved. Invalid JSON or a non-object payload is rejected with an
  **error toast**; success reports the document count. If the imported file is
  the one currently open, its badges re-render immediately.
- `importAnnotationsFromFile()` opens a hidden `<input type="file">` picker and
  feeds the chosen file through `importAnnotations`.

### Wiring
- Two command-palette commands in `main.js`: **Export annotations** and
  **Import annotations** (the latter opens the file picker).

## Verification

- `tests/unit/annotations.test.js` (+6): export emits pretty JSON; empty store
  exports `{}`; import merges across files; incoming wins on a key conflict;
  invalid JSON and non-object payloads are both rejected with an error toast.
- `npm run build` ✓, `npm run lint` ✓ (0 errors), `npm run typecheck` ✓,
  `npm test` → **385 passed**.

## Manual check (visual)

Add a few annotations to a doc → command palette (Cmd/Ctrl+K) → **Export
annotations** downloads a JSON file. Clear storage or switch device → **Import
annotations** → pick the file → badges reappear; a success toast names the
document count. Confirm light + dark.
