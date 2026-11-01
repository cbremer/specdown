# Session 29 — Separate iOS Light icon

Date: 2026-10-31. Task: WK-28. Base:
`fe3243a4ea132612bc3069b44a5eb8d291ab9009` (draft #340).
Branch: `codex/ios-light-icon`.
Worktree:
`/Users/chrisbremer/code/specdown/.claude/worktrees/specdown-ios-light-icon-20261031`.

## Approved design and scope

The owner requested a light-mode icon, chose a **separate Light icon choice**,
and approved the generated preview ("Looks ok"). The exact approved RGB master
is copied to `build/app-icon-sources/light.png`; its SHA256 is
`61d214a1870bc8f11f737c79d7fb092a81c028655600e85f38d7603273b66e76`.
The generation prompt and Original AppIcon reference are preserved beside it in
`light-generation-prompt.txt` and the masters README.

Light is a manually selected eighth iOS choice. It does not replace Original or
switch automatically with system appearance. The native picker uses the existing
selection, confirmation, error and reset behavior. `AppIcon-light` is registered
as an alternate catalog, with a matching `IconPreview-light` picker asset.

The approved master is 1254×1254 with no alpha. Its export resamples the entire
canvas once to 1024×1024, tags sRGB and writes an opaque RGB AppIcon. The picker
preview receives exactly the same bytes. No 824-pixel desktop inset, extraction
cleanup, dark background, corner mask or frame is applied. No desktop Light icon
is added. Original and all six existing alternate masters/exports are preserved;
their separate inset-border task **WK-27 remains pending**.

## Reproduction and validation

From this worktree, on macOS:

```sh
swift scripts/export-app-icons.swift --ios-light-only
python3 scripts/verify-app-icons.py --ios-light-only
python3 scripts/test-app-icons.py
```

The Python commands require Pillow. Validation uses the already installed
`/opt/homebrew/bin/python3.12` with Pillow 12.2.0; no dependencies are installed.
The existing default export/verify commands include legacy icons plus Light;
the explicit flag reproduces and validates only the new choice.

Asset validation confirms RGB/sRGB, dimensions, preview equality, full-frame
geometry and picker/catalog registration. Six regression cases exercise the
real verifier against valid output, accidental desktop inset, alpha, mismatched
preview and missing project/picker registration. Existing legacy icon checks
also pass without regenerating them.

Full shared-viewer gates pass: **1,128 tests / 67 suites**, including required
desktop coverage, plus lint, typecheck, focused formatting and production build.
All 110 generated web files are byte-identical to the reviewed base. The 45
pre-existing icon/master/catalog files captured before work remain byte-identical.
An independent scratch export reproduces both Light PNGs exactly at SHA256
`06796dbd40244ab07cb034b4c2ae4a2e58757d73a6f3075ea8b9c8c2a8294ade`.
Independent source and exported-artwork review found no blocking issue.

XcodeGen regenerated only this worktree's project. The generic iOS Simulator
build succeeded with `CODE_SIGNING_ALLOWED=NO`, `CODE_SIGNING_REQUIRED=NO` and
an empty signing identity, using separate in-repo DerivedData. Its generated
`Info.plist` registers `AppIcon-light` in both **CFBundleIcons** (iPhone) and
**CFBundleIcons~ipad**, retaining all six prior alternates and primary `AppIcon`.
`assetutil` confirms Light phone/pad renditions and `IconPreview-light` in the
compiled `Assets.car`; the app has no `_CodeSignature` directory. Version remains
**1.0.1 (228)**. The log retains the non-blocking AppIntents metadata-extraction
warning; there is no AppIntents dependency. The canonical owner project is not
regenerated, and compiled catalog evidence does not establish runtime switching.

Evidence and preservation manifests live under
`/Users/chrisbremer/code/specdown/ios/DerivedData/ios-light-icon-20261031/`.
They include `existing-icons-before.json`, `native-icon-evidence.json`, the raw
`assetutil.json`, generation approval/prompt, and complete build/test logs. Scratch
exports, test temporary directories and the Swift module cache are contained in
that evidence directory. The temporary dependency symlink is removed after
validation; no package or lockfile changes are made.
This is source/asset preparation and unsigned build validation only. No app is
installed or launched, no physical phone or Apple account is accessed, and no
signing, upload, submission or release is performed. The owner phone checkout
and version/build remain unchanged; runtime icon selection still needs owner
acceptance on a signed installation.
