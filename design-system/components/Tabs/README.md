# Tabs

Tab bar: one tab per open document, with live-reload dots and a close button.

**Source:** `.tab-bar`, `.tab`, `.tab-active`, `.tab-watching-dot` ("Tab Bar"). Static rendition.

- The bar sits on `bg-secondary` with a bottom `border-color` hairline and scrolls horizontally with a 3px scrollbar.
- Inactive tabs: `bg-tertiary`, `text-secondary`, `ui-tab` (0.85rem), max-width 180px with an ellipsis.
- **Active tab:** `bg-primary`, `text-primary`, weight 500, and a 2px `accent-color` top rule. This is the only place the accent marks location.
- Dots: `status-live` while watching a file, `status-changed` (pulsing) when a background file changed on disk.
- Close hover turns red (hard-coded `#e74c3c`, see Evolving).
