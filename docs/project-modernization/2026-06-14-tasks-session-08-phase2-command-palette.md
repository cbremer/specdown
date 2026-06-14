# Tasks — Session 08: Phase 2 (command palette + shortcut sheet, slice 3)

**Date:** 2026-06-14
**Type:** tasks (session-level implementation checklist)
**Phase:** 2 — Design system & UX modernization
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §Phase 2

Slice 3 of Phase 2: the **command palette (Cmd/Ctrl+K)** and the **keyboard
shortcut sheet (`?`)**. Net-new UI, but the substance — a command registry,
fuzzy filtering, and keyboard navigation — is pure logic, so it's almost
entirely Jest-gated; only the rendered look needs a glance.

---

## Command palette (`features/command-palette.js`, `// @ts-check`)

- A registry of `Command` objects (`id`, `title`, optional `hint`/`keywords`,
  `run`, optional `isAvailable`). The entry module registers the set in
  `registerAppCommands()` so the palette stays decoupled from the features it
  invokes (open file, toggle theme, raw/preview, TOC, split, annotate, find,
  print, shortcuts).
- **`filterCommands`** / **`fuzzyScore`** are pure and exported: subsequence
  fuzzy match with consecutive- and start-of-string bonuses; commands whose
  `isAvailable()` is false (e.g. document-only actions with no doc open) are
  hidden.
- Full **keyboard nav**: ↑/↓ move the selection, Enter runs + closes, Esc
  closes; mouse hover/click work too. Opens with **Cmd/Ctrl+K** (wired in the
  global keydown), closes on outside-click. Focus is captured on open and
  **restored** to the prior element on close.
- **ARIA:** combobox input + listbox/options dialog (`role="dialog"`,
  `aria-modal`, `aria-activedescendant`, `aria-selected`). Built on open / torn
  down on close, so there's no stale selection between invocations.

## Keyboard shortcut sheet (`features/shortcuts.js`, `// @ts-check`)

- A small accessible modal (`role="dialog"`, `aria-modal`) listing the app's
  shortcuts as `<kbd>` + description rows. The modifier glyph adapts (⌘ on Apple
  platforms, Ctrl elsewhere). Opened with **`?`** (suppressed while typing or
  while the palette is open) and via the palette's "Keyboard shortcuts" command.

## Styling

- New `.command-palette*` and `.shortcuts-*` rules, all built on the theme
  tokens (`--bg-primary`, `--text-primary`, `--border-color`, `--accent-color`,
  `--shadow-lg`) so they track light/dark automatically.

## Verification (automated)

- `tests/unit/commandPalette.test.js`: `fuzzyScore` (no-match / subsequence /
  start bonus / empty), `filterCommands` (availability, fuzzy, keywords, no
  match), open/close/toggle, ARIA dialog wiring, arrow-key selection, Enter-runs
  + closes, Esc, live input filtering, empty state.
- `tests/unit/shortcutsSheet.test.js`: accessible modal + `<kbd>` rows,
  idempotent open, close/remove, Esc-to-close.
- **build ✓, lint ✓, typecheck ✓, 345 tests ✓** (was 324; +21).
- (Document-level Cmd+K/`?` dispatch isn't unit-tested because `loadApp`
  re-attaches the global keydown listener each run, which would make a
  document-dispatch assertion order-dependent; the open/close/toggle logic those
  keys call is covered directly.)

## Remaining Phase 2

- **Toolbar consolidation + overflow menu** and the broader **design-token
  overhaul** (spacing/radius/typography scales + retiring stray hard-coded
  hexes) — both want a visual review pass, so they're the natural
  with-you-watching slices to close out Phase 2.
