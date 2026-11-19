# Visual themes

Themes are the fun layer. They change the empty state (the drop zone and landing) and nothing else. Light/dark is a separate axis, so every theme ships both.

| Theme     | id          | Icon     | Ground (light / dark)                | Character                                                                                                                                       |
| --------- | ----------- | -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic     | `default`   | palette  | `bg-secondary`                       | Plain neutral ground                                                                                                                            |
| Starfield | `starfield` | sparkles | `starfield-ground` #eef4fb / #05060d | **Default on every surface.** Brand nebulae (`brand-teal`, `brand-coral`, `starfield-violet`), canvas stars and a comet that follows the cursor |
| Aurora    | `aurora`    | waves    | `aurora-ground` #eef6f4 / #040b10    | CSS-only curtains in `aurora-green`, `aurora-sky`, `aurora-violet` sweeping at 118°                                                             |
| Blueprint | `blueprint` | grid     | `blueprint-ground` #eef5fb / #071d33 | Spec-sheet grid in `blueprint-line`: 24px minor, 120px major, inset frame                                                                       |

## Rules

- **Set on the root:** `data-visual-theme="<id>"` beside `data-theme="light|dark"`. Every rule is scoped `[data-visual-theme="<id>"] .drop-zone`.
- **The drop card stays legible.** `.drop-zone-content` sits above the backdrop (`z-index: 2`) on `bg-primary`. A theme never recolours the card, its text or the accent.
- **Decorative colour stays at low alpha.** Glows run at 8–32% alpha so the card and copy keep their contrast. A theme colour never carries text.
- **Slow, ambient motion:** nebula drift 28s, aurora sweep 22s, cursor ring pulse 3.6s. Under `prefers-reduced-motion`, all of it stops and the Starfield comet hides. The comet also hides below 640px.
- **Native shells read the same catalog.** The header dropdown, the iOS sheet and the desktop Appearance → Theme menu all read `visualThemeCatalog` (`src/core/visual-theme-catalog.js`). The desktop gets it over IPC.
- **To add a theme:** append `{ id, label, icon }` to the catalog, add an icon to `icons.js`, and add a `[data-visual-theme="<id>"]` block with light and dark grounds. Add its ground and glow colours to this system as `<id>-ground` / `<id>-*` tokens.
- **Custom CSS** (desktop Appearance → Load Custom CSS Theme…) is a separate mechanism that can restyle anything. Treat it as user territory, not part of the system.
