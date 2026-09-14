# Session 02 — normalize alternate icon artwork

## Problem

The v0.0.191 alternate desktop PNGs had 1024-pixel canvases but inconsistent
visible sizes and vertical placement. Original occupied 824×824 pixels; Flat
occupied 736×715 and Layered 741×744. Near-transparent extraction residue also
expanded several icons' nonzero alpha bounds nearly to the canvas edges.

## Changes

- [x] Preserve full-resolution masters in the repository.
- [x] Clean Layered's outer silhouette with a targeted imagegen edit.
- [x] Export centered artwork at Original's visible width without stretching.
- [x] Remove extraction fringe and distant low-opacity residue during export.
- [x] Refresh six desktop assets, six iOS alternates, and six picker previews.
- [x] Add a repeatable exporter, pixel-level verifier, and visual size gallery.

Verified visible sizes: Flat 824×800, Glass 824×795, Ceramic 824×822,
Metallic 824×808, Layered 824×812, Minimal 824×788. All centers are within
one pixel of (512, 512); low-opacity bounds extend no more than three pixels
beyond the visible bounds. iOS assets have no alpha channel and match their
picker previews byte-for-byte.

## Validation

- Pixel verifier passed for all six desktop/iOS pairs.
- Browser visual review at 32 and 64 points on light and dark backgrounds.
- 41 Jest suites / 665 tests, lint, typecheck, and production build passed.
- Native Electron smoke: all seven choices loaded through the app's Dock menu
  and saved the expected selection in an isolated test profile.
- Unsigned iOS Simulator build passed; compiled phone and iPad metadata each
  register all six alternate icons. Home Screen switching was not exercised.

## Scope

This changes artwork only. macOS still uses the shipped bundle icon after the
app quits. Persistent Finder/Dock customization is a separate feature.
The installed app needs a new build/update to use these assets. An iOS build
does not establish Home Screen runtime verification.
