# Spec: C+ brand moments

Decision: ZIL-226 (C+ chosen 19 Nov 2026). Implementation: ZIL-235. Review: ZIL-236. Promotion: ZIL-237.
Mockups: the "SpecDown design directions" canvas (C in rows 1–2, C+ in row 3).

## Goal

SpecDown's identity, the logo's teal→coral, shows up in the app where it has a job, without changing how interaction works. **Blue stays the only interaction colour** (links, focus, active controls). Brand colour never carries text that has to be read, except where it measures 4.5:1.

## What ships

| #   | Moment                     | Behaviour                                                                                                                                                                                                                        | Where                          |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | **Brand bar**              | 3px teal→coral bar across the top of the app. In a document it fills as you scroll (reading progress); on the empty state it's full.                                                                                             | All surfaces                   |
| 2   | **Active tab**             | The active tab's top rule is the gradient instead of solid blue.                                                                                                                                                                 | Desktop, web, iPad             |
| 3   | **Title signature**        | The document's first `h1` gets a short (48px) gradient underline instead of the full-width hairline.                                                                                                                             | All                            |
| 4   | **Read sections**          | Contents links for sections scrolled past show a teal tick.                                                                                                                                                                      | Contents sidebar and iOS sheet |
| 5   | **Quieter toolbar**        | Toolbar buttons are flat until hovered. Active toggles get a blue tint (`accent-tint`) with blue text instead of a solid blue fill. Same for the active Contents link.                                                           | Desktop, web, iPad             |
| 6   | **Drop moment**            | While a file is dragged over the drop card, its border becomes the gradient with a soft teal/coral glow.                                                                                                                         | Desktop, web                   |
| 7   | **About**                  | Brand strip across the top of the dialog, and the app icon above the tagline.                                                                                                                                                    | All                            |
| 8   | **SpecDown diagram style** | Teal shapes and edges, coral secondary fill, on **bundled sample diagrams only**. A diagram opts in with the Mermaid comment line `%% specdown:brand`. Users' own Markdown is never restyled, because it doesn't carry the line. | All                            |

### Not in scope

- Restyling users' Mermaid diagrams, callouts or any document content beyond the title signature.
- Changing the accent colour (that was direction B).
- iPhone toolbar (hidden there; the iOS action bar is unchanged).

## Gate: Dev builds only

C+ is a **preview**. It turns on when either is true:

- `window.specdownAppChannel === 'development'`. iOS/iPadOS Dev and Mac App Store Dev already set this. Direct Mac Dev gets it in this change: `desktop/main.js` passes `--specdown-app-channel` when the packaged `specdownChannel` is `development` or `beta`, and the preload exposes the channel (only the channel) for the direct build too.
- The page is served by the local Vite dev server (`npm run dev`), via the build-time define `__SPECDOWN_DEV_SERVER__`.

When on, `core/brand-preview.js` sets `data-brand-preview="cplus"` on `<html>`. Every C+ rule in `styles.css` is scoped under `html[data-brand-preview]`, so Beta, Prod and the production web build render exactly as before. The few JavaScript additions (brand bar, About icon, diagram directive, read-tick classes) are also no-ops unless the gate is on, apart from the inert `toc-link-read` class.

## Tokens (preview)

| Token              | Light     | Dark      | Use                                                                                   |
| ------------------ | --------- | --------- | ------------------------------------------------------------------------------------- |
| `accent-tint`      | `#e4edf6` | `#29333d` | Active toggle and Contents fill; `accent-color` text on it is 4.6:1 light, 6.1:1 dark |
| `brand-teal-text`  | `#007a90` | `#00a3bf` | Teal marks and text (ticks, diagram edges): 5.0:1 / 5.8:1                             |
| `brand-coral-text` | `#c2410c` | `#ff7a4d` | Coral marks: 5.2:1 / 6.8:1                                                            |
| `brand-teal-tint`  | `#e6f6f9` | `#163034` | Diagram node fill                                                                     |
| `brand-coral-tint` | `#ffefea` | `#3f2922` | Diagram secondary fill                                                                |

The gradient itself is always `brand-teal` → `brand-coral` (`#00a3bf` → `#ff7a4d`), decorative only.

## Rollout

1. **Dev** (this change, ZIL-235): gate as above. Verify on the dev server in light and dark; Chris reviews on device builds (ZIL-236).
2. **Beta** (ZIL-237): widen the gate to `beta` after review.
3. **Prod** (ZIL-237): remove the gate, make the rules the default, fold preview tokens into the main set.

## Risks

- **Toolbar change is the most visible.** It changes every button's resting look. Kept behind the gate until review.
- **Reading progress** listens to the document's scroll, throttled with `requestAnimationFrame`, so the cost is one style write per frame while scrolling.
- **Diagram directive** is only prepended when the diagram has `%% specdown:brand` and no `%%{init` of its own, so an author's own theme always wins.
