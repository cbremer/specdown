# ThemeBackdrops

Visual theme backdrops: the empty-state drop zone dressed as Basic, Starfield (the default), Aurora and Blueprint.

**Source:** `[data-visual-theme]` blocks in `styles.css` and `src/core/visual-theme-catalog.js`. Static rendition. The Starfield canvas stars and the cursor comet are JS and aren't shown.

- Set `data-visual-theme="<id>"` on the root, next to `data-theme`. Each theme has light and dark grounds (`starfield-ground`, `aurora-ground`, `blueprint-ground`).
- The drop card (`.drop-zone-content`: `bg-primary`, 3px dashed `border-color`, 16px radius) stays unchanged on top, so copy keeps full contrast.
- Motion is slow and stops under reduced motion. See Visual themes.
