# Citation

**Implementation** (ZIL-257, 265, 266). Links from an answer back to the source passage, code line or diagram step.

**CSS:** `.sd-cite`, `.sd-sources`, `.sd-source*`, `.citation-reveal` in `components/bundle.css`.

- **Inline pill** (`.sd-cite`): a number on `accent-tint` in `accent-color` text, `ui-chip` type. Blue because it acts. The current or hovered pill fills with `accent-color` and `text-on-accent`. `aria-label="Source 1: Retry policy, paragraph 1"`.
- **Sources list** (`.sd-sources`), opened from the "Sources · n" turn action: one `.sd-source` card per citation with a label ("1 · Retry policy, ¶1") and a one-line quote.
- **Reveal:** activating either scrolls the document to the exact occurrence and adds `.citation-reveal`, a 2px `accent-color` outline with a 1.2s `accent-tint` fade (static outline under reduced motion). Keep the outline until the next reveal or the rail closes.
- **Diagram steps:** reveal the step in the rendered diagram. If visual mapping isn't available, open Raw at the exact source span.
- **Compact:** revealing closes the rail to show the document and adds a floating "‹ Back to answer" pill (`accent-color`, `radius-pill`, 44px) above the action bar. It returns to the thread at the same scroll position.
- **Invalid reference:** don't render the pill. If an answer loses all its citations, show "This answer couldn't be matched to the document." and hide Listen.
