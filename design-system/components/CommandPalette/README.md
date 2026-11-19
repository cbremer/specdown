# CommandPalette

Command palette (⌘K / Ctrl+K): fuzzy list of every app command, with keyboard hints.

**Source:** `.command-palette*` ("Command Palette"). Static rendition.

- Scrim `rgba(0,0,0,.4)`. The panel sits 12vh from the top, min(92vw, 38rem) wide, on `bg-primary` with `border-color`, `radius-xl` and `shadow-lg`.
- Input in `ui-input` (1rem), with no border except a bottom hairline.
- Rows have `radius-lg` and padding 0.55rem 0.85rem. The selected row is `accent-color` / `text-on-accent`. Hints are `ui-caption` at 70% opacity.
