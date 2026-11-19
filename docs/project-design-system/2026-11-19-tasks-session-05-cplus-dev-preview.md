# Session 05: C+ brand moments in Dev builds

Linear: ZIL-226 (decision, Done), ZIL-235 (this work), ZIL-236 (device review), ZIL-237 (promotion).
Spec: [C+ brand moments](2026-11-19-spec-brand-moments-cplus.md).

## Done

- [x] Recorded the decision on ZIL-226 and filed ZIL-235, ZIL-236 and ZIL-237.
- [x] **Gate.** `markdown-viewer/src/core/brand-preview.js` turns the preview on for the local Vite dev server (`__SPECDOWN_DEV_SERVER__` define, true only for `vite serve`) and for `window.specdownAppChannel === 'development'`. iOS/iPadOS Dev and Mac App Store Dev already report the channel.
- [x] **Direct Mac Dev channel.** `desktop/main.js` passes `--specdown-app-channel` for packaged Dev/Beta builds and unpackaged local runs (`directViewerChannel`). `desktop/preload.js` exposes only the channel, only `development` or `beta`, for the direct build. Version and build stay App Store-only. About now labels direct Dev and Beta builds too.
- [x] **Styles.** Every C+ rule in `styles.css` is scoped under `html[data-brand-preview]`: brand bar, active-tab gradient, title signature, read ticks, quieter toolbar (including Edit), drop moment, About strip.
- [x] **Behaviour.**
  - Reading progress drives the brand bar through `requestAnimationFrame`.
  - The Contents scroll-spy adds an inert `toc-link-read` class to sections before the current one.
  - About adds the app icon when the preview is on.
- [x] **Sample diagrams.** All 12 Mermaid blocks in `diagram-showcase.md` and `sample-with-mermaid.md` carry `%% specdown:brand`. With the preview on, those diagrams get a theme directive (light and dark), unless they set their own `%%{init}%%`. Users' Markdown is untouched.
- [x] **Tests:**
  - Gate on and off by channel.
  - Brand bar is added once.
  - Diagram directive: only marked diagrams, and never over an author's own.
  - Read ticks.
  - About icon.
  - Direct channel in main and preload.
- [x] **Verification:**
  - Production build (`vite preview`): no `data-brand-preview` and no brand bar.
  - Dev server, light and dark: all moments render; progress tracks scroll (0.35 at 35%); read ticks; 20 diagram SVGs rendered with the brand style; About icon loads; no page errors.
- [x] Design system: preview tokens in `tokens.json`, a "C+ brand moments (Dev preview)" section in the brand book, the decision in `evolving.md`, and the copied rules in `bundle.css`. The root README notes the Dev design preview.

## Not done

- Native Dev builds were not built or installed here. They need the owner's Mac and devices (ZIL-236).
- The iPhone action bar is unchanged by design.
