# MarkdownDocument

Rendered Markdown document: the hero surface every platform shares.

**Source:** `.markdown-content` ("Markdown Styling"). Static rendition.

- The pane is `bg-primary` with 2rem padding. Body is `doc-body` (1rem/1.6), headings `doc-h1`–`doc-h6`.
- h1 gets a 2px `border-color` underline, h2 a 1px one. Links are `accent-color`, underlined on hover.
- Lists indent 2em. Blockquotes get a 4px `accent-color` rule and `text-secondary`. Tables use 1px `border-color` cells, `bg-secondary` headers, and scroll inside themselves.
- Inline code: `bg-tertiary`, 3px radius, 0.9em. The source uses 'Courier New' here rather than `mono` (drift).
- **Never print this live layout.** Print and PDF render `buildPrintableDocument()` instead.

Read Aloud highlights the spoken sentence with the teal `read-aloud-sentence` fill and a `brand-teal-text` underline. The floating [Read Aloud transport](../ReadAloudTransport/README.md) follows the document pane. On compact screens, opening the [Side Rail](../SideRail/README.md) replaces the transport with its playback chip.
