# Session 30 — Full-edge geometry for existing iOS icons

Date: 2026-10-31. Task: WK-27. Base:
`c7c1242569609aa55144a3f40eddec7d9e6adfa4` (draft #341).
Branch: `codex/ios-icon-geometry`.
Worktree:
`/Users/chrisbremer/code/specdown/.claude/worktrees/specdown-ios-icon-geometry-20261031`.

## Scope and approved geometry

The owner authorized fixing the extra inset on the six existing iOS alternates.
Their prior iOS exports reused the desktop artwork's 824px placement inside a
1024px dark canvas, leaving a second frame inside the system's icon mask.
Original and the separately approved Light option are outside this correction.

The iOS exporter now takes each original master's opaque tile bounds (alpha at
least 250), centers a square on those bounds, and sets its side to the shorter
dimension minus four source pixels. The two-pixel inward guard excludes the
outer antialias edge. A single uniform scale maps that square to 1024×1024;
there is no stretching, new artwork or reuse of a prior composited export.
RGB (11, 17, 29) fills only residual transparent corner pixels under the mask.
Existing face, ring, material and bevel artwork remains visible.

Independent agent visual review approved the before/after export comparison
at 60px and enlarged size; physical owner acceptance remains pending.
The actual Swift/Core Graphics exports were then compared with an
independent top-down Pillow reference. Crop coordinates agree; all four
mid-edges are filled. Filter/compositing differences average below 2/255 per
channel. The review grid uses an explicitly labeled rounded-mask approximation;
it is not an iOS runtime screenshot.

| Variant  | Source crop x | Source crop y | Square side | Scale to 1024 |
| -------- | ------------: | ------------: | ----------: | ------------: |
| Flat     |           192 |           205 |         870 |      1.177011 |
| Glass    |           160 |           188 |         934 |      1.096360 |
| Ceramic  |           176 |           201 |         902 |      1.135255 |
| Metallic |           150 |           179 |         952 |      1.075630 |
| Layered  |         151.5 |           154 |         951 |      1.076761 |
| Minimal  |         157.5 |           162 |         939 |      1.090522 |

All master artwork, Original and Light exports, catalog declarations, native
picker choices and desktop exports are preserved. Desktop still uses its
existing 824px normalization through a separate path. The new
`--ios-legacy-only` option writes only the six iOS AppIcons and their matching
previews. The Light-only option remains independent.

## Reproduction and verification

```sh
swift scripts/export-app-icons.swift --ios-legacy-only
python3 scripts/verify-app-icons.py --ios-legacy-only
python3 scripts/test-app-icons.py
```

Python requires Pillow; the already installed Python 3.12/Pillow 12.2.0 is used
without installing dependencies. The full default exporter is also reproduced
in a separate scratch tree to verify desktop and Light remain unchanged.

The icon regression suite passes **10 tests**, including six variant-specific
old-padding subcases, a fit that leaves short-axis padding, stretching, and the
existing Light controls. Separately, each genuine old padded iOS PNG from exact
`c7c1242` fails the new aspect-fill check while its desktop 824px check passes.
RGB/sRGB, matching previews, master-derived geometry and all four mid-edges are
verified independently of the native build.

Shared gates pass: **1,128 tests / 67 suites** with required desktop coverage,
plus lint, typecheck, focused formatting and production build. All 110 generated
web files remain byte-identical to the reviewed base. The full default exporter
reproduces all **20** PNG outputs in a separate scratch tree: six unchanged
desktop PNGs, twelve corrected iOS/preview PNGs and the two unchanged Light PNGs.
All **39** protected master/original/Light/desktop/catalog/provenance files remain
byte-identical; only the twelve intended existing iOS/preview PNGs change.

The isolated XcodeGen project and unsigned generic iOS Simulator build pass for
arm64 and x86_64 with signing explicitly disabled. Generated iPhone and iPad
icon dictionaries retain all seven alternates and primary `AppIcon`; fresh
`assetutil` inspection finds all six corrected icons, Light and their previews
in `Assets.car`. Version remains **1.0.1 (228)**, with no `_CodeSignature` or
installation/launch. The log retains the non-blocking AppIntents metadata
warning. Native catalog compilation is separate from physical icon switching.

Evidence is under
`/Users/chrisbremer/code/specdown/ios/DerivedData/ios-icon-geometry-20261031/`,
including `masters-and-current-ios.png`, `proposed-geometry.json`,
`exported-geometry-grid.png`, `export-comparison.json`, `negative-control.json`
and per-variant negative logs. `preservation-and-reproduction.json` and
`native-icon-evidence.json` bind the preserved files, scratch reproduction and
compiled catalog checks. The temporary dependency symlink is removed after
validation. All scratch output and validation caches remain under this
repository. No canonical checkout mutation, app install/Run,
signing, Apple action, upload or public release is performed by this work.
The root agent owns the separately authorized local Xcode promotion; physical
icon switching and Home Screen appearance remain owner acceptance checks.
