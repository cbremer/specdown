# Approved Light desktop parity

Owner scope: workstream 4 of the November 2 Store 1.0.2 development brief.
Direct desktop remains on its existing version series. No build number allocated.

- [x] Add failing desktop menu/persistence/reset regression tests.
- [x] Reuse the exact approved Light master, preserving every existing asset.
- [x] Export desktop Light through the canonical Swift generator with centered
  824px rounded geometry on a transparent 1024px sRGB canvas.
- [x] Offer all eight existing iOS artworks in the desktop native menu.
- [x] Check all saved alternate IDs, fresh-install defaults, reset after Light,
  missing/invalid artwork failure behavior, and unsupported arbitrary paths.
- [x] Verify pixels independently and reject wrong geometry/artwork mutations.
- [x] Run full tests, coverage, lint, typecheck, build, native catalog and ICNS checks.
- [ ] Independent review and integrated-candidate validation (parent workstream).
- [ ] Owner visual acceptance on real running desktop and iOS installations.

See [icons-wave-report.md](icons-wave-report.md) for exact evidence and limits.

## User behavior and limits

Appearance → Dock Icon on macOS, or Appearance → Window Icon on Windows/Linux,
now includes Light. The existing setting persists across launches. Original
resets desktop artwork; an untouched installation keeps its OS-provided primary
bundle icon. Existing choices and stored IDs remain valid.

Runtime switching affects the running macOS Dock or Windows/Linux window icon.
Finder, signed app bundle, Windows shortcut and installer icons retain their
shipped artwork. No signing workaround or bundle rewrite is performed.
iOS already exposes all eight choices and retains channel-specific defaults:
Original in production, Flat in Dev, Light in Beta. Its picker footer names the
correct reset choice. These native channel settings and identities are unchanged.

## Geometry

Light desktop resamples the complete approved master to an 824×824 tile at
(100,100) in a transparent 1024px canvas, with a 184px corner radius. This supplies
the rounded mask absent from desktop's runtime PNG API. iOS continues to use its
unchanged opaque full-bleed export and system mask. No existing artwork is
redesigned or regenerated.
