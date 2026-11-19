# Modal

The proposed shared pattern for every dialog, sheet and side panel in SpecDown. One anatomy and three variants replace 10 hand-rolled treatments. **Dialog variant: shipped** for Shortcuts, About and File info (`markdown-viewer/src/core/modal.js` builds it; styles in `styles.css`). **Sheet and Drawer variants, and the remaining dialogs: proposed.** The full CSS is the `.sd-*` block at the end of `components/bundle.css` and uses only existing tokens.

## Anatomy

1. **Scrim:** `rgba(0,0,0,.4)` (the value most dialogs already use), no blur, safe-area padding, one z-layer.
2. **Panel:** `bg-primary`, 1px `border-color`, `radius-xl`, `shadow-lg`, max-height min(85vh, 100%). Only the body scrolls.
3. **Header:** title at 1.1rem/600 with an ellipsis, plus a **close button**: a 34px pill on `bg-secondary`, from the iOS sheet. Padding is `space-4` `space-5`, with a hairline below.
4. **Body:** padding `space-4` `space-5`, scrolls, `overscroll-behavior: contain`.
5. **Footer (optional):** a top hairline, then actions on the right in the order **secondary, then primary**, with a destructive text action pushed to the left.

## Variants

| Variant                                                   | When                                              | Differences                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Dialog** `sm` 26rem · `md` 32rem (default) · `lg` 38rem | Focused tasks on pointer screens                  | centred                                                                                                      |
| **Sheet**                                                 | Every dialog under 640px wide, and all iOS sheets | bottom-aligned, full width up to 540px, 20px top radius, footer buttons stretch to at least 44px tall        |
| **Drawer**                                                | Persistent side panels (annotations)              | docked 280px on `bg-secondary` with a left hairline. Under 700px it overlays at up to 360px with `shadow-lg` |

## Buttons

- Secondary: `bg-tertiary`, `border-color`, `radius-md`, 0.45rem 1rem, `ui-label`.
- **Primary:** `accent-color` with **`text-on-accent`**. Never literal white, which fails in dark theme.
- Danger: a text button in `color-danger`, left-aligned and never primary.
- One primary per dialog at most. Information-only dialogs (About, Shortcuts, File info) have no primary; the close button is enough.

## Using it in code

`createSdModal({ title, size, onClose, scrimClass, dialogClass })` from `src/core/modal.js` returns `{ scrim, dialog, title, body, footer() }`. Append `scrim` to the page, put content in `body`, add buttons with `footer()`, then trap focus in `scrim` and focus `dialog`. Escape, the close button and a scrim click call `onClose`. The caller keeps its own open state and restores focus on close.

## Behaviour (all variants)

- `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the title.
- Trap focus with `trapFocus()` (`src/core/focus-trap.js`), focus the first field or the close button, and restore focus to the opener on close.
- **Escape, the close button and a scrim click** all dismiss. A dialog with unsaved input asks before discarding.
- Enter with `fadeIn` over 0.2s. `prefers-reduced-motion` already removes it.
- Toasts render **above** every modal: the toast layer is 10030, above the highest dialogs at 10020.

## What it replaces

| Today             | Scrim         | z         | Width     | Radius         | Title             | Close            | Becomes                                                                       |
| ----------------- | ------------- | --------- | --------- | -------------- | ----------------- | ---------------- | ----------------------------------------------------------------------------- |
| AboutDialog       | .4            | 10002     | 26rem     | xl             | 1.1rem            | Done button      | **Done:** Dialog sm, footer keeps "Done"                                      |
| ShortcutsSheet    | .4            | 10002     | 26rem     | xl             | 1.1rem            | none             | **Done:** Dialog sm                                                           |
| FileInfoSheet     | .4            | 10002     | 32rem     | xl             | 1.1rem            | none             | **Done:** Dialog md, footer "Copy path" (desktop)                             |
| RecentFilesDialog | .4            | **10020** | 34rem     | xl             | **1.2rem**        | `.sample-button` | Dialog md, footer: Clear history (danger) · Close                             |
| Bookmarks         | .4            | **10020** | **620px** | 12px (literal) | own heading       | own buttons      | Dialog md; use `shadow-lg` and `radius-xl` instead of its own shadow and 12px |
| RepoBrowser       | **.5 + blur** | **2000**  | **520px** | xl             | **0.95rem**       | ✕ turns red      | Dialog md, filter in the body's top                                           |
| NoteEditor        | .4            | **1000**  | 440px     | **lg**         | none              | none             | Dialog sm, footer Delete · Cancel · Save                                      |
| CommandPalette    | .4            | 10002     | 38rem     | xl             | (input)           | none             | Keeps its own top-anchored layout. Shares scrim, panel and z only             |
| IOSActionSheet    | **.28**       | **950**   | 540px     | **20px**       | 1rem/**700**      | 34px pill        | Sheet                                                                         |
| AnnotationPanel   | none          | 600       | 280px     | none           | uppercase 0.75rem | small ✕          | Drawer                                                                        |
| DiagramFullscreen | n/a           | 1000      | full      | n/a            | n/a               | ✕                | Not a modal: full-surface viewer, keeps its own pattern                       |

## Proposed tokens this needs

`scrim` rgba(0,0,0,.4) · `radius-2xl` 20px · z-layers `z-drawer` 600, `z-overlay` 1000, `z-modal` 10002 (today up to 10020), `z-toast` 10030, `z-skip` above dialogs (see Evolving the system).
