SpecDown is a quiet reading tool for Markdown and Mermaid. The document is the hero; the chrome stays neutral, flat and out of the way. One shared web viewer (`markdown-viewer/`) renders on web/PWA, Electron desktop (direct download, Mac App Store, Windows, Linux), iPadOS and iOS. Native shells add only what the platform should own. Fun lives in the empty state, through the visual themes. It never goes inside the document.

## Principles

- **The document is the hero.** Content sits on `bg-primary`, the app ground is `bg-secondary`, and controls rest on `bg-tertiary`. Three neutral steps, one accent.
- **One accent, used only for interaction.** `accent-color` means "you can act on this" or "this is active": links, the active tab rule, the focus ring, button hover/active, the selected palette row. Never use it for decoration.
- **Flat, bordered, lightly shadowed.** Separate regions with a 1px `border-color` hairline. Shadows are reserved for things that float: menus, toasts and the palette (`shadow-lg`), plus the header (`shadow-sm`).
- **Both themes are first-class.** Every colour has a light and a dark value. Dark text is off-white (`#e6e6e6`), not pure white. In dark mode the accent is light, so text on it flips to navy via `text-on-accent`.
- **Personality goes in the empty state.** Starfield (the default), Aurora and Blueprint dress the drop zone and landing. Once a document is open, the reading surface is always plain. See the Visual themes section.
- **Shared first, native where it matters.** Put a feature in the shared viewer behind `window.specdown`. Use native UI only where the platform owns the job: menus, file pickers, sidebars, print, alerts, app icons. See Native platforms.

## Voice and content

- Plain, calm and specific. Labels are verbs or nouns in Title Case on native menus ("Open File…", "Export as PDF…") and sentence case in web UI ("Open from URL…", "Open a file to remember it here.").
- Use an ellipsis (…) when an action opens a further step.
- Errors say what happened, what's unchanged, and what to do next: "Your current document is unchanged." "Download it in Files and retry, or locate the file."
- Address the user as "you". No exclamation marks, no emoji in UI chrome.

## Colour

| Role            | Token                                                          | Use                                                |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Reading surface | `bg-primary`                                                   | Document pane, header, menus, dialogs              |
| App ground      | `bg-secondary`                                                 | Body, tab bar, inputs, table headers               |
| Control fill    | `bg-tertiary`                                                  | Resting buttons, inactive tabs, chips, inline code |
| Text            | `text-primary` / `text-secondary`                              | Body / metadata, captions, inactive tabs           |
| Hairline        | `border-color`                                                 | Every divider and control outline                  |
| Interaction     | `accent-color`, `accent-hover`, `text-on-accent`               | Links, hover/active fills, focus                   |
| Status          | `color-success`, `color-info`, `color-warning`, `color-danger` | Toast edges and state marks, always with a word    |

- Put `text-primary` and `text-secondary` on any of the three neutrals. Every pair passes 4.5:1 in both themes.
- Hovered or active controls fill with `accent-color` and border it, with text in `text-on-accent`. Hover and active look the same by design.
- Code blocks are always dark (`code-surface`, `code-border`, `code-text`) in both themes, matching the github-dark highlight theme.
- Toasts are always a dark chip (`toast-surface`, white text), with a 4px status edge.
- The `brand-*` colours belong to the logo and the app icon. Starfield borrows `brand-teal` and `brand-coral` for its nebulae. Otherwise they don't appear in UI chrome today (see Evolving the system).
- **Known contrast gaps (kept as in the source):** `color-success` (1.9:1) and `color-warning` (2.2:1) on light grounds work only as edges or dots beside a word. `border-color` is below 3:1 as a control boundary, so controls also differ by fill.

## Type

- System fonts only: `sans` (`-apple-system`, Segoe UI, Roboto…) and `mono` (SF Mono, Menlo, Consolas). No web fonts ship. Each platform reads in its own native face.
- Documents use the Document styles. Body is `doc-body` (1rem/1.6). Headings run `doc-h1` 2rem down to `doc-h6` 0.9rem, all at 600 weight and 1.3 leading. h1 and h2 carry `border-color` underlines.
- Chrome uses the Interface styles: `ui-label` (0.9rem) for buttons and menus, `ui-tab` (0.85rem) for tabs, `ui-caption` (0.8rem) for metadata, `ui-chip` (0.72rem/600) for chips.
- Only three weights: 400 for text, 500 for emphasis (active tab, file name), 600 for headings and labels. 700 appears only in a few legacy spots.

## Space, radius and elevation

- Spacing runs on a 4px rhythm: `space-1` 4px through `space-6` 32px. Header and document padding is `space-4` vertically and `space-6` horizontally. Toolbar gaps are `space-2`.
- Radii by size: `radius-sm` 4px for small buttons, `radius-md` 6px as the default control, `radius-lg` 8px for menus and toasts, `radius-xl` 12px for the palette, dialogs and iOS action buttons, and `radius-pill` for chips.
- Elevation: `shadow-sm` for the header, `shadow-lg` for anything floating. Dark mode deepens the shadow alpha rather than lightening the surface.

## Dialogs and panels

