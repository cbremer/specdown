# Evolving the system

Everything above describes SpecDown as it ships today. This section holds **proposals**. None of these values are in the tokens yet. Each is ordered by payoff against risk.

## 1. Close the token gaps (low risk, high payoff)

`styles.css` has 438 `var()` references but still carries 114 raw hex values and 129 `rgba()` calls. Promote the recurring ones to CSS variables under the names already in `tokens.json`: `code-surface`, `code-border`, `code-text`, `toast-surface`, `search-highlight`, `search-highlight-current`, `status-live`, `status-changed`, and the theme grounds. Also replace the repeated `#e74c3c` close-hover red with `color-danger`, and `'Courier New'` in inline code and the view toggle with `--font-mono`.

## 2. Fix the known contrast gaps

- Add `color-success-text` / `color-warning-text` (or darken the light values) so success and warning can carry text. Today they work only as edges.
- `border-color` for control outlines: add a `border-strong` around 3:1 for inputs and buttons, and keep `border-color` for dividers.

## 2a. Converge the dialogs (proposed: the Modal component)

Ten panels each hand-roll their own scrim, size, radius, title and close button. There are three scrim strengths (.28, .4, .5 + blur), six z-index values (600–10020), two radii plus a 20px one-off, three title sizes (0.95, 1.1, 1.2rem) and four close-button styles. Migrate them to the shared `.sd-modal` pattern in this order:

1. ~~Fix the two bugs first.~~ Done: the Note editor's Save button now uses `text-on-accent`, and toasts sit at 10030, above every dialog.
2. ~~Shortcuts, About and File info.~~ Done: all three use the shared Modal (`core/modal.js`).
3. **Recent files, Repo browser and Note editor.** These carry the most drift.
4. **iOS sheets.** Make them the Sheet variant and add `role="dialog"` to the Contents and Viewer Actions sheets.
5. **Annotation panel** becomes the Drawer variant. Command palette and Diagram fullscreen keep their own layouts but share the scrim and the z-layer.

## 3. Name the scales the code already uses

- **Z-index:** 2, 200, 500, 600, 900, 950, 1000, 2000, 10001, 10002, 10020 and 10030 appear ad hoc. Collapse them into named layers (`z-base`, `z-sticky`, `z-menu`, `z-ios-bar`, `z-overlay`, `z-toast`, `z-skip`, `z-modal`).
- **Font sizes:** 30+ distinct values (0.65–1.25rem). Snap UI text to the five Interface styles.
- **Radii:** 3px, 18px, 20px and 16px stragglers. Fold them into `radius-sm` / `radius-xl` / a new `radius-2xl` for the drop card.
- **Motion:** `--transition` and `--transition-fast` exist as composites. Expose `duration-fast` 120ms, `duration-base` 200ms and `easing` as primitives.

## 4. Brand in the chrome: decided, C+ (Dev and Beta preview)

Decided 19 Nov 2026 (ZIL-226): **C+ · brand moments**. Blue stays the only interaction colour; the logo's teal→coral appears where it has a job. Chris approved the design in Dev 255 for Beta 256. Production rollout is a separate decision. Full spec: `docs/project-design-system/2026-11-19-spec-brand-moments-cplus.md`. The "C+ brand moments" section of the brand book lists what's in it.

Options considered: A (keep blue, generic once a file is open), B (teal accent everywhere, competes with green status and needs a contrast pass on every fill), C (brand moments only). C+ extends C so each moment does something: reading progress, read sections, the drop moment.

## 5. Make it consumable by every shell

- Generate `tokens.css` for the web viewer and an `Assets.xcassets` colour set or Swift `Color` extension for iOS from the single `tokens.json`, so native tint and web accent can't drift.
- Split the 3,900-line `styles.css` along this system's component boundaries (toolbar, tabs, menu, toast, palette, document, themes). It already has section headers for each.
- Add a high-contrast theme as a third `color.themes` entry (text ≥ 7:1, control borders ≥ 3:1).
