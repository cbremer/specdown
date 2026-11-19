# CodeBlock

Fenced code block: always dark, in both app themes, with a hover copy button.

**Source:** `.markdown-content pre`, `.code-copy-btn`. Static rendition.

- `code-surface` ground, 1px `code-border`, `radius-md`, 1em padding. Text is `code-text` (16:1), with highlight.js github-dark token colours.
- The copy button sits top-right and is hidden until hover or focus. It's `ui-chip` size on 8% white, and turns `color-success` with the label "Copied" on success.
