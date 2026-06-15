# Tasks — Session 11: Phase 2 (design tokens + focus-visible, slice 4a)

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 2 — Design system & UX modernization
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §Phase 2

The design-token half of Phase 2 slice 4. Establishes a proper token system and
a keyboard focus treatment. **Color output is value-preserving** — every
substitution maps to a token whose value equals the prior inline value, so the
already-tested light/dark appearance is unchanged. The one *visible* addition is
keyboard focus rings.

---

## Token system (added to `:root`)

- **Radius scale** — `--radius-sm` 4px / `--radius-md` 6px / `--radius-lg` 8px /
  `--radius-xl` 12px / `--radius-pill` 999px. The 41 single-value
  `border-radius` declarations using those sizes now reference the tokens
  (sed-substituted with a trailing-`;` anchor so multi-value shorthands like
  `8px 8px 0 0` were left untouched). Odd one-offs (2/3/5/16/20px, 50%) left as-is.
- **Spacing scale** — `--space-1`…`--space-6` (4px base rhythm), defined for
  adoption by new components.
- **Motion** — added `--transition-fast` alongside the existing `--transition`.
- **Typography** — `--font-sans` (the repeated system stack, now referenced by
  `body`) and `--font-mono`.
- **Semantic status palette** — `--color-success` / `--color-info` /
  `--color-warning` / `--color-danger` / `--text-on-accent`. The toast accent
  bars now reference these (value-identical), so status colors are defined once
  by intent rather than as scattered inline hex.

## Accessibility: keyboard focus

- A global **`:focus-visible`** rule gives keyboard users a consistent
  accent-colored outline (`outline-offset: 2px`). `:focus-visible` matches only
  keyboard focus, so mouse clicks stay clean. Low specificity, so the handful of
  inputs with their own `:focus` border/box-shadow treatment keep it; plain
  buttons/links — which previously had **no** focus indicator — now get one.

## Verification

- `npm run build` ✓ (Vite processes/validates the CSS), `npm run lint` ✓,
  `npm run typecheck` ✓, `npm test` → **345 passed**.
- CSS isn't exercised by the jsdom suite, so the **visual check is the focus
  rings** + confirming light/dark is unchanged (it is — value-preserving).

## Toolbar overflow menu (slice 4b, same PR)

On narrow viewports the secondary content-header actions (Contents / Split /
Annotate / Print) now collapse behind a single **"⋮" overflow button** instead
of just dropping their labels. `view-toggle` and `watch-toggle` stay inline.

- New **`features/toolbar-overflow.js`** (`// @ts-check`): builds a `role="menu"`
  dropdown on open; each `menuitem` is a **thin proxy** that `.click()`s the real
  toolbar button — so there's **no duplicated action logic** (whatever a button
  does, the menu does). Open/close/toggle, outside-click + Esc close, and
  `aria-expanded` sync on the toggle.
- CSS uses the new radius/shadow/transition tokens; the `max-width: 768px` block
  now hides those four buttons and reveals `#overflow-toggle`.
- Tests: `tests/unit/toolbarOverflow.test.js` (menu/ARIA, open-via-toggle,
  **proxy-to-real-button** effect, close/toggle, outside-click). **+6 tests.**

## Deliberately out of scope (left for a visual pass)

- Consolidating the remaining scattered colors (annotation status hexes, the
  GitHub code-block theme `#0d1117`/`#30363d`/`#e6edf3`) into tokens would change
  values if unified, so it's deferred — not worth a contrast regression.
