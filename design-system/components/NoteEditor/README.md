# NoteEditor

Annotation note editor: write or edit the note attached to a highlighted passage.

**Source:** `src/features/annotations.js`, `.annotation-editor*`. Static rendition.

- Scrim .4, **z-index 1000**, panel min(440px, 100%) at **`radius-lg`** (every other dialog is `radius-xl`), padding 1rem.
- Footer: Delete (`color-danger` text) · spacer · Cancel · Save. **Save is the only accent-filled primary button in any dialog.**
- Save uses `text-on-accent`: navy on the light dark-theme accent (8.3:1), white in light theme. It used to force white, which measured 2.1:1 in dark theme (fixed, ZIL-219).
- It declares `role="dialog"` and `aria-modal` and traps focus while open, returning focus to the opener on close.
- **Target:** Modal size sm with the standard footer.
