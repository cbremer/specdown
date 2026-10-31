# Session 20 — corrected desktop security artifacts and recovery handoff

Date: 2026-10-31 (America/Los_Angeles).

## Separate frozen candidates

The desktop/web application candidate is `f2715df42edd96e77841bd7ce7ca859f28aee864`, on `codex/desktop-atomic-refresh`, following the final mobile preparation `e7b842b`. [Session 19](2026-10-31-tasks-session-19-desktop-refresh-acceptance.md) records the newly reproduced desktop refresh rejection and its fix. This handoff adds documentation only; its application and packaging sources must match that tested application commit.

The owner-selected iOS **1.0.1 (228)** signing packet remains frozen at **`e7b842bfee5e360b9e9aaea8285c79c28f6fccbc`** under `/Users/chrisbremer/Documents/SpecDown/ReleaseArchives/release/ios-1.0.1-228-20261031/`. The desktop correction does not replace that packet or claim a new iOS build/runtime pass. Continue using its exact Xcode project and handoff for owner signing and physical TestFlight acceptance.

## Correction and package evidence

The new desktop refresh regression is independently reviewed. Nine negative-control cases fail on the prior source while two valid controls pass. The corrected full suite passes **1,007 tests / 60 suites**, with 67 focused cases and an independent 53-case refresh/context/iOS-boundary review. Lint, type checking and the production web build pass. These are synthetic source checks, not a new native desktop interaction claim.

Refresh unsigned universal direct DMG/ZIP and MAS app artifacts from the corrected source and its rebuilt 110-file web bundle. Use only existing local Electron 44.10.1 archives and the previously verified universal bookmark addon; disable signing identity discovery, notarization, dependency/native rebuilds and publishing. Scrub signing/Apple/publication credentials from the packaging child environment, use explicit null identities and `--publish never`, restore the original ignored addon, and preserve all earlier output directories.

Current output/report prefix: `/private/tmp/specdown-f2715df-desktop-`. The exact manifest and report are `/private/tmp/specdown-f2715df-desktop-manifest-20261031.json` and `/private/tmp/specdown-f2715df-desktop-report-20261031.md`. Their independent review must bind the manifest hash to the actual application commit before the owner packet or preparation PR is published. The earlier `/private/tmp/specdown-e7b842b-desktop-*` packages remain provisional historical artifacts because they predate the correction.

Package verification passed: both ASARs match all **125 packaged source files / 110 web files**. All **111 application** and **34 packaging-source** hashes stayed fixed. Actual Electron is **44.10.1**, and desktop validation version is **0.0.228**. Every native Mach-O remains byte-identical to the prior artifact and universal (**14 direct / 10 MAS**); all packaged dependency bytes match (**8,621 direct / 8,555 MAS**). Direct includes updater 6.8.11 and its feed; MAS excludes both. DMG and ZIP integrity checks pass, and the original ignored addon is restored.

| Artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| Direct ASAR | `6624c0b64bc09c95d6bef396f3146256cdb3640a1f1d88bf13b39f2a7305cc59` |
| MAS ASAR    | `4bc4f5611c20dcb928a2b4b271fc55968a0e2a515e1377e903d8fbf7cccefecb` |
| Direct DMG  | `82dc402f09d73e714ae40f08c36fc1e9cc2ec9bb28a5e2d85c71a81cdd4b70b8` |
| Direct ZIP  | `409fb15e64a8c687b5921d59d3787d2da54fc5246e08d236328d7c8a16026d13` |

The frozen artifact manifest SHA-256 is `f9982a7bba7123ac1f1260e5c42cdb71d3246fc382859a3f93b9b4195f75fc64`. Independent artifact review passed and binds that manifest to `f2715df`; its gate is `/private/tmp/specdown-f2715df-desktop-independent-review-20261031.json`. These package checks do not establish new runtime interaction, signed sandbox behavior or Store readiness.

The durable review packet is `/Users/chrisbremer/Documents/SpecDown/ReleaseArchives/release/desktop-security-review-20261031/`. It retains pinned application and documentation source, extracted source and generated web files, complete unsigned direct/MAS apps, DMG/ZIP, the verified universal addon, packaging scripts and evidence. `CAPTURE.json`, `SHA256SUMS.json` and `VERIFIED.json` separate the application revision from the documentation-only handoff and record file hashes plus safe internal bundle symlinks. Never replace an earlier owner packet or mistake these unsigned products for signed Store acceptance.

## WK-18 proposal and remaining gates

The [proposed annotation recovery contract](2026-10-31-spec-annotation-recovery-contract.md) now connects source identity, uncertain reconnection, explicit legacy association, transactional persistence, conflict-safe undo, complete backup/restore and private versus portable export. Its acceptance matrix is **proposed and unimplemented**. It explicitly distinguishes localStorage UTF-16 string fidelity from original file bytes, rejects localStorage read/check/set as a transaction, and requires measured platform budgets before activation.

WK-18 remains open. Inactive inspector preparation #325 is outside the runtime candidate; no live note store is read, migrated or modified. Develop any implementation through an end-to-end synthetic adapter flow and fault/concurrency checks, retaining native-iOS annotation disablement.

Native/main-process and OS recent-file lists still record a readable file before renderer acceptance; the renderer list now respects rejection. This residual requires a separate native acknowledgment contract and is not claimed fixed. Owner release-environment configuration, existing Mac keys/signing, signed MAS sandbox/bookmark QA, physical iPhone/iPad TestFlight acceptance, Store submission and public release remain separate gates. No credentials, Apple account actions, other computers, runtime launches or public deployment are part of this follow-up.
