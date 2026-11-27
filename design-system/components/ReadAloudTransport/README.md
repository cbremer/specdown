# ReadAloudTransport

**Implementation** (ZIL-253, 255, 256, 262). The playback bar for document narration and answer playback. It exists only during a reading session.

**CSS:** `.sd-transport*` and `.read-aloud-sentence` in `components/bundle.css`.

## Placement

- It floats centred at the bottom of the **document pane** at `z-transport`: `bg-primary`, 1px `border-color`, `radius-xl`, `shadow-lg`. **Never in the content header.** The idle toolbar keeps its layout.
- On iPhone it spans the width above the action bar, with buttons at 44px minimum.
- On compact screens, while the SideRail is open, it's hidden and replaced by the rail's playback chip (see SideRail).

## Anatomy

Left to right: Pause/Resume (primary, `accent-color`), Stop, divider, a label (title + meta), then the rate pill.

| State             | Title                    | Meta                            | Extra                         |
| ----------------- | ------------------------ | ------------------------------- | ----------------------------- |
| Reading document  | "Reading · <section>"   | "Sentence 2 of 14"              | rate                          |
| Code or diagram   | "<section>"             | "Next: code block"              | **Skip** pill                 |
| Answer playback   | "Answer · Listening"     | "Document paused at sentence 2" | **Resume document** pill      |
| Walkthrough       | "Walkthrough · <diagram>" | "Step 5 of 6"                 | rate                          |
| No voice          | toast, not the bar: "Read aloud needs a voice. Add one in System Settings → Accessibility → Spoken Content." | | |

- Rate pill cycles 0.75×, 1×, 1.25×, 1.5×, 2×, or opens a small menu on long press or right-click.
- Shortcuts: ⌥⌘R starts or toggles (Ctrl+Alt+R on Windows and Linux). Escape while focus is in the bar stops playback.

## The spoken sentence

- Wrap only the active sentence in `.read-aloud-sentence`: a `read-aloud-sentence` fill with a 2px `brand-teal-text` underline.
- Don't use `search-highlight` (a match) or `accent` (act on this). Teal already means reading progress in C+.
- The brand bar fills with narration progress the same way it does with scroll.
- Auto-scroll keeps the sentence in the middle third of the pane. Pause auto-scroll for 4s after the reader scrolls manually.
- Switching tabs, editing or re-rendering stops playback and removes the mark.
