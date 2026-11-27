# MarkdownDocument

Rendered Markdown document: the hero surface every platform shares.

**Source:** `.markdown-content` ("Markdown Styling"). Static rendition.

- The pane is `bg-primary` with 2rem padding. Body is `doc-body` (1rem/1.6), headings `doc-h1`–`doc-h6`.
- h1 gets a 2px `border-color` underline, h2 a 1px one. Links are `accent-color`, underlined on hover.
- Lists indent 2em. Blockquotes get a 4px `accent-color` rule and `text-secondary`. Tables use 1px `border-color` cells, `bg-secondary` headers, and scroll inside themselves.
- Inline code: `bg-tertiary`, 3px radius, 0.9em. The source uses 'Courier New' here rather than `mono` (drift).
- **Never print this live layout.** Print and PDF render `buildPrintableDocument()` instead.

Read Aloud highlights the active sentence with `accent-color` and `text-on-accent`. Older browsers underline the same range. Code and diagram announcements outline their source block. During playback a compact strip between the header and document provides pause, stop and reading speed. A block announcement adds Skip block. Opening Explain moves the strip into the rail. Listening to an explanation saves the current document sentence and offers Resume document when the explanation ends.
