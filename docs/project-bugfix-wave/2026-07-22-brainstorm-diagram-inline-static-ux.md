# Brainstorm: Inline Mermaid Diagrams Should Read Like Document Content

**Date:** 2026-07-22
**Trigger:** User feedback — SpecDown documents with diagrams are harder to read
than the same markdown in VS Code's preview, where diagrams render "normally"
with only minimal zoom controls. "Maybe there needs to be a control that's
invoked, otherwise they look normal."

## Problem

Every mermaid diagram rendered as a heavy interactive widget:

1. **Fixed 500px-tall card** (`.diagram-wrapper { height: 500px }`). A tiny
   3-node flowchart floated in mostly-empty space; a large sequence diagram was
   shrunk until its text was illegible. Diagram size had no relationship to
   diagram content.
2. **Always-visible 8-control toolbar** (zoom ±, % readout, slider, reset, SVG,
   PNG, share, fullscreen) floating over every diagram — heavy chrome competing
   with the document, multiplied by every diagram on the page.
3. **Always-armed panzoom.** Mouse-wheeling past a diagram hijacked page scroll
   into a zoom; touch scrolls could become accidental pans (the classic
   embedded-Google-Maps problem).

Net effect: documents read like control panels, not documents.

## Options considered

- **A. Static-by-default, explore-on-demand** — diagrams render as plain
  content; one subtle affordance opens the existing fullscreen overlay where
  all interactivity lives.
- **B. Click-to-activate in place** (Google Maps embed pattern) — static until
  clicked, then panzoom arms inline. Keeps document context but retains most of
  the inline machinery and adds a per-diagram modal state.
- **C. Conservative cleanup** — keep inline interactivity; content-based
  height, hover-reveal slimmed toolbar, Ctrl+wheel to zoom. Least change, but
  diagrams stay widgets.
- **D. Size-aware hybrid** — small diagrams get zero chrome; only diagrams that
  had to be scaled down get a discoverable explore affordance.
- **E. Global "diagram interactivity" setting** — rejected as primary fix
  (settings are where UX debt hides); could be a later escape hatch.

## Decision: A + D

Inline diagrams are **static document content**: natural size (intrinsic pixel
size from the SVG viewBox), capped at the column width and 70vh by CSS, no
toolbar, no panzoom, wheel scrolls the page. All interactive machinery —
zoom/pan, slider, reset, minimap, SVG/PNG export, share, keyboard shortcuts —
lives in the **existing fullscreen overlay**, opened by a single expand button.

Size-aware discoverability:

- Diagrams that fit at natural size: expand button revealed on hover /
  keyboard focus only. Zero chrome while reading.
- Diagrams scaled down by the caps (`diagram-scaled` class, recomputed on
  resize): expand button always visible, `zoom-in` cursor, and
  **click-anywhere opens fullscreen** — a scaled diagram is by definition not
  fully readable, so the click matches intent.
- Touch devices (`pointer: coarse`): button always visible and tap-anywhere
  opens fullscreen (hover doesn't exist; aligns with the mobile
  fullscreen-first recommendation in
  [`../2026-05-25-mermaid-navigation-recommendations.md`](../2026-05-25-mermaid-navigation-recommendations.md)).

Click-anywhere is deliberately **not** universal on desktop: small diagrams are
fully readable inline, and a universal click would steal text selection inside
`foreignObject` labels and punish casual clicks.

## Consequences

- Inline panzoom, the inline toolbar, per-diagram wheel/dblclick handlers, and
  `state.currentPanzoomInstances` (plus its cleanup plumbing through main.js,
  tabs.js, view-mode.js) are deleted.
- The fullscreen overlay gains the previously inline-only **share** button.
- The print path is nearly untouched (it already re-renders from
  `data-mermaid-source` and neutralizes sizing); only the chrome-strip selector
  changed to `.diagram-expand`.
- The two earlier bugfix sessions in this folder (controls overlapping the
  diagram on phones; double-tap zoom on control buttons) are largely obsoleted
  by removing the inline controls — the `touch-action: manipulation` guard
  carries over to the expand button.

Implementation checklist:
[`2026-07-22-tasks-session-05-diagram-inline-static-ux.md`](2026-07-22-tasks-session-05-diagram-inline-static-ux.md)
