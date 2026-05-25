# Mermaid navigation recommendations (web + mobile)

## Current state (already in SpecDown)

- Inline and fullscreen Mermaid diagrams already support pan/zoom via Panzoom.
- Users can zoom with `+/-` buttons, wheel zoom, double-click reset, and fullscreen mode.
- Fullscreen includes a minimap and reset/download/share controls.

## Priority UX changes to improve readability for large org charts

### 1) Add **explicit zoom percentage + slider** (web + mobile)

- Show current zoom (e.g. `145%`) in both inline and fullscreen control bars.
- Add a slider (`25%` → `400%`) so users can jump quickly to a readable level.
- Keep `Reset` as a one-tap return to fit.

Why: users can orient better when they know zoom level and can make predictable jumps.

### 2) Add **tap-friendly control sizing and spacing** (mobile first)

- Increase control button tap targets to at least 44x44 px.
- Separate destructive/exit actions (close fullscreen) from zoom controls.
- Keep controls pinned and avoid overlap with diagram content.

Why: current controls are small for dense diagrams on phones and tablets.

### 3) Add **touch gestures in fullscreen**

- Support pinch-to-zoom and one-finger pan as first-class mobile gestures.
- Add optional two-finger pan mode toggle for accessibility (prevents accidental drags).
- Add inertial panning for smoother navigation.

Why: mobile users expect map-like interaction for very large diagrams.

### 4) Add **"Focus mode" for text legibility**

- Add a preset action: `Fit Width`, `Fit Height`, `Readable Text`.
- `Readable Text` auto-zooms until the median node label reaches a target pixel height.
- Persist last selected preset per session.

Why: org chart pain is usually text size, not only geometry size.

### 5) Improve fullscreen discoverability and onboarding

- Add first-use tooltip: "Pinch or scroll to zoom, drag to pan, double-tap to reset".
- Add a visible fullscreen hint on each Mermaid card for first-run.
- Add keyboard hints on desktop (`+`, `-`, `0`, arrows).

Why: features exist today but users may not discover them quickly.

### 6) Add **mini-map interactions**

- Let users drag the minimap viewport rectangle to pan the main diagram.
- Make minimap optional/collapsible on small screens.

Why: minimap is most useful when it is interactive, especially for huge org graphs.

### 7) Add **search within diagram labels**

- Parse visible text from SVG nodes.
- Add search box in fullscreen (`Find person/team`).
- Jump + highlight matched nodes; keep "next/previous match".

Why: navigation by panning alone is slow in deep org structures.

### 8) Add **node emphasis / dimming**

- Tap/click node to focus path (ancestors + descendants highlighted, others dimmed).
- Optional depth slider to limit visible hierarchy levels.

Why: users can "strengthen" (visually emphasize) relevant parts without redrawing diagram source.

## Web-specific recommendations

1. Add keyboard navigation in fullscreen:
   - `+` / `-` zoom
   - `0` reset to fit
   - Arrow keys pan
   - `F` toggle fullscreen, `Esc` close
2. Add right-click context actions on node labels (copy text, center here).
3. Remember per-diagram viewport state during session when switching tabs.

## Mobile-specific recommendations

1. Open Mermaid diagrams directly into fullscreen on phones by default.
2. Use bottom-sheet controls to keep top area clear for content.
3. Add haptic feedback on reset and zoom step actions where available.
4. Use larger default zoom on initial open for diagrams wider than viewport.

## Technical implementation order

1. **Phase 1 (quick win):** control size, zoom percent, slider, onboarding hints.
2. **Phase 2:** minimap drag, mobile fullscreen-first behavior, keyboard shortcuts.
3. **Phase 3:** diagram label search + node emphasis/path highlighting.

## Success metrics

- Time-to-readable-text (first 10 seconds).
- Number of zoom/pan interactions before user dwell on a target area.
- Fullscreen usage rate and return rate.
- Mobile completion rate for "find target role" task in sample org chart.
