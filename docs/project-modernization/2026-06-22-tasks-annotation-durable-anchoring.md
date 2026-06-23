# Tasks — Durable annotation anchoring (store schema v2)

**Date:** 2026-06-22
**Type:** tasks
**Roadmap item:** §4 of the [retrospective](2026-06-19-retrospective-handoff.md) —
"Annotation robustness: annotations anchor by positional block index, which
drifts if the document is edited/reordered."

## Problem

Notes were keyed by raw positional block index (`{ file: { idx: text } }`), so
editing or reordering a document silently moved every note to the wrong block.

## Approach (hybrid anchor, graceful fallback)

Each note now stores a durable `anchor`:

- **`fp`** — a hash of the block's normalized text (the primary signal; survives
  reordering and edits elsewhere).
- **`path`** — a hash of the enclosing heading trail, to disambiguate blocks with
  identical text.
- **`ordinal`** — occurrence index within the same-fingerprint bucket, as a final
  tiebreak.
- **`legacyIdx`** — the positional index, kept only as a last-resort fallback.

Resolution degrades predictably: unique fingerprint → fingerprint within matching
heading-path → ordinal → stored index. When the fingerprint is gone (the block's
text was edited), the note falls back to its last index and is flagged
**orphaned** — a muted/dashed badge and a "(moved or edited)" panel cue — rather
than silently misplacing it.

## Migration (no data loss, durable export)

- **One versioned store** (`{ version: 2, files: { file: Note[] } }`), not a
  sidecar. Legacy v1 (`{ file: { idx: text } }`) is **read transparently** and
  migrated in memory; the first render of a doc upgrades its notes to real
  anchors and persists them. Nothing is ever dropped — a not-yet-anchored note
  just uses its index until its block is seen.
- **Export/import** is v2 but **still accepts v1 JSON** on import, so previously
  exported files keep working. Because anchors live in the single store, export
  is durable.
- When a fingerprint relocates a note, its `legacyIdx` fallback is refreshed so
  it stays useful.

## Files

- `markdown-viewer/src/features/annotations.js` — rewritten around the v2 store +
  anchor resolver. The note **id** (not an index) is now the UI currency:
  annotated blocks carry `data-annot-id`, so edit/delete/jump operate on the
  note, and adding a note computes its anchor from the target block.
- `markdown-viewer/styles.css` — muted/dashed orphaned-badge + italic orphaned
  panel-context styles.
- `tests/unit/annotations.test.js` — rewritten for v2: store/migration, the
  reorder-follows-content case, heading-path disambiguation, the edited→orphaned
  fallback, editor/panel, and v1+v2 import.

## Gates

- `npm test` → **460 pass** (was 456; +durability/migration cases).
- lint 0 errors, typecheck clean, build green.

## Notes

- Module-private helpers are uniquely named (`annHash`, `annContext`, `annResolve`,
  `annReadStore`, …) to avoid the eval test-harness's identifier-collision trap.
- The hash is FNV-1a (non-cryptographic) — collisions are tolerable because the
  heading-path + ordinal disambiguate and the index is a final fallback.
