# Session 10: keep direct desktop aligned with the Apple wave

## Scope and source

The owner requested two public URL fixtures for phone/tablet testing and explicit
direct-desktop participation in the current Apple development wave. Work stays in
the existing wave worktree at `c0ddaba`, preserving its local About and URL-entry
changes. The canonical checkout and installed direct-download app are preserved.

The raw [SpecDown README](https://raw.githubusercontent.com/cbremer/specdown/main/README.md)
and [public repository](https://github.com/cbremer/specdown) were read successfully
on November 8, 2026. The former should open a document; the latter should open the
existing repository Markdown chooser.

## Changes

- Extend the unsigned desktop package workflow's PR paths to include
  `markdown-viewer/**`, `vite.config.js` and `scripts/copy-static.js`. Shared
  viewer/build edits now select the existing macOS, Windows and Linux package
  validation jobs, alongside desktop shell edits.
- Prepare an unpublished local Apple Silicon direct-desktop package from the
  exact shared viewer and desktop source used by Apple Dev 1.0.2 (237). Compare
  the packaged files to both the source and the retained Store Dev artifact.
- Keep the release checklist below in this wave. The workflow-path change is
  local until the source is reviewed and published through the normal PR process.

## Parity contract for this wave

| Area                  | iPhone / iPad                                                     | Mac Store / direct desktop                                                  |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Markdown and diagrams | Shared viewer, with native file access                            | Same shared viewer, with existing desktop file access                       |
| Themes                | Starfield for a new preference; Basic label                       | Same shared theme source; preserve a user's saved choice                    |
| Diagram presentation  | Shared presentation navigation                                    | Same presentation feature, with desktop pointer/keyboard controls           |
| URL entry             | Phone sheet; regular iPad popover; compact sheet                  | Familiar inline URL field                                                   |
| URL loading           | Explicit submit, errors, cancellation and stale-result protection | Shared loader corrections, including rejected-open handling                 |
| About                 | Native version/build and recognized channel label                 | Store native metadata; direct desktop keeps its independent release version |

The direct desktop and Apple marketing versions are independent. GitHub's live
latest-release API reported **v0.0.232**, published November 2, 2026, with Mac,
Windows and Linux assets. Apple Dev **1.0.2 (237)** is a local test batch, not a
desktop release version. The next direct desktop version remains assigned by the
existing reviewed version workflow rather than repurposing an Apple number.

## Release checklist

- [ ] Land the reviewed common-source wave and retain its source revision.
- [ ] Run desktop package validation for macOS, Windows and Linux on that source.
- [ ] Exercise real desktop open/URL, files/folders, live reload, bookmarks,
      diagrams/presentation and print/PDF behavior on named authorized hosts.
- [ ] Prepare the direct desktop release through its existing version/tag flow.
- [ ] Verify Mac Developer ID signing/notarization, all platform assets and update
      metadata before owner-authorized publication.
- [ ] Prepare Apple Beta/Store artifacts separately from the same reviewed source,
      retaining their own build numbers and device acceptance results.

## Validation

The local Apple Silicon direct-desktop package built successfully. Its compiled
identity is `com.specdown.desktop`, version `0.0.232`, internal build `237`.
All **110** packaged viewer files and **20** packaged desktop source files match
both the current source and the retained Store Dev 237 package byte for byte.
This is a local unsigned, unnotarized package; it was not installed or published.
Direct-desktop runtime acceptance remains pending.

The workflow YAML parsed successfully; its shared-viewer/build paths, three
platform jobs and read-only repository permissions were checked. This does not
claim that the remote jobs have run. Existing shared validation for this source is recorded in
[App Store Session 89](../project-appstore/2026-11-08-tasks-session-89-url-entry-implementation.md).
Windows/Linux package and hands-on results must be recorded separately; a local
Mac package is not evidence that those platforms were tested.

Private local package logs and the comparison manifest are retained under
`ios/DerivedData/wave-102-local-dev-237/`, including
`direct-desktop-verification.json`.
