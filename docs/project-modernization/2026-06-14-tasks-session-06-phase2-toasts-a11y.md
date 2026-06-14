# Tasks — Session 06: Phase 2 (toasts + accessibility, slice 1)

**Date:** 2026-06-14
**Type:** tasks (session-level implementation checklist)
**Phase:** 2 — Design system & UX modernization
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §Phase 2

Phase 2 splits into three reviewable slices: **(1) toasts + accessibility**,
(2) design tokens + theming (auto/light/dark + motion), (3) command palette +
toolbar overflow + shortcut sheet. This session ships **slice 1** — chosen first
because it's the most logic-heavy / least visual, so it's gated by Jest rather
than by manual eyeballing.

---

## Toast notifications (kill `alert()`)

- New **`features/toast.js`** (`// @ts-check`): an accessible, auto-dismissing,
  click-to-dismiss notification system. A shared `#toast-region` holds stacked
  toasts; each toast carries **`role="alert"`** (assertive, errors) or
  **`role="status"`** (polite, everything else) so assistive tech announces it
  without the focus-trap / execution-halt of `alert()`. Type-specific durations
  (errors linger longest); `duration: 0` makes a toast sticky.
- Replaced **all four `alert()` call sites** with typed toasts:
  - `features/file-loading.js` — invalid file type (warning), read error (error)
  - `features/tabs.js` — max-tabs reached (warning)
  - `main.js` `renderMarkdown` — render failure (error)
- CSS: `.toast-region` / `.toast` + type variants (success/info/warning/error
  accent bars), reusing the existing `fadeIn` and shadow tokens. The existing
  bespoke `#share-toast` is left as-is (it's already a toast, not an alert, and
  its tests assert it) — unifying it is future cleanup.

## Accessibility pass (testable subset)

- **Skip link:** `<a class="skip-link" href="#markdown-content">` as the first
  body element, visually hidden until focused; `#markdown-content` gets
  `tabindex="-1"` + `role="main"` so focus lands there.
- **Accessible names on icon-only controls:** `aria-label` on `theme-toggle`,
  the four content-header toggles whose text labels are `display:none` on narrow
  screens (toc/split/print/annotate — otherwise *nameless* there), plus
  `view-toggle`, `watch-toggle`, and the three search buttons. Labels **contain
  the visible word** (WCAG 2.5.3 Label-in-Name).
- **Decorative icons** (emoji/glyph spans) marked `aria-hidden="true"` so screen
  readers don't read "broom"/"hamburger" as the button name.
- **Generated tab controls:** the close (`×`) button is labelled
  `Close <filename>` and the new-tab (`+`) button `Open new file`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` drops the toast /
  share-toast entrance animations and the skip-link slide.

## Verification (automated)

- New **`tests/unit/toast.test.js`** (region reuse, role mapping, type class,
  auto-dismiss via fake timers, sticky `duration:0`, click-dismiss).
- New **`tests/unit/accessibility.test.js`** (skip link + target, `aria-label`
  on every icon-only control, label-in-name containment, decorative-icon
  hiding, generated tab-button names).
- Updated the former `alert`-asserting tests (`fileHandling`, `markdown`
  integration) to assert the toast DOM + role instead.
- **build ✓, lint ✓, typecheck ✓, 319 tests ✓** (was 297; +22).

## Notes / next

- This slice is logic-first by design; the **pure-visual** review (does the
  toast look right in light + dark, on web/desktop/iOS) is the only manual
  check, and the dark chip matches the pre-existing share toast.
- Slice 2 (**design tokens + auto/light/dark + motion**) is the next pick — it's
  CSS-heavy and wants a visual pass. Slice 3 (command palette + toolbar) last.
