# Session 21 — restore the canonical local Xcode checkout

Date: 2026-10-31 (America/Los_Angeles).

## Owner direction and working location

Chris requires working source and the Xcode project to remain under `<repo>`. Xcode's existing Recent Projects entry correctly points to `~/code/specdown/ios`; the problem was that this checkout remained on the older main source while review candidates were prepared in temporary Git worktrees. The separate Documents signing packet is a retained evidence/archive snapshot, not the everyday development project.

**Open `<repo>/ios/SpecDown.xcodeproj` for local development and phone testing.** This supersedes Session 18's instruction to open the archive copy. Use the SpecDown scheme, the connected iPhone and Chris's existing signing team. Chris performs signing and Run/install. Local device testing precedes a signed TestFlight upload; physical TestFlight acceptance precedes submission of that same build to App Review.

## Source and preservation

- Primary checkout: local branch `codex/local-ios-1-0-1`, exact frozen mobile source `e7b842bfee5e360b9e9aaea8285c79c28f6fccbc` / draft #332, version **1.0.1 (228)**. No main-branch merge, push, deployment or release occurred.
- Main remains at `681d9527fad55782182687b819009559a4bb3f78`. Later desktop refresh source `f2715df` / #333 and handoff `a09ce3d` / #334 remain separate reviewed branches; they are not silently added to this frozen phone candidate.
- The three owner Oct 20 timeline rows and all 16 untracked artwork/copy-review/session files were preserved. The original README change also remains in named stash `specdown-owner-readme-before-local-ios-20261031` (`a376eaff0ae7f9b76bbfed0b65cfac486acb818b`). It is a backup; do not apply it again over the already restored owner rows.
- Before-state generated Xcode project, Info.plist, web output, dependencies and owner-file hashes are retained under `ios/DerivedData/local-checkout-20261031/` inside this repository. Generated outputs and backups are ignored. No owner artwork was deleted or replaced.
- Previously validated candidate dependencies were copied locally without running installation/signing scripts; their 737 installed lockfile entries match the candidate lockfile. The canonical web output was freshly rebuilt and all **110 files** match the frozen mobile packet byte for byte. The bundled web package version remains `0.0.228`; the native iOS marketing/build version is `1.0.1 (228)`.

## Xcode alignment and verification

The existing generated project was updated in place with the two new Swift source references (`SecurityPolicy.swift`, `DocumentLoadAcceptance.swift`), the four Debug/Release version/build settings and the generated Info.plist ATS policy. All other project objects/settings and scheme/workspace definitions were preserved. **Unsigned Debug generic-device build: PASS from the exact canonical project**, with no version overrides. The actual product is 1.0.1 (228), `com.mosaicpando.specdown`, arm64, minimum iOS 16; all 111 application source files and 110 bundled web files match e7. Evidence: `ios/DerivedData/ios-project-alignment-20261031/RESULT.md`, `debug-build-verification.json` and `debug-build.log`.

Fresh canonical checks also passed: 996 tests in 59 suites, lint, typecheck and production web build. Xcode was opened using its existing Recent Projects entry; the window URL confirms the canonical path and General shows 1.0.1 (228). Opening the project changed only its window UI-state file; that current state was retained. Xcode currently shows no development team and Any iOS Device (arm64), so Chris selects the team and connected iPhone before Run. Signing, installation, physical-device acceptance and TestFlight have not occurred.

## Future work and historical copies

All new working source stays under this repository. If parallel branches require worktrees, use the existing `.claude/worktrees/` convention under this root and preserve the root phone checkout. All 13 existing October 31 temporary worktrees were relocated there with `git worktree move`. Every branch, commit, clean status and tracked-file hash was preserved, and all 620 symlinks resolve. The migration inventory is `ios/DerivedData/local-checkout-20261031/worktree-migration.json`. Older paths in logs/manifests describe historical runs and must not be silently rewritten as current build evidence.

The previous Documents release packets and temporary build evidence remain preserved historical artifacts. They are not the location to edit or open for the next local phone build. Apple account access, credentials, signing and Mac App Store key setup remain owner-controlled. No other computer is accessed.
