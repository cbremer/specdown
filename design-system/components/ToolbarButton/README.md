# ToolbarButton

Toolbar action button: the one button shape in SpecDown's content header (Contents, Split, Comments, Annotate, Print, Present, Raw).

**Source:** `.toc-toggle-button`, `.view-toggle-button` and siblings in `markdown-viewer/styles.css`, "Toolbar Action Buttons (shared)". Static rendition.

- **Rest:** `bg-tertiary` fill, 1px `border-color`, `text-primary`, `radius-md`, padding 0.5rem 1rem, `ui-label` (0.9rem). Optional 16px icon, gap 0.4rem.
- **Hover and active (toggled on):** fill and border `accent-color`, text `text-on-accent`. They look the same by design, so an active toggle reads as "held down".
- **Icon-only variants** (`.search-toggle-button`, `.overflow-toggle-button`) use padding 0.4rem 0.6rem and line-height 1.
- **The consumer provides:** an `aria-label` when icon-only, and `.active` for toggled state. Long-tail actions go in the overflow menu (`.overflow-only`).
- **iPhone:** the toolbar is hidden. Mirror every action in the iOS action bar or sheet.
