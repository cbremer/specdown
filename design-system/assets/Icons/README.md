# Icons

The in-app outline set: 15 Lucide-derived icons (MIT) defined in `markdown-viewer/src/core/icons.js`. That file is the only source. Each is a 24×24 viewBox at a 2px stroke with round caps and joins, rendered at 16px.

- In product, icons draw with `currentColor` and inherit text colour. The artifact's display copies are fixed to ink `#1a1a1a` (`text-primary` light), because an `<img>` can't inherit colour.
- `moon`, `sun` and `auto` are the light/dark/system toggle. `palette`, `sparkles`, `waves` and `grid` are the visual-theme icons (Basic, Starfield, Aurora, Blueprint).
- Add a new icon by adding its path to `PATHS` in `icons.js`, never as an emoji.
