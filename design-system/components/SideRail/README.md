# SideRail

**Implementation** (ZIL-255, 258). One right-hand rail that hosts **Explain** and **Notes** as tabs. Replaces the standalone Notes panel (`.annotation-panel`). Built on the Modal system's Drawer variant.

**CSS:** `.sd-rail*` in the reader components at the end of `components/bundle.css`.

## Anatomy

1. **Resize handle** (`.sd-rail-resize`): 6px hit area on the leading edge. Hover or focus shows a 6px `accent-color` line.
2. **Header** (`.sd-rail-header`): tabs, an optional playback chip (compact only), then the 34px close pill. A hairline below.
3. **Tabs** (`.sd-rail-tab`): "Explain" and "Notes", 1rem/600. The selected tab uses `accent-tint` with `accent-color` text, like other C+ active toggles. Notes carries a count pill.
4. **Body:** the selected tab's content. Only the body scrolls.

## Size

- Default `rail-width` 360px. Drag between `rail-width-min` 320px and `rail-width-max` 480px.
- Persist the width per device under `specdown.railWidth`. Double-clicking the handle restores 360px.
- The handle is a `role="separator"` with `aria-orientation="vertical"`, `aria-valuemin`, `aria-valuemax` and `aria-valuenow`. Left/Right move it 16px; Home/End jump to min/max.
- The document pane shrinks; it never goes under ~480px. If it would, cap the rail.
- **Under 700px** (iPhone, narrow iPad Split View, small windows): the rail fills the window from the trailing edge at `z-rail`. No resize handle.

## Behaviour

- More → Explain… (⌥⌘E) opens the rail on Explain. The toolbar's Notes toggle opens it on Notes. Both toggles show the active state while their tab is visible.
- Switching tabs keeps each tab's state (thread, scroll position, draft text).
- Tabs follow the ARIA tabs pattern: `role="tablist"`, arrow keys move between tabs, and each panel is `role="tabpanel"`.
- Escape or the close pill closes the rail and restores focus to the opener, plus the reading position and selection.
- It's a side panel, not a modal: no scrim, no focus trap on wide screens. Under 700px it traps focus like a Sheet.
- Open and close slide 200ms from the trailing edge. Reduced motion: no slide.

## Compact playback chip

Under 700px the rail covers the document, so the Read aloud transport is hidden while the rail is open. The header shows `.sd-rail-playback-chip` instead:

- While playing: a pause icon and "Reading". Tap to pause.
- While paused: a play icon and "Paused". Tap to resume.
- After listening to an answer: "Resume document", which resumes at the saved sentence.
- Closing the rail brings the transport back in the same state.
