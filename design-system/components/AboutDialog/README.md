# AboutDialog

About dialog: app name, version, update status and links. It opens from the header ⋮ menu.

**Source:** `src/features/about.js`. It reuses `.shortcuts-overlay` / `.shortcuts-sheet` with `.about-sheet`. Static rendition.

- Scrim `rgba(0,0,0,.4)`, z-index 10002. Panel is min(92vw, 26rem), `bg-primary`, `radius-xl`, `shadow-lg`, padding 1.25rem 1.5rem. Title is 1.1rem.
- No close button: a right-aligned **Done** button (`bg-tertiary`) and Escape dismiss it. Focus is trapped.

**Now uses the shared Modal** (Dialog, size sm): standard header with a close button, scrolling body, footer. Built with `createSdModal` in `src/core/modal.js`. The values above describe the previous one-off styling.
