# Tasks — Session 24: Wave B (UX Consolidation)

**Date:** 2026-07-14
**Scope:** Wave B of the
[Evaluation v2](2026-07-14-brainstorm-evaluation-v2-post-modernization.md)
"Consolidate & Harden" plan — the UX-coherence and design-layer findings.

## Checklist

- [x] **SVG icon set replaces emoji glyphs.** New `core/icons.js`
      (Lucide-derived outlines, `currentColor`, `aria-hidden`); every toolbar
      button, the theme toggle (moon/sun/monitor via `data-icon`), the tab
      file icon, the iOS action bar, the fullscreen + per-diagram controls
      (reset/share/fullscreen), and the repo-browser file rows now use inline
      SVG. The in-content annotation `✎` badge is deliberately unchanged.
- [x] **Comments / Annotate / Notes collision resolved.** One primary
      **Annotate** control stays in the toolbar; "Show author comments" and
      "Annotations list" are overflow-menu (and palette) actions. The three
      same-vocabulary sibling buttons are gone.
- [x] **Overflow "⋮" menu is real at all widths.** The toolbar shows only
      Contents, Split, Annotate, Present (+ new Search) plus "⋮"; the
      long-tail (`.overflow-only`: Watch, Workspace files, author comments,
      annotations list, Print, Raw) lives in the menu, which lists the
      complete feature-gated action set. Inline `style.display` remains the
      feature-gating signal, so menu availability logic is unchanged.
- [x] **Visible search affordance** — icon button in the toolbar wired to
      `openSearch()`; Cmd/Ctrl+F still works.
- [x] **Dark theme fixed.** Body text softened `#fff → #e6e6e6` (~14:1,
      no halation). Full accent split: dark mode uses light-blue accent
      `#7ab8f5` (links ~8.3:1 on `#1a1a1a`) with dark-navy `--text-on-accent`
      `#0d1b2a` (~8.3:1 on the accent) — 24 hardcoded `color: white` on
      accent backgrounds converted to `var(--text-on-accent)`.
- [x] **Motion tokens are targeted.** `--transition`/`--transition-fast`
      no longer use `all` — explicit property lists at 200ms/120ms.
- [x] **Focus traps on all modal surfaces.** New `core/focus-trap.js`
      applied to the command palette, shortcuts sheet, presentation overlay,
      repo browser (plus dialog role/aria-modal there), and iOS sheets.
- [x] **Shortcut sheet completed** — now covers search navigation,
      presentation nav/zoom, diagram pointer gestures, and the annotate
      double-click, not just 5 rows.
- [x] **URL-open loading state** — the Open button shows "Opening…",
      disables against double-submits, and sets `aria-busy` while the fetch
      runs (also covers the repo-browser scan, same path).
- [x] **First-run hierarchy** — Browse stays the single primary action;
      URL / samples / recents sections are visually demoted (hairline
      separator, muted until hover/focus).

## Verification

`npm test` — **480 passing** (+9 new: overflow long-tail/comments/search
affordance, focus-trap core + wiring). `npm run typecheck` clean.
`npm run lint` 0 errors. `npm run build` green.

## Known-remaining (deliberately out of scope)

- Status-color chips (green watch-active, amber annotate-active, red
  close-fullscreen) still use hardcoded white text on mid-tone backgrounds —
  a semantic-status contrast pass is Wave B2 material.
- `--space-*` / type-scale adoption across all 79 raw font-sizes and 64 raw
  hexes remains partial (chrome components only); a mechanical sweep should
  ride along with the next styles.css refactor.
- Overflow menu items don't yet mirror toggle state (active checkmark) —
  polish item.
- iOS parity gaps (no search/palette on iOS, 2-way theme) are Wave D scope.
