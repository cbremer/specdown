# OverflowMenu

Overflow menu: the "⋮" dropdown that holds long-tail toolbar actions and the header's More menu.

**Source:** `.overflow-menu`, `.overflow-menu-item` ("Toolbar Overflow Menu"). Static rendition.

- Panel on `bg-primary`, 1px `border-color`, `radius-lg`, `shadow-lg`, inner padding `space-1`, min-width 12rem. Anchored 0.4rem below its toggle, right-aligned.
- Items are full-width text buttons with padding 0.55rem 0.75rem and `radius-md`. Hover fills with `accent-color` / `text-on-accent`.
- **The consumer provides:** the items, with labels in sentence case and an ellipsis when a further step follows.
