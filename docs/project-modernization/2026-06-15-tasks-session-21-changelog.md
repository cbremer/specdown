# Tasks — Session 21: changelog pipeline

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 3 — distribution

Releases had **no notes**: merging to `main` bumps the version, tags it, and
attaches the DMG/EXE/AppImage, but the GitHub Release body was empty and there
was no `CHANGELOG.md`. This adds an automated changelog generated from the
merged commit history.

---

## What shipped

### Generator (`scripts/generate-changelog.js`)
- Pure, unit-tested helpers: `parseCommitSubject` (Conventional-Commit
  `type(scope)!: desc`), `isReleaseNoise` (drops `[version bump]` + merge
  commits), `formatSection`, `prependSection`, `extractLatestSection`.
- **Conventional-Commit aware, with a graceful fallback:** when commits use the
  `feat:`/`fix:`/`docs:` convention they're grouped into sections (Breaking
  Changes first); when none do — this repo's descriptive style — the section is
  a clean flat bullet list. Scopes render as `**scope:** …`.
- CLI: default mode diffs `‹previous tag›..HEAD` and **prepends** the new
  version's section to `CHANGELOG.md` (preserving the title, preamble, and prior
  versions); `--latest` prints the top section for the release body.

### Pipeline (`.github/workflows/version-bump.yml`)
- The **bump** job now fetches full history (`fetch-depth: 0`, for
  `git describe`), runs the generator, and includes `CHANGELOG.md` in the
  `[version bump]` commit.
- The **tag** job publishes a **GitHub Release** whose body is the latest
  changelog section (`gh release create`/`edit`) *before* triggering the
  platform builds — so the build jobs' `action-gh-release` uploads attach the
  artifacts to the existing release without clobbering the notes.

### Seed (`CHANGELOG.md`)
- A seeded file with the `# Changelog` title + a maintainer comment; real
  version sections are prepended above it on each release.

## Verification

- `tests/unit/changelog.test.js` (new, +15): commit parsing (scope/breaking),
  noise filtering, flat vs grouped sections, breaking-first ordering, empty set,
  prepend ordering + preamble preservation, latest-section extraction.
- Ran the CLI against real history — correctly emitted a flat list for the
  current (non-conventional) commits and the `--latest` extraction matched.
- `npm run build` ✓, `npm run lint` ✓ (0 errors), `npm run typecheck` ✓
  (scripts aren't in the tsconfig include, so unaffected), `npm test` →
  **423 passed**. `version-bump.yml` validated as YAML.

## Notes / follow-ups

- Adopting Conventional-Commit subjects (even just `feat:`/`fix:`) would light
  up the grouped sections; until then the flat list is the expected output.
- The release body is regenerated from `CHANGELOG.md`, so editing the changelog
  in a follow-up commit before release would flow through to the notes.