- Every modal surface follows the **Modal** pattern (build it with `createSdModal` in `src/core/modal.js`): a 40% black scrim, a `bg-primary` panel at `radius-xl` with `shadow-lg`, then header (title + 34px close), body and footer. Sizes are `sm` 26rem, `md` 32rem and `lg` 38rem.
- Proposed next: under 640px wide, and on iOS, a modal becomes a **Sheet** that rises from the bottom, and persistent side panels become **Drawers**.
- At most one primary button, filled `accent-color` with `text-on-accent`. Destructive actions are `color-danger` text on the far left.
- Escape, the close button and a scrim click all dismiss. Focus is trapped and returned to the opener. Toasts stay visible above any open modal.
- Shortcuts, About and File info already use it. The other panels are documented as they ship under "Dialogs · current", and the Modal component lists what each one becomes.

## C+ brand moments (Dev preview)

**Preview: Dev builds only.** On when the viewer runs on the local dev server or in a native shell reporting the `development` channel; `core/brand-preview.js` then sets `html[data-brand-preview]`. Beta, Prod and the production web app are unchanged until ZIL-237.

- **Brand bar:** a 3px `brand-teal`→`brand-coral` bar across the top of the app. In a document it fills with reading progress; on the empty state it's full.
- **Active tab:** gradient top rule instead of solid `accent-color`.
- **Title signature:** the document's first `h1` gets a 48px gradient underline in place of the full-width hairline.
- **Read sections:** Contents links for sections scrolled past show a `brand-teal-text` tick.
- **Quieter toolbar:** buttons rest flat and hover on `bg-tertiary`. Active toggles and the current Contents link use `accent-tint` with `accent-color` text, never a solid fill.
- **Drop moment:** while a file is dragged over, the drop card's border becomes the gradient with a soft teal/coral glow.
- **About:** a gradient strip tops the dialog, with the app icon above the tagline.
- **SpecDown diagram style:** teal nodes and edges (`brand-teal-tint`, `brand-teal-text`), coral secondary (`brand-coral-tint`, `brand-coral-text`). Only for diagrams that carry the Mermaid comment line `%% specdown:brand`, which our bundled samples do. Users' Markdown is never restyled, and a diagram's own `%%{init}%%` always wins.
- The gradient is decorative. It never carries text, and blue still means "you can act on this".

## Motion

- Two speeds: 200ms for surface changes and 120ms for hover/press feedback. Animate only colour, background, border, shadow, opacity and transform, never `all`.
- `prefers-reduced-motion` neutralises all animation app-wide, including theme backdrops.
- iOS turns off hover transforms and transitions (`.ios-native`). Touch has no hover.

## Focus and accessibility

- Keyboard focus is a 2px solid `accent-color` outline, offset 2px, shown only for `:focus-visible`.
- Every icon-only control carries an `aria-label`. Icons are `aria-hidden`.
- A skip link (`accent-color` fill) is the first focusable element.
- Never use `window.alert`/`prompt`. Native shells ignore them. Use the in-app toast or modal.

## Iconography

- One outline set, Lucide-derived (MIT), in `src/core/icons.js`: 24×24 viewBox, rendered at 16px, 2px stroke, round caps and joins, `currentColor`. Icons inherit text colour, so they work in both themes and in accent fills.
- The copies under Assets → Icons are drawn in `#1a1a1a` for display. In product, use the inline `currentColor` markup from `icons.js`.
- No emoji in chrome. The icon set replaced emoji glyphs because they rendered differently on every OS.
- Native shells use the platform's symbols: SF Symbols on iOS (`doc.badge.plus`, `link`, `app.badge`, `doc.text`, `chart.xyaxis.line`), and none in the Electron menus.

## Logo and app icon

- The logo (Assets → Logos) is a shield mark in a teal-to-coral halo with a gold core, plus the "SpecDown" wordmark. "Spec" is set in `brand-ink` and "Down" in the gradient. The header shows it 40px tall.
- The app ships eight interchangeable icon artworks (Assets → App Icons), identical on iOS and desktop: Original, Flat, Glass, Ceramic, Metallic, Layered, Minimal and Light. People switch them in Appearance.
- The dark header uses `markdown-viewer/logo-dark.svg`: the same lockup with "Spec" in white instead of `brand-ink` (17.4:1 on `bg-primary` dark). The header swaps the two with `.header-logo-light` / `.header-logo-dark`.

## Using and changing this system

- This folder is the source of truth. Read this file before any UI work on any surface, then the relevant section: `native-platforms.md`, `visual-themes.md`, or `components/<Name>/README.md`.
- `tokens.json` holds every colour (light and dark), type style, spacing step, radius and shadow by the same name the CSS uses (`--<name>`). Use a token rather than a raw value. If no token fits, add one here in the same PR.
- `components/bundle.css` is a copy of the component rules from `markdown-viewer/styles.css`, plus the `.sd-*` Modal block (Dialog shipped; Sheet and Drawer proposed). The app still loads `styles.css`, so change the app there and refresh the copy.
- When a PR changes a token, a component's look or behaviour, a theme, or a native shell's UI, update the matching file here in the same PR.
- `evolving.md` lists proposals. Its values are not tokens until they're adopted.
- A browsable version (live previews in light and dark) is published as a private claude.ai artifact and is re-synced from this folder. Ask the owner for access. The repository copy wins if they differ.
