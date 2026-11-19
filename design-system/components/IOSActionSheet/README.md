# IOSActionSheet

iOS sheet: the bottom sheet behind the iPhone action bar's More, Contents and Open buttons.

**Source:** `.ios-sheet*` in `styles.css`, markup in `index.html`. Static rendition.

- Scrim **.28** (lighter than any other), z-index 950, bottom-aligned with safe-area padding.
- Panel min(100%, 540px), max-height capped to the visible area, **20px radius** (no token), `shadow-lg`.
- The header has a hairline, a title at 1rem/**700**, and a **34px pill close on `bg-secondary`**, the most touch-friendly close in the app.
- Actions are full-width rows at least 48px tall, `radius-xl`, on `bg-secondary`. Active rows use an accent border and text.
- Only the Open sheet sets `role="dialog"` / `aria-modal`. The Contents and Viewer Actions sheets don't.
- **Target:** the **Sheet** variant, used by every dialog at phone width.
