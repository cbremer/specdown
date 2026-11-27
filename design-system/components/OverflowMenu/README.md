# OverflowMenu

Overflow menu: the "⋮" dropdown that holds long-tail toolbar actions and the header's More menu.

**Source:** `.overflow-menu`, `.overflow-menu-item` ("Toolbar Overflow Menu"). Static rendition.

- Panel on `bg-primary`, 1px `border-color`, `radius-lg`, `shadow-lg`, inner padding `space-1`, min-width 12rem. Anchored 0.4rem below its toggle, right-aligned.
- Items are full-width text buttons with padding 0.55rem 0.75rem and `radius-md`. Hover fills with `accent-color` / `text-on-accent`.
- **The consumer provides:** the items, with labels in sentence case and an ellipsis when a further step follows.

## Reading group (ZIL-255)

Add a reading group above the existing items, then `.overflow-menu-separator`:

1. "Read selection" when there's a nonempty selection, otherwise "Read from here". Shortcut ⌥⌘R (Ctrl+Alt+R).
2. "Explain…", shortcut ⌥⌘E (Ctrl+Alt+E). Always listed. Without a local model it opens the Explain tab in its unavailable state.

Shortcut hints sit right-aligned in `.overflow-menu-shortcut` (0.8rem, `text-secondary`, inherits on hover). Capture the selection and reading position **before** the menu takes focus. Native menus use Title Case: "Read Selection", "Read from Here", "Explain…". On iPhone the same two rows lead the More sheet, followed by a hairline.
