# Session 20 — corrected desktop security artifacts and recovery handoff

Date: 2026-10-31 (America/Los_Angeles).

**Historical evidence — desktop source `f2715df`, validation version 0.0.228.** Retained from PR #334 (`a09ce3d`); these artifacts are not the current build 230 candidate. [Session 25](2026-10-31-tasks-session-25-desktop-open-acceptance.md) subsequently closed the desktop recents acknowledgment gap recorded below. [Session 52](2026-11-01-tasks-session-52-signed-229-handoff.md) records historical signed 229 delivery; [Sessions 54](2026-11-01-tasks-session-54-release-230.md) and [55](2026-11-01-tasks-session-55-canonical-230-preparation.md) identify the current 230 preparation. No current signing, runtime or Store acceptance is established by this older packet.

## Historical frozen candidates

At this checkpoint, the desktop/web application candidate was `f2715df42edd96e77841bd7ce7ca859f28aee864`, on `codex/desktop-atomic-refresh`, following the final mobile preparation `e7b842b`. [Session 19](2026-10-31-tasks-session-19-desktop-refresh-acceptance.md) records the newly reproduced desktop refresh rejection and its fix. This handoff adds documentation only; its application and packaging sources must match that tested application commit.

The historical owner-selected iOS **1.0.1 (228)** signing packet was frozen at **`e7b842bfee5e360b9e9aaea8285c79c28f6fccbc`** under the private owner archive `release/ios-1.0.1-228-20261031/`. The desktop correction does not replace that packet or claim a new iOS build/runtime pass. Keep this older packet as historical evidence. Current local development uses the canonical project described in [Session 21](2026-10-31-tasks-session-21-canonical-local-checkout.md); current build 230 preparation is recorded in Session 55.

## Correction and package evidence

The new desktop refresh regression is independently reviewed. Nine negative-control cases fail on the prior source while two valid controls pass. The corrected full suite passes **1,007 tests / 60 suites**, with 67 focused cases and an independent 53-case refresh/context/iOS-boundary review. Lint, type checking and the production web build pass. These are synthetic source checks, not a new native desktop interaction claim.

At that checkpoint, unsigned universal direct DMG/ZIP and MAS app artifacts were refreshed from the corrected source and its rebuilt 110-file web bundle. Packaging used only existing local Electron 44.10.1 archives and the previously verified universal bookmark addon, with signing identity discovery, notarization, dependency/native rebuilds and publishing disabled. Signing/Apple/publication credentials were excluded from the packaging child environment; explicit null identities and `--publish never` were used, the original ignored addon was restored, and earlier output directories were preserved.

Historical output/report prefix: `specdown-f2715df-desktop-`. The retained manifest and report were named `specdown-f2715df-desktop-manifest-20261031.json` and `specdown-f2715df-desktop-report-20261031.md`; local temporary locations are omitted. The independent review recorded below binds the manifest hash to the actual application commit. Earlier `specdown-e7b842b-desktop-*` packages remain provisional historical artifacts because they predate the correction.

Package verification passed: both ASARs match all **125 packaged source files / 110 web files**. All **111 application** and **34 packaging-source** hashes stayed fixed. Actual Electron is **44.10.1**, and desktop validation version is **0.0.228**. Every native Mach-O remains byte-identical to the prior artifact and universal (**14 direct / 10 MAS**); all packaged dependency bytes match (**8,621 direct / 8,555 MAS**). Direct includes updater 6.8.11 and its feed; MAS excludes both. DMG and ZIP integrity checks pass, and the original ignored addon is restored.

| Artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| Direct ASAR | `6624c0b64bc09c95d6bef396f3146256cdb3640a1f1d88bf13b39f2a7305cc59` |
| MAS ASAR    | `4bc4f5611c20dcb928a2b4b271fc55968a0e2a515e1377e903d8fbf7cccefecb` |
| Direct DMG  | `82dc402f09d73e714ae40f08c36fc1e9cc2ec9bb28a5e2d85c71a81cdd4b70b8` |
| Direct ZIP  | `409fb15e64a8c687b5921d59d3787d2da54fc5246e08d236328d7c8a16026d13` |

The frozen artifact manifest SHA-256 is `f9982a7bba7123ac1f1260e5c42cdb71d3246fc382859a3f93b9b4195f75fc64`. Independent artifact review passed and binds that manifest to `f2715df`; its gate is the retained `specdown-f2715df-desktop-independent-review-20261031.json` report. These package checks do not establish new runtime interaction, signed sandbox behavior or Store readiness.

The durable historical review packet is retained privately as `release/desktop-security-review-20261031/`. It retains pinned application and documentation source, extracted source and generated web files, complete unsigned direct/MAS apps, DMG/ZIP, the verified universal addon, packaging scripts and evidence. `CAPTURE.json`, `SHA256SUMS.json` and `VERIFIED.json` separate the application revision from the documentation-only handoff and record file hashes plus safe internal bundle symlinks. Never replace an earlier owner packet or mistake these unsigned products for signed Store acceptance.

## WK-18 proposal and remaining gates

The [proposed annotation recovery contract](2026-10-31-spec-annotation-recovery-contract.md) now connects source identity, uncertain reconnection, explicit legacy association, transactional persistence, conflict-safe undo, complete backup/restore and private versus portable export. Its 36-case acceptance matrix remains **proposed and unimplemented**. It explicitly distinguishes localStorage UTF-16 string fidelity from original file bytes, rejects localStorage read/check/set as a transaction, and requires measured platform budgets before activation.

WK-18 remains open. Inactive inspector preparation #325 is outside the runtime candidate; no live note store is read, migrated or modified. Develop any implementation through an end-to-end synthetic adapter flow and fault/concurrency checks, retaining native-iOS annotation disablement.

At this historical checkpoint, native/main-process and OS recent-file lists still recorded a readable file before renderer acceptance while the renderer list respected rejection. That residual was subsequently corrected by the scoped acknowledgment contract in [Session 25 / PR #337](2026-10-31-tasks-session-25-desktop-open-acceptance.md); it is not an open build 230 defect. Owner release-environment configuration, existing Mac keys/signing, signed MAS sandbox/bookmark QA, physical iPhone/iPad TestFlight acceptance, Store submission and public release remain separate gates. No credentials, Apple account actions, other computers, runtime launches or public deployment are part of this follow-up.
