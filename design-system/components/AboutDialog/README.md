# AboutDialog

About dialog: app name, version, update status and links. It opens from the header ⋮ menu.

**Source:** `src/features/about.js`. It reuses `.shortcuts-overlay` / `.shortcuts-sheet` with `.about-sheet`. Static rendition.

- Scrim `rgba(0,0,0,.4)`, z-index 10002. Panel is min(92vw, 26rem), `bg-primary`, `radius-xl`, `shadow-lg`, padding 1.25rem 1.5rem. Title is 1.1rem.
- No close button: a right-aligned **Done** button (`bg-tertiary`) and Escape dismiss it. Focus is trapped.
- **Drift:** this is the only dialog closed by a footer button. It's the only good reuse of another dialog's classes, which is a hint the shared pattern already wants to exist.
- **Target:** Modal size sm, footer with one secondary action ("Done").
