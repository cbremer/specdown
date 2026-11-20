# Session 07: C+ is the default on every surface

Date: 20 Nov 2026. Linear: ZIL-237.

## Why

PR #464 showed C+ in the Mac App Store, iPhone and iPad candidates by widening the gate to `production` Store shells. The direct-download Mac app and the public web app send no channel, so they still showed the old look. The owner asked for C+ everywhere.

## Done

- [x] Renamed `core/brand-preview.js` to `core/brand-moments.js`, removed the gate and the `data-brand-preview` attribute. `setupBrandMoments()` always adds the brand bar; `brandDiagramSource()` styles only diagrams marked `%% specdown:brand` with no init of their own.
- [x] The About icon always shows.
- [x] `styles.css`: every `html[data-brand-preview]` selector now starts with `:root`, which keeps the same specificity so the rules still win over `source-editor.css`.
- [x] Removed the `__SPECDOWN_DEV_SERVER__` define from `vite.config.js`, `eslint.config.js` and `globals.d.ts`.
- [x] The shell channel (`window.specdownAppChannel`) now only labels About. Desktop comments updated.
- [x] Tests: `tests/unit/brandMoments.test.js` replaces the gate tests (one bar for any channel, ungated CSS, diagram style, read ticks, About icon).
- [x] Design system: brand book section, token usage strings, `evolving.md` §4, the spec's gate and rollout sections, and the C+ block copied in `components/bundle.css`. Root README note updated.

## Checks

- [x] Full Jest suite, lint, typecheck, Prettier on touched files.
- [x] Production build (`vite preview`) shows the brand bar with no page errors.
