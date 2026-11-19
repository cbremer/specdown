# Toast

Toast: the only transient notification. It replaces `alert()`, which the native shells ignore.

**Source:** `.toast`, `.toast-region` ("Toast Notifications"). Static rendition.

- A dark chip in both themes (`toast-surface`, white text, 12.8:1), with `radius-lg`, `shadow-lg` and a 4px status edge in `color-success`, `color-info`, `color-warning` or `color-danger`.
- Stacked at the bottom centre, 2rem up, max width min(90vw, 32rem), at z-index 10030, above every dialog and overlay so a toast is never hidden by an open modal. Fades in over 0.2s. Click to dismiss.
- **Action toast:** message plus one translucent button ("Undo", "Reload").
- **The consumer provides:** a short message that says what happened, plus a status. Status colour never carries meaning alone.
