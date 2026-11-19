# FileInfoSheet

File info sheet: path, size, dates and word count for the open document, with a Copy action.

**Source:** `src/features/file-info.js`, `.file-info-*`. Static rendition.

- Scrim .4, z 10002, panel min(92vw, 32rem), max-height 85vh with an internal scroll, `radius-xl`, padding 1.25rem 1.5rem. Title is 1.1rem.
- Rows use a 6.5rem label column. Paths use `.file-info-mono`.
- **Target:** Modal size md, footer with a secondary "Copy" button and the standard close.
