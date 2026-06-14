# Tasks — Session 07: Phase 2 (auto/system theme + reduced motion, slice 2)

**Date:** 2026-06-14
**Type:** tasks (session-level implementation checklist)
**Phase:** 2 — Design system & UX modernization
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §Phase 2

Slice 2 of Phase 2. Delivers the **auto/light/dark theme** and **motion polish**
parts of the roadmap's "token overhaul + auto/light/dark theme + motion" line.
Picked the theme + motion work (logic-testable, low blind-risk) and **deferred
the bulk CSS token mass-replacement** to a later slice that warrants a visual
pass — those ~50 hard-coded hexes aren't unit-testable and rewriting them blind
is pure risk for little verifiable gain.

---

## Auto / system theme

The theme model went from a 2-way light↔dark flip to a 3-way preference with an
OS-following mode:

- **`state.themePreference`** (`'light' | 'dark' | 'auto'`) is the persisted
  user choice; **`state.currentTheme`** (`'light' | 'dark'`) is the resolved
  theme actually applied (and read by the mermaid config). `data-theme` always
  carries the resolved value, so all existing CSS is unchanged.
- **`auto`** resolves via `window.matchMedia('(prefers-color-scheme: dark)')`
  and **live-updates** when the OS flips while in auto mode (a `change` listener
  re-applies; it's a no-op once an explicit light/dark is chosen).
- The toggle button now **cycles light → dark → auto → light**, with the icon
  (🌙 / ☀️ / 🌗) and the `aria-label`/`title` updating to name the current mode
  and the next.
- **Default is now `auto`** for first-run users (follow the OS); anyone with a
  stored `light`/`dark` keeps it. `window.setTheme(...)` (iOS bridge) accepts
  all three values.

## Motion polish

- Global **`@media (prefers-reduced-motion: reduce)`** reset that neutralizes
  animations, transitions, and smooth scrolling app-wide (replaces the narrower
  toast-only guard from slice 1, which it subsumes).

## Verification (automated)

- `tests/unit/theme.test.js`: rewrote the toggle tests for the 3-way cycle and
  added an **auto/system** describe with a `matchMedia` mock — auto→dark/light
  resolution, default-to-auto, live OS-change updates, and "stops following the
  OS once an explicit choice is made."
- **build ✓, lint ✓, typecheck ✓, 324 tests ✓** (was 319; `state.js` typedef
  gained `themePreference`).

## Manual check (the only blind spot)

Pure-visual: confirm the 🌗 auto state and the cycle read correctly in the UI on
web/desktop/iOS — but the logic (which theme actually applies) is fully gated by
Jest.

## Remaining Phase 2

- **Design-token overhaul** (spacing/radius/typography scales, replace the ~50
  stray hard-coded hexes) — deferred here; best done with a visual pass.
- **Command palette (Cmd+K)** + toolbar consolidation/overflow + keyboard
  shortcut sheet (slice 3).
