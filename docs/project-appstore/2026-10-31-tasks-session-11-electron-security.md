# Session 11 — Electron security update

October 31, 2026. Isolated candidate: `codex/weekend-electron-security`, based on `069486c` in `/private/tmp/specdown-weekend-electron-20261031`.

## Change and scope

Pin Electron **44.10.1**, replacing 44.9.1 in `package.json` and the lockfile. No other dependency resolution changed. The existing electron-builder 26.18.1 installation and keychain-version guard are unchanged; the application version remains 0.0.228. This is the same-major security update, independent of the Electron 45 proposal and the separate updater/annotation fixes.

[Electron 44.10.0 release notes](https://releases.electronjs.org/release/v44.10.0) identify File System Access blocklist corrections for Git hooks and hypervisor UNC shares, malformed ASAR size handling, and consistent ASAR path handling across processes. [Electron 44.10.1 release notes](https://github.com/electron/electron/releases/tag/v44.10.1) add upstream Chromium, Dawn, Skia and V8 backports. These shipped-browser fixes matter even though Electron is a development dependency in npm and the runtime-only npm audit is zero.

## Verification

- Clean `npm ci` passed with normal root lifecycle execution and the unchanged builder guard. `npm run test:ci`: **846 tests / 52 suites**, including the existing desktop coverage thresholds. Lint, typecheck and production web build passed.
- npm audit remains **17 entries: 12 moderate, 5 low; zero high/critical**. Runtime-only audit remains **zero**. The remaining entries are the previously documented build/test-tool dependencies.
- The bookmark addon rebuilt against 44.10.1 headers for **arm64 and x86_64**. Both slices link only system Foundation/CoreFoundation, Objective-C, libc++ and libSystem libraries. Its packaged bytes match the built module.
- Unsigned universal **direct DMG/ZIP** and **MAS app** assembly passed with identities explicitly null, credential environment removed, no provisioning profile, identity discovery disabled, and `--publish never`. Framework Info.plists in both final apps report **44.10.1**. Both application and framework binaries contain arm64 and x86_64 slices. Each archive matches **125 source files, including all 110 generated web files**. Direct retains its updater/feed; MAS contains neither, and excludes native build sources.
- Direct DMG checksums (`hdiutil verify`) and ZIP compressed-data integrity (`unzip -tq`) passed. `npm ls --all` reports no invalid dependencies.
- Both final packaged executables ran in non-GUI Node mode on **arm64 and x86_64** (the latter using the already installed local Rosetta). All four checks reported Electron 44.10.1, loaded the packaged MAS addon and passed its native argument-validation calls. This verifies binary/addon compatibility, not security-scoped access under Store signing.
- A real **arm64 Electron 44.10.1** programmatic smoke passed with every window forced hidden, a temporary profile, menus/shortcuts suppressed, and no host input. It rendered a chosen Markdown document and actual Mermaid SVG, rejected ungranted sibling reads and an outside local image, blocked cleartext HTTP through CSP, exported a valid 9,981-byte PDF, and removed its private print temporary data. The native addon loaded. Runtime versions: Chromium 152.0.7977.169, Node 24.22.1.

The source-runtime harness is evidence for the Electron update and this candidate snapshot. It is not a test of physical input or the signed Mac App Store sandbox. The combined updater/annotation candidate must be rebuilt from its own final source; these artifacts must not be described as that later combined build.

## Local artifacts and repeatable checks

Artifacts are local validation outputs, not release uploads:

| Artifact | SHA-256 |
| --- | --- |
| Direct app ASAR | `00b25644fd8c198659d5f319cbcb72897e659d8b1407174c1507f8c6ab3cd328` |
| MAS app ASAR | `154d3efd290294d8328550c456328d2dd9637873189f4bac518b5833db013bd0` |
| Direct universal DMG | `17300e413509b199cbe208e0a930a841115000607ffddf1cc62c0ea5a5f1d553` |
| Direct universal ZIP | `f0325d9e6ac45808682023c26eb2acd707317043b7cdd7df892f7d86b5881c7c` |
| Packaged universal bookmark addon | `763f6dd887bed578c6642b315dffe1404bbd21e144ecbedd46ccced7cf055328` |

- Exact package/source hashes, architecture/linkage output and artifact locations: `/private/tmp/specdown-electron44101-manifest-20261031.json`.
- Package outputs: `/private/tmp/specdown-electron44101-direct-20261031/` and `/private/tmp/specdown-electron44101-mas-20261031/`.
- Reusable local wrappers: `/private/tmp/specdown-electron44101-package.cjs`, `-direct-config.cjs`, `-mas-config.cjs`; invoke the package script with `direct` or `mas`. Their absolute source/output paths must be changed for a later combined candidate. Cached upstream Electron/build tools live under `/private/tmp/specdown-electron-cache` and `/private/tmp/specdown-electron-builder-cache`.
- Hash verification script: `/private/tmp/specdown-electron44101-verify.cjs`. Hidden runtime harness and result: `/private/tmp/specdown-electron44101-smoke.cjs` and `/private/tmp/specdown-electron44101-smoke-result-20261031.json`.
- Build/test/install/audit logs use `/private/tmp/specdown-electron44101-*-20261031.*`.

## Remaining boundaries

Only this Mac was used. No other computer or physical device, UI input/unlock attempt, Apple login, keys, signing, notarization, upload or publication was used. Existing signing assets remain owner-held and unverified here. Signed sandbox/bookmark restoration, unlocked native interaction, final combined-source checks, cross-platform CI, and owner-controlled distribution remain separate gates. The Mac lock gate has not been bypassed.

## Final combined candidate — application revision 8303795

The validation below uses **`8303795c04da754206473bd2067248d16649f36c`**, combining this Electron update, electron-updater **6.8.11**, and the annotation-load hardening from `98cfd9c`. The earlier sections and `specdown-electron44101-*` artifacts remain evidence for the separate Electron-only snapshot. A subsequent documentation-only amendment is a separate review revision; these builds were made from application revision 8303795.

- A fresh `npm ci`, production build, lint, typecheck, dependency-tree validation, and **908 tests / 54 suites with coverage** passed. Full npm audit remains 17 entries (12 moderate, 5 low); runtime-only audit is zero. The approved builder guard remains unchanged.
- Fresh unsigned universal direct DMG/ZIP and MAS app assembly passed; DMG checksum verification and ZIP integrity checks passed. Both apps package **Electron 44.10.1**. The direct archive contains **electron-updater 6.8.11** and its update feed. The MAS archive contains neither updater nor feed. Both app executables and frameworks have arm64 and x86_64 slices; all **125 packaged source files and 110 web files** match the combined checkout/build.
- The packaged bookmark addon still has SHA-256 `763f6dd887bed578c6642b315dffe1404bbd21e144ecbedd46ccced7cf055328` and both architectures. Native source, both packaged app executables/frameworks, and addon hashes match the Electron-only native evidence. The earlier binary/addon runtime evidence is retained; no app was launched or installed for this combined validation.
- A newly generated Xcode project and **unsigned Release iOS simulator build** passed with the final web bundle. Both arm64/x86_64 simulator slices are present; all **110 bundled web files** match the new production build. Local validation settings are 1.0 (228), minimum iOS 16.0, with both arbitrary-load ATS flags false. Approved source version/build settings remain 1.0 (11).
- The real Swift security test executable passed bundle path/host/symlink boundary checks and bounded file reads with compiler warnings treated as errors. All native Swift/project hashes match the prior final Duo compile. This does **not** add interactive, keyboard, folded/open/rotated Duo, physical-device or signed sandbox evidence; those existing gates remain.

| Combined artifact or input | SHA-256 |
| --- | --- |
| `package.json` | `e43182b09c205eb45831bdcba076f83f0b638bab7157141c50afb48836205a6d` |
| `package-lock.json` | `9f8202f08ad6f559bd739e5fb5ec6b46243bf889b866e1c6168f3d6b93430da5` |
| Direct app ASAR | `c1d2f3cba33ff92836c92889908d93298efdae58333bcb09c55eba464ed0123b` |
| MAS app ASAR | `180d011f7db5a4ba33b8b43e87357a4e8b7d24cb77d13dc7d723c4a324f3acbd` |
| Direct universal DMG | `c72519d8cceb081fd00d43db4087c315768bd526d989b91f0de5110fef738c74` |
| Direct universal ZIP | `83d4bc4ec299b903a3bfea53711369b3f79fb56fc28b098a1b21469313ba3068` |
| iOS simulator executable | `a2ebc4e02ebb4074a9e780335f7d28a5de095bdebfbe0603e3a17f7480cc474d` |

Combined desktop artifacts and source verification: `/private/tmp/specdown-combined-manifest-20261031.json`, `/private/tmp/specdown-combined-direct-20261031/`, and `/private/tmp/specdown-combined-mas-20261031/`. Combined iOS app: `/private/tmp/specdown-ios-combined-20261031/Build/Products/Release-iphonesimulator/Specdown.app`; exact native/web/dependency hashes: `/private/tmp/specdown-combined-ios-manifest-20261031.json`. Logs and repeatable wrappers use `/private/tmp/specdown-combined-*`; the simulator compile log is `/private/tmp/specdown-ios-combined-20261031.log`.

Final review/CI, unlocked interaction, physical devices, owner signing and Store distribution remain separate gates. All combined work stayed on this Mac, with no UI input/unlock attempts, other computers, Apple login, signing keys or publication.
