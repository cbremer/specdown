# Tasks — Session 10: gradual TypeScript complete (batch 3)

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 1 — Architecture (the "gradual TypeScript" roadmap item — final batch)
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §6

The last four (and heaviest) modules opt into `checkJs`, completing the
migration. With every module under `markdown-viewer/src` checked, **`checkJs` is
flipped on globally** so new files are type-checked by default. Fully gated, no
behavior change.

---

## Modules opted in (the final four)

| Module | Notes |
|---|---|
| `platform/desktop.js` | guarded the optional `window.specdown` bridge methods via a local `const bridge = window.specdown`; cast button handles to `HTMLButtonElement` for `.disabled` |
| `platform/ios-chrome.js` | a single `iosHandler()` accessor for the WK message bridge; `HTMLButtonElement` casts for the action-bar buttons; guarded the print-clone (`cloneNode` → `HTMLElement`/`SVGElement`) |
| `features/diagrams.js` | the heavy one — typed Panzoom (`PanzoomObject`), a `FullscreenOverlay` typedef for the overlay's expando properties, an `on()` null-safe `addEventListener` helper, `catch`-unknown handling, input/SVG casts |
| `main.js` | `$`/`req` DOM-handle helpers (`req` casts non-null for the always-present elements used unguarded); typed input/button consts; annotated the lazy DI-callback arrow params (preserving call-time binding the tests rely on); `e.target`/drag-event casts |

**Result: 25 of 25 source modules type-checked; `tsconfig.json` `checkJs: true`.**

## Gotchas hit this batch

- **Harness global collision (again):** a module-top `const overlay` in
  `diagrams.js` clashed with the `let overlay` in command-palette.js /
  shortcuts.js (all flatten to one global; last wins as `null`). `closeFullscreen`
  is reached via `showDropZone`/`closeTab`, so the break cascaded across ~9
  tests. Renamed to `getFsOverlay`. **Rule holds: never name a module-top
  binding after another module's global.**
- **`removeEventListener` options:** it doesn't accept `passive` (only
  `addEventListener` does) — the old `{ passive: false }` on removal was a
  silent no-op; dropped it (capture still matches).
- **`marked.parse` returns `string | Promise<string>`** in the types; the
  synchronous call site casts to `string`.
- **Lazy DI arrows must stay arrows.** Tests swap globals (e.g.
  `global.reRenderMermaidDiagrams = spy`) *after* `configure*()`, so the wiring
  has to resolve the callee at call time. Passing the function by reference would
  capture the original and break those tests — so the arrows are kept and their
  params annotated instead (`(/** @type {string} */ content, …) => …`) to satisfy
  `noImplicitAny`.
- **Expando elements:** the fullscreen overlay carries `panzoomInstance` /
  `fullscreenState`; typed as `HTMLElement & { … }` (not `any`, which would strip
  `addEventListener`'s event typing).

## Verification

`npm run build` ✓, `npm run lint` ✓, `npm run typecheck` ✓ (now `checkJs: true`),
`npm test` → **345 passed**. No behavior change.

## What this closes

The roadmap's **"gradual TypeScript"** item is done: 100% of the viewer source is
type-checked over JSDoc (no `.ts` rewrite), enforced in CI, and on-by-default for
new files. **Phase 1 (Architecture) is fully complete.**

Next (needs the user): Phase 2 slice 4 (toolbar + design-token overhaul — visual
review) and Phase 3 (macOS signing/notarization — Apple cert + CI secrets). See
[handoff-next-wave](2026-06-14-handoff-next-wave.md).
