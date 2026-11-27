# Read Aloud and Explain: UX decisions for implementation

27 Nov 2026. Owner decisions for ZIL-253 to 266. Read this before starting UI work in the Read Aloud and Document Explanations project. Then read `design-system/README.md` → "Read aloud and Explain", and the component specs it links.

## Decisions

| # | Decision | Where it's specified |
| - | -------- | ------------------- |
| 1 | Explain and Notes share **one right-hand rail with tabs** (Explain · Notes). The standalone `.annotation-panel` migrates into it. | `design-system/components/SideRail/README.md` |
| 2 | The rail is **resizable 320–480px**, default 360px, and remembers its width per device (`specdown.railWidth`). Full width and not resizable under 700px. | SideRail, `tokens.json` → `size` |
| 3 | Shortcuts: **⌥⌘R** Read selection / Read from here, **⌥⌘E** Explain…. **Ctrl+Alt+R / Ctrl+Alt+E** on Windows and Linux. Add both to the Shortcuts sheet and native menus. | `components/OverflowMenu/README.md` |
| 4 | On compact screens, **hide the transport while the rail is open**. The rail header shows a playback chip (Reading / Paused / Resume document). | SideRail → Compact playback chip |
| 5 | The playback transport floats at the bottom of the document pane and never enters the content header. | `components/ReadAloudTransport/README.md` |
| 6 | The spoken sentence uses the new `read-aloud-sentence` token (teal), not search yellow or accent blue. | ReadAloudTransport, `tokens.json` |
| 7 | Citations are accent pills plus a Sources list. Revealing one adds `.citation-reveal`. On compact screens, a "Back to answer" pill returns to the thread. | `components/Citation/README.md` |
| 8 | Scope widens one step at a time: Section, then Whole document, always explicit. A new scope starts a new thread, marked by a divider. | `components/ExplainRail/README.md` |
| 9 | The explained scope stays marked in the document (`.scope-mark`) while the rail is open. | ExplainRail |
| 10 | No AI chrome in copy or visuals. A disclosure line sits under the composer. | ExplainRail → Rules |

## Ticket mapping

- **ZIL-253** narration controller: ReadAloudTransport → "The spoken sentence"; stop and clear the mark on tab switch, edit or re-render.
- **ZIL-254** walkthrough: ExplainRail → "Diagram scope"; Citation → "Diagram steps".
- **ZIL-255** More menu and rail: OverflowMenu → "Proposed: reading group"; SideRail; ReadAloudTransport → Placement.
- **ZIL-256 / 262 / 263** speech adapters: the ReadAloudTransport state table, including the no-voice toast.
- **ZIL-257** on-device explanations: ExplainRail → pending, stale and unavailable states; Citation → invalid reference.
- **ZIL-258** iPhone and iPad: SideRail under 700px, the compact playback chip, Citation → Compact, 44px touch targets.
- **ZIL-265** scope and citations: ExplainRail → Scope, `.scope-mark`; Citation → Reveal.
- **ZIL-266** follow-ups: ExplainRail → Composer, widening, new-thread divider, live region.

## Implementation notes

- The CSS lives in the "Proposed: Read aloud and Explain" block at the end of `design-system/components/bundle.css`. Port it into `markdown-viewer/styles.css` (C+ section conventions), then refresh the bundle copy as `design-system/README.md` describes.
- Use tokens only. The new ones are `read-aloud-sentence`, `scope-mark`, `rail-width`, `rail-width-min`, `rail-width-max`, `touch-target`, `z-menu`, `z-transport`, `z-rail` and `z-toast`.
- Animate only colour, background, border, shadow, opacity and transform: 200ms for surfaces, 120ms for hover. `prefers-reduced-motion` removes the rail slide and the citation flash.
- Visual reference: the "Read Aloud and Explain Review" board from the design review (desktop 1a–1c, rail states 2a–2c, iPhone 3a–3d). Where it differs from this file, this file wins: the board predates decisions 1–4.
