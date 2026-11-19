# RecentFilesDialog

Recent files dialog: reopen a previously opened document from the web or desktop empty state.

**Source:** `src/features/recent-files.js`, `.recent-files-*`. Static rendition.

- Scrim .4 with safe-area padding. **z-index 10020**, the highest dialog layer (shared with Bookmarks). Toasts sit above it at 10030.
- Panel min(34rem, 100%), `radius-xl`, padding 1.25rem (not 1.25rem 1.5rem like its siblings), gap 1rem. Title is an **h2 at 1.2rem** (siblings use 1.1rem).
- Its header has a quiet text "Clear history" button. The close is a reused `.sample-button` from the landing page.
- **Target:** Modal size md. The list goes in the body; "Clear history" is a destructive text action on the footer's left.
