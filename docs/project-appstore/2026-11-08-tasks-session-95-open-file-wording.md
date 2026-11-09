# Session 95: Consistent Open File wording

## Scope

The owner approved replacing Browse Files with Open File and requested consistent
wording across all editions. The shared viewer supplies the web, direct desktop,
Mac App Store and iOS start views. The native iPad sidebar, desktop picker and
desktop menu supply additional labels.

## Changes

- Use Open File for the shared start button, iOS hint, native iPad sidebar and
  desktop picker title.
- Use Open File… in the desktop menu and command palette. The ellipsis indicates
  that a file picker follows; the action name stays the same.
- Align current support instructions and the review-note source with the labels.
- Update existing label-dependent test expectations. File picking, multiple
  selection, permissions, shortcuts and document handling remain unchanged.

## Validation and delivery

The clean main baseline and final change each passed 81 suites / 1,443 tests.
Lint, strict type checks, the web build, Swift syntax parsing and whitespace
checks pass. Prettier passes for the support page, review-note source and this
session record; existing formatting in the other touched files is preserved.
The tests report the existing MaxListenersExceededWarning, and the build reports
the existing large-chunk warning. A local-only browser preview visibly shows
Open File beside Open Folder.

The frozen 1.0.2 source uses the same shared button, hint, sidebar, picker and
command strings. Its iPhone Open menu already calls the file action Open File….
The wording update must be included when integrating and rebuilding that source;
the already-uploaded build 240 does not contain it.

This source change is prepared separately from the frozen production/Beta 240
artifacts and their screenshots. Installed native apps need a new build to show
the label. Store metadata already saved for build 240 is not changed here. Web
publication, native packaging, uploads and App Review submission are separate
delivery steps.
