# Tasks — Group the changelog from descriptive commit subjects

**Date:** 2026-06-21
**Type:** tasks
**Roadmap item:** §3.5 of the [retrospective](2026-06-19-retrospective-handoff.md) —
the changelog generator groups by `feat:`/`fix:`/… but the repo writes
descriptive subjects, so it always fell back to a flat list.

## What

`scripts/generate-changelog.js` now infers a Conventional-Commit type from a
descriptive subject's **leading verb**, so the grouped changelog ("Features",
"Bug Fixes", …) lights up for this repo's actual commit style — no need to adopt
the `type:` prefix or add a commit-lint hook.

## Implementation

- **`inferType(subject)`** — a conservative, anchored leading-verb → type map:
  - `Add/Introduce/Implement/Support/Enable/New…` → **feat**
  - `Fix/Resolve/Correct/Prevent/Stop/Patch…` → **fix**
  - `Refactor/Simplify/Rename/Extract/Consolidate…` → **refactor**
  - `Doc(s)/Document…` → **docs**; `Test(s)` → **test**; `Optimize/Perf` → **perf**
  - `Bump/Upgrade/Pin` → **build**; `CI/Workflow/Pipeline` → **ci**;
    `Style/Format/Lint/Prettier` → **style**
  - Ambiguous verbs (`Update`, `Remove`, `Tweak`, …) deliberately return `''` and
    land under **Other Changes** rather than being mislabeled.
- **`formatSection`** — each entry's type is its explicit CC type when present,
  else the inferred type. Grouping/ordering is unchanged; the flat-list fallback
  now triggers only when *nothing* (explicit or inferred) can be categorized.
  Explicit CC entries still render their stripped description; inferred entries
  keep their full subject as the bullet.

## Tests / gates

- Added `inferType` tests + grouped/Other/flat-fallback `formatSection` cases;
  rewrote the old "flat list for descriptive commits" expectation to assert the
  new grouping. `npm test` → **452 pass**.
- lint 0 errors, build green; `generate-changelog.js --latest` CLI smoke-tested.

## Notes

- Existing `CHANGELOG.md` sections are untouched (the release pipeline regenerates
  going forward); the next release's notes will be grouped.
- A commit-lint hook (the other option in the retro) was intentionally **not**
  added — inference gives the grouped output without adding contributor friction.
