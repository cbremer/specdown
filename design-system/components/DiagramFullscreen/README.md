# DiagramFullscreen

Diagram fullscreen: a Mermaid diagram expanded to fill the window, with zoom, export and a minimap.

**Source:** `.fullscreen-*`, `index.html`. Static rendition. (Presentation mode is similar: a full `bg-primary` surface at z 10002.)

- **A full-surface viewer, not a modal:** `bg-secondary` with a 10px backdrop blur, z-index 1000. Escape exits.
- The controls bar holds + / − / a zoom slider and % / reset / SVG / PNG / close. The minimap sits bottom-right on `bg-primary` with `shadow-md`, and its viewport rectangle uses an old accent `rgba(74,144,226,.1)`.
- iOS hides SVG/PNG export.
- **Target:** keep it as its own pattern. Align the control buttons with the ToolbarButton spec and move it to the shared overlay layer.
