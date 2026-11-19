# Session 01: codify the design system

Linear: ZIL-225 (commit as source of truth). Follow-up work is ZIL-219 to ZIL-234.

## Done

- [x] Inventoried the shared viewer stylesheet: 14 existing CSS variables, 114 raw hex values, 129 `rgba()` values, more than 30 font sizes, 11 z-index values.
- [x] Measured WCAG contrast for every text/ground pair in light and dark.
- [x] Wrote `design-system/tokens.json`: 37 colours (light/dark), 15 type styles, spacing, radius and shadow, all under the source's own names.
- [x] Wrote the brand book (`README.md`) plus `native-platforms.md`, `visual-themes.md` and `evolving.md`.
- [x] Documented 26 components with guidelines and static previews: 11 web components, 4 native iOS/Mac components, 9 current dialogs and panels, and the proposed shared Modal (Dialog/Sheet/Drawer).
- [x] Copied the component rules from `styles.css` as whole rules into `components/bundle.css`. Copying by line range had split rules and broken every preview after the first split.
- [x] Rendered every preview in light and dark with Playwright and checked the screenshots.
- [x] Filed bugs and planned work in Linear.
- [x] Committed the system to `design-system/` and added the design-system rule to `AGENTS.md`.

## Found

| Finding                                                          | Linear  |
| ---------------------------------------------------------------- | ------- |
| Note editor Save is white on the light dark-theme accent (2.1:1) | ZIL-219 |
| Toasts (z 10000) render under dialogs (z 10002–10020)            | ZIL-220 |
| `logo-dark.svg` is identical to `logo.svg`                       | ZIL-221 |
| Search highlights 2.2:1 and 3.3:1                                | ZIL-222 |
| iOS sheets without dialog role; note editor without focus trap   | ZIL-223 |
| Success and warning colours fail as text on light grounds        | ZIL-224 |

## Not done

- No app code changed in this session. The fixes are tracked separately.
- The browsable version is a private claude.ai artifact, re-synced from this folder by hand.
