# AnnotationPanel

Annotations panel: a list of every note in the document, with jump, edit and delete actions.

**Source:** `.annotation-panel*`, `.annotation-list-*`. Static rendition.

- **A docked side panel, not a modal:** 280px on `bg-secondary` with a left hairline. Below 700px it becomes a right-hand overlay up to 360px wide, z-index 600, with `shadow-lg` and no scrim.
- Header: uppercase 0.75rem/600, +0.06em tracking, in `text-secondary`, with a small ✕ close.
- **Target:** the **Drawer** variant of the shared pattern. Same header anatomy, docked on wide screens and overlaid on narrow ones.
