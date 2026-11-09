# Icon parity wave evidence

## Checkout and changes

Working checkout: `.claude/worktrees/specdown-wave-icons-20261102`.
Branch: `codex/wave-102-icons`; baseline `63c2e8af12fbc2aae0ce7a2a16cabdcc32e3a07d`.
Origin: `https://github.com/cbremer/specdown`. Checkout was clean before work.
Canonical checkout, dependencies, versions, signing, live settings/notes, Apple
accounts, frozen artifacts and release housekeeping were not edited.

Adds Light to the existing desktop allowlist and bundles its transparent PNG.
No storage key, existing ID, primary bundle icon, Dev/Beta/production default or
identity changes. Approved Light master SHA256 remains
`61d214a1870bc8f11f737c79d7fb092a81c028655600e85f38d7603273b66e76`.

Exporter: `swift scripts/export-app-icons.swift --desktop-light-only` produces
only the new desktop file. Default export now includes both desktop and iOS
Light; `--ios-light-only` and `--ios-legacy-only` retain isolated behavior.
Desktop Light is RGBA/sRGB, 1024px, centered 824px rounded tile, radius 184px.
iOS Light remains opaque/full-bleed. The complete master is uniformly resampled;
no new art generation, color edits or source reinterpretation.

## Regression evidence

Before production edits, targeted Jest run failed five new assertions because
Light was absent from the menu/catalog. After the allowlist change it also caught
the missing PNG. Final checks verify all eight bundled PNGs; Light selection,
controller restart and Original reset through the menu on darwin/win32/linux;
restoration of every existing saved alternate without rewriting preferences;
fresh install primary retention; native/decoder errors preserving selection and
settings; unknown stored IDs and arbitrary paths rejected.

The independent Pillow verifier checks alpha footprint, clean margins, rounded
corners and opaque mid-edges, and compares all opaque artwork to a full approved
master resize. Four new image checks cover real output and rejection of iOS
geometry, square corners, and recolored artwork while preserving geometry.
Existing ten iOS/mutation checks still pass.

## Commands and outcomes

- `npm test -- --runInBand`: 80 suites, 1450 tests pass.
- `npm run test:coverage -- --runInBand`: 80 suites, 1450 tests pass;
  desktop/main.js coverage gate passes (72.89% statements, 63.04% branches,
  64.49% functions, 75.49% lines). Renderer coverage remains
  uninstrumented by the eval harness; no renderer percentage claim is made.
- `npm run lint`: passes with zero warnings.
- `npm run typecheck`: passes.
- `npm run build`: passes; Vite retains its large-chunk advisory.
- `swift scripts/export-app-icons.swift --desktop-light-only`: passes with
  `CLANG_MODULE_CACHE_PATH=/private/tmp/specdown-icons-clang` and
  `SWIFT_MODULECACHE_PATH=/private/tmp/specdown-icons-swift`, avoiding a denied
  write to the default module cache.
- `/opt/homebrew/bin/python3.12 scripts/verify-app-icons.py`: all desktop/iOS
  artwork passes. This interpreter has Pillow 12.2.0; default python3 lacks Pillow.
- `/opt/homebrew/bin/python3.12 scripts/test-app-icons.py`: 14 tests pass.
- `swiftc ios/SpecDown/AppIconCatalog.swift tests/native/AppIconCatalogTests.swift
  -o /private/tmp/specdown-icons-catalog-test` (same cache environment), then the
  compiled executable: all 24 channel/artwork mappings and reset titles pass.
- `/opt/homebrew/bin/python3.12 scripts/macos-icon.py verify`: all ten committed
  primary ICNS representations pass fresh Apple decode and source-artwork checks.
- Existing asset byte comparisons against baseline: 33 existing assets pass; desktop PNGs,
  approved masters, iOS PNGs and build PNG/ICNS artwork unchanged.
- Generated Light was inspected visually at full size with the image viewer.
- `git diff --check`: passes.

Full Jest runs retain the pre-existing MaxListenersExceededWarning emitted by
the test harness. This is separate from the clean ESLint gate. No failures hidden.

## Native acceptance gaps

The configured Electron 45.1.0 binary is absent from canonical node_modules;
its CLI attempted lazy download and failed network fetch before launching.
No dependency installation or replacement followed. A cached stock Electron
44.10.1 archive was then extracted into `/private/tmp/specdown-icons-electron44`.
A disposable smoke script used the real `nativeImage` decoder and `app.dock`
API, synthetic Map settings and temporary userData. Light apply, controller
restore and Original reset passed (exit 0). The restricted launch initially
aborted; the explicitly approved native launch outside that restriction passed.
No frozen or installed app, live settings, signing or Apple account was touched.

This is native API evidence on Electron 44.10.1, distinct from configured 45.1.0.
Real Dock visual appearance, process relaunch persistence with electron-store,
MAS runtime, Windows/Linux native window/shortcut behavior, and device Home Screen
appearance remain owner/native acceptance checks. Browser rendering is not a substitute for
native icon behavior. No new simulator or signed-device result is claimed.

Finder and Windows shortcuts intentionally keep shipped icons; runtime selection
cannot promise their replacement. All bundle signing stays untouched.
Desktop Light SHA256: `37f17aed43c999df918c8c5c407ec16ec6ce2650248ca508c878ff4f34049222`.

Independent review, draft PR publication and combined-candidate checks belong to
the parent integration workstream; this branch is committed locally only.
