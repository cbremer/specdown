# WatchChip

Live-reload chip: shows whether the open file is being watched for changes on disk. The whole chip is the pause/resume toggle.

**Source:** `.watch-chip` (desktop only). Static rendition.

- A pill (`radius-pill`) on `bg-tertiary` with a `border-color` outline, in `ui-chip` (0.72rem/600, +0.02em).
- **Live:** `text-primary` with a `status-live` dot. **Paused:** `text-secondary` with a faded grey dot. **Updated:** flashes `accent-color` for about 1.1s when a change lands.
- Always pair the dot with the word. The colour alone isn't enough.
