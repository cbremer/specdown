# App Review notes (draft)

Paste into App Store Connect → App Review Information → Notes. No sign-in is required.

---

SpecDown is a viewer for Markdown (.md) documents that renders text, tables, code and
Mermaid diagrams. There is no account, login, purchase or server component.

How to review in under a minute:

1. Launch the app. On iPad, the sidebar shows "Open Sample" and "Open Diagram
   Showcase"; on iPhone, the same buttons are on the start screen.
2. Tap "Open Diagram Showcase". It renders a bundled document containing every major
   Mermaid diagram type (flowchart, sequence, state, Gantt, and more).
3. Tap the expand icon on any diagram to open it fullscreen; pinch to zoom and pan.
4. Use "Contents" to jump between sections and "Raw" to view the Markdown source.
   "Open Sample" includes HTML comments shown as tinted notes; More → "Hide
   HTML Comments (2)" hides them and the item then reads "Show HTML Comments (2)".
5. To open your own file: tap "Open" and pick any .md file from Files/iCloud Drive,
   or use "Open With… SpecDown" / the share sheet from another app.

Network use: the app only goes online when the user opens a web/GitHub link or a
document that references remote images. It contains no analytics, ads or tracking.

App Transport Security: the app's own viewer is bundled and loaded locally.
NSAllowsArbitraryLoadsInWebContent is set only so Markdown documents the user
opens can display images hosted on plain-HTTP servers. Tapped links open in
Safari, not inside the app.
