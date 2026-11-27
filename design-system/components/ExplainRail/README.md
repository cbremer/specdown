# ExplainRail

**Implementation** (ZIL-255, 257, 265, 266). The Explain tab of the SideRail: a scoped, cited explanation with follow-ups.

**CSS:** `.sd-scope*`, `.sd-thread*`, `.sd-turn-*`, `.sd-composer*`, `.scope-mark` in `components/bundle.css`. Citations: see Citation.

## Anatomy, top to bottom

1. **Scope** (`.sd-scope`): a picker button, "**Selection ·** Retry policy" (the kind in `text-secondary`), and a one-line preview of the scope text. The picker lists Selection (if there was one), the containing Section, any Code block or Diagram, and Whole document.
2. **Thread** (`.sd-thread`, scrolls): answers as plain text on the rail ground, with no bubble. Questions are right-aligned `bg-tertiary` blocks at `radius-lg`. Under each answer, turn actions: Listen, Copy, Sources · n (`.sd-turn-action`).
3. **Composer** (`.sd-composer`), anchored at the bottom: a labelled field "Ask a follow-up…", a 30px `accent-color` send button (44px on touch), and a disclosure line under it.

## Rules

- **Scope in the document:** while the rail is open, wrap the scope in `.scope-mark` (`accent-tint`). Remove it on close.
- **Widen one step at a time.** When the scope can't answer, say so plainly, then offer secondary buttons in this order: "Use section: <name>", then "Use whole document". Never widen automatically.
- **A new scope means a new thread.** Insert `.sd-thread-divider` "New thread · Section" and cancel pending work.
- **Pending:** "Writing an answer…" with a Stop text button in `accent-color`. No typing dots.
- **Stale:** if the document revision changes mid-request, discard the answer and show a `color-warning` dot beside "The document changed while this answer was being written, so it was discarded." Offer "Ask again" as primary.
- **Unavailable model:** replace thread and composer with a title, "Explanations aren't available here", plus one sentence on why: "They run on this device and need Apple Intelligence, which is off or not supported. Nothing leaves your Mac, and your document is unchanged." Then list the actions that still work (Read selection aloud, Walk through a diagram) and add a settings link if the platform has one.
- **Diagram scope:** the walkthrough renders as numbered steps: "API → Worker · Cancel job". Branch labels go in `brand-coral-text` ("Otherwise, the worker times out"), and the active step uses `accent-tint`. It works without a model; the composer appears only when one is available.
- **Disclosure** (always, under the composer): "Generated on this <device> from the scope above. Check the sources."
- **Screen readers:** announce each finished answer once through a polite live region. Focus stays in the composer after sending.
- **Copy:** no "AI", sparkle icon, avatar or exclamation marks. Address the reader as "you".
