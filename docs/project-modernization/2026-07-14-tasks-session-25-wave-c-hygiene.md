# Tasks — Session 25: Wave C (Engineering Hygiene)

**Date:** 2026-07-14
**Scope:** Wave C of the
[Evaluation v2](2026-07-14-brainstorm-evaluation-v2-post-modernization.md)
"Consolidate & Harden" plan — structural debt and toolchain honesty.

## Checklist

- [x] **Render-generation token (kills the tab-switch race, finding E4).**
      `features/diagrams.js` now carries a shared generation counter;
      `processMermaidDiagrams` and `reRenderMermaidDiagrams` re-check it after
      every `await` and stop touching DOM/panzoom state once superseded. Rapid
      A→B→C tab switches no longer leak panzoom instances into shared state,
      write into detached DOM, or interleave `mermaid.initialize()` with an
      in-flight render (mixed-theme diagrams). Two regression tests simulate
      the race with a deferred `mermaid.render`.
- [x] **`main.js` decomposed: 977 → 505 lines.** Extracted five modules,
      each with its own imports (no behavior change): - `features/app-commands.js` — the 15-command palette registry - `features/version-check.js` — version label + GitHub poll
      (constants stay in `main.js` for `scripts/sync-version.js`) - `features/drag-drop.js` — drop-zone + document-level drop handling - `features/keyboard.js` — the global keydown listener + Esc chain - `platform/ios-wiring.js` — iOS action-bar/sheet click bindings
      `main.js` keeps the render core, init()/DI wiring, and toolbar wiring.
- [x] **Zero lint warnings, gated.** All 49 warnings fixed (optional catch
      binding for unused catch params, dead `workspaceRoot` renderer state
      removed, stale eslint-disable directives and the stale `vendor/**`
      ignore dropped); `npm run lint` now runs `--max-warnings=0`, so
      warnings fail CI instead of accumulating.
- [x] **`core/state.js` sealed.** `Object.seal(state)` freezes the _shape_
      (fields stay mutable): adding a new shared-state field now requires
      editing state.js, so modules can't smuggle ad-hoc properties in.

## Deliberately deferred (with rationale)

- **Renderer coverage instrumentation.** Jest still reports ~0% for
  `markdown-viewer/src/` because `tests/helpers/loadApp.js` inlines + evals
  the module graph outside Jest's transform. Making renderer coverage real
  means migrating 31 suites off the global-eval harness to real module
  imports — a dedicated session, not a rider. The enforced threshold remains
  scoped to `desktop/main.js` (which is genuinely instrumented).
- **Full state encapsulation behind accessors** — sealing addresses the
  drift risk at a fraction of the churn; accessors can ride along with the
  eventual test-harness migration if still wanted.

## Verification

`npm test` — **482 passing** (+2 race regressions). `npm run typecheck`
clean. `npm run lint` — 0 errors, 0 warnings (now enforced). `npm run build`
green. `main.js` 505 lines; largest remaining module is
`features/annotations.js` (797).
