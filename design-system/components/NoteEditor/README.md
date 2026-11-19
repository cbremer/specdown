# NoteEditor

Annotation note editor: write or edit the note attached to a highlighted passage.

**Source:** `src/features/annotations.js`, `.annotation-editor*`. Static rendition.

- Scrim .4, **z-index 1000**, panel min(440px, 100%) at **`radius-lg`** (every other dialog is `radius-xl`), padding 1rem.
- Footer: Delete (`color-danger` text) · spacer · Cancel · Save. **Save is the only accent-filled primary button in any dialog.**
- **Bug:** Save forces `color: white !important`. In dark theme that's white on `#7ab8f5`, **2.1:1**. Use `text-on-accent`.
- It declares `role="dialog"` and `aria-modal` but doesn't trap focus.
- **Target:** Modal size sm, the standard footer, a primary button using `text-on-accent`, and a focus trap.
