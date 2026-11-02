# Session 77: direct desktop 232 published

**SpecDown Desktop 0.0.232 is public.** The [release](https://github.com/cbremer/specdown/releases/tag/v0.0.232) was published November 2, 2026 at **19:36:56 UTC**. All ten public assets were independently downloaded and matched the reviewed CI bytes at **19:37:59 UTC**. Sessions 72, 74 and 76 remain preserved historical checkpoints.

## Exact source and approvals

Immutable **v0.0.232** points to reviewed source `cc7024d7008cbd6be4e3f29eefe2f0a41ec44824`, Git tree `497a697944c7df847bc05a46b7f7eeefc0662a87`. [Run 41503767953](https://github.com/cbremer/specdown/actions/runs/41503767953) completed successfully: provenance, all three platform builds and publication passed. Chris personally approved both the build deployments and the separate publication deployment; the retained GitHub approval records identify `cbremer` (4009517). The agent did not approve either gate.

The release includes Close Folder, accepted-document/refresh safeguards, diagram/Find focus and lifecycle corrections, and reviewed security/dependency updates. The signed Mac app supports Apple Silicon and Intel and requires **macOS 13 or later**, as stated in the final release notes. The 231-to-232 recovery itself changed tests/CI and the direct revision, not application behavior. Superseded 231 remains unpublished, with its tag retained.

## Artifact and public verification

Independent artifact inspection cleared all ten release files. Provider archive digests/CRCs and the three update feeds matched exact versions, filenames, sizes and SHA-512 hashes. The Mac app passed strict signature verification, Gatekeeper acceptance and stapled notarization-ticket validation using Developer ID Application/team `582YQWPT9G`. All 14 native binaries contain both architectures. Packaged source and dependencies passed the separate ASAR review.

After publication, the public verifier anonymously streamed every actual GitHub asset: Mac DMG/ZIP and blockmaps, Windows installer/blockmap, Linux AppImage, and all three update feeds. The complete inventory, byte counts, SHA-256 and SHA-512 hashes matched the independently verified CI artifacts. A further anonymous check at **19:39:05 UTC** confirmed that GitHub’s latest-release route identifies **v0.0.232** (release `431838301`) and all three `releases/latest/download/latest*.yml` routes serve those same verified 232 feed bytes. This establishes both versioned download availability and the public latest-feed routes.

These checks did not install or launch a new app, execute a Windows/Linux installer, or exercise an existing installation's automatic update. Generated Vite assets were inventoried but not independently rebuilt; dependency comparison used a verified lock-equivalent local installation rather than fresh registry downloads. Both the initial sandbox-limited signature check and the subsequent passing scoped read-only check are retained. Windows/Linux still have less hands-on testing than macOS. Historical 231 runtime/artifact evidence is not relabeled as 232.

## Other channels remain separate

Production iOS and Mac App Store **1.0.1 (230)**, manual-release settings, and the last verified artwork/Duo/review state remain as recorded in [Session 74](2026-11-02-tasks-session-74-release-checkpoint.md). This direct release did not change those Apple submissions. Dev/Beta [draft #384](https://github.com/cbremer/specdown/pull/384) remains unsigned inspection preparation; Mac Beta association, matching profiles, scoped signing/upload and physical acceptance remain pending.

The canonical owner checkout/Xcode project remains at `9d27fc1a6961e29c86def43cee17c6fbb7d66db1`. No Store version, Apple account, owner key or installed app was changed for this handoff.

## Retained evidence

Under canonical `ios/DerivedData/release-followup-20261102/`:

- `direct-232-artifacts/VERIFIED.json`: prepublication artifact clearance; SHA-256 `f5c1413a32f2bffb11683d3dc5c25a1a04eb4449b457259dc45dd6ae9771a62d`.
- `direct-232-artifacts/public-verification.json`: all ten public assets matched; SHA-256 `e355c29c5fc48d1dc81d4f191aee4b0f04e12758be4f29c083a346a8c5f43e1a`.
- `direct-232-artifacts/latest-feed-verification.json`: latest-release identity and all three latest-feed routes matched 232.
- `direct-232-final-run.json` and `direct-232-final-approvals.json`: completed run and separate human approvals.
- `direct-232-release-notes-final.md`: published desktop-specific notes, including macOS 13+ and the Windows/Linux testing limitation.

Raw logs, account captures and signing material remain outside the public repository.
