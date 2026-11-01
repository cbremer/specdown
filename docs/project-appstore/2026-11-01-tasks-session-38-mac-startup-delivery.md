# Session 38: Mac startup document delivery

Date: November 1, 2026. Status: **Reviewed correction; signed local quit/relaunch passed.** Base `b512db3` (Session 37's consistent Mac Store version), branch `codex/mas-startup-delivery`. Root phone candidate remains `729258b`.

## Reproduced failure

The first development-signed Mac Store 1.0.1 (228) build opened synthetic documents correctly. After a full quit/relaunch with the same isolated QA profile, the saved tab did not appear. The generated runtime log recorded `File open was not delivered; recents remain unchanged.` The existing persisted bookmark reopened without a picker, proving the grant survived. This distinguishes a delivery failure from missing file permission or lost bookmark data.

`did-finish-load` can run while Electron still reports the main frame as loading. The accepted-open receipt mechanism properly refuses delivery during that interval. Startup restoration must wait until that same successfully loaded, trusted frame is ready, rather than weakening the receipt guard.

## Correction and boundaries

The correction records a successful trusted frame and navigation generation, and drains startup work only after main-frame loading stops. It consumes each successful navigation once and invalidates work on navigation, failure, crash, destruction or window close. A genuine View > Reload may restore once for its new generation. Finder opens during loading remain queued. Receipt authority, sender/frame checks, expiry, single-use semantics and rejection behavior remain unchanged.

This change is separate from Session 37's Store version metadata and MAS About bridge. No signing/profile settings, App ID capabilities, dependencies, shared viewer, direct installed app, owner documents or live notes are modified. Tests use synthetic fixtures; the signed app runs with the same isolated test-data switch on every launch.

## Validation

Full **1,183 tests / 69 suites**, lint and type checking passed. The focused four-suite run passed 82 tests, including 26 new direct/MAS startup cases. Twelve independent cases passed; eight fail on baseline `b512db3`. Independent source review found no blocking issue. The receipt helper is byte-identical to the baseline.

The new arm64 development-signed app was packaged with verified physical dependencies. Native metadata is **1.0.1 (228)**, bundle ID `com.mosaicpando.specdown`, macOS 13 minimum. Deep/strict signature verification, explicit expected certificate-leaf requirement, exact embedded development profile and sandbox entitlements passed. Packaged source validation matched 126 application/web files and 8,555 dependency files; updater remains absent. Independent review extracted the reviewed main/preload/receipt bytes from the ASAR and matched their hashes. The ASAR SHA-256 is `3cd53b134cd8d296b617afe4e6ab4d79c714fbf0852dfb8270796e44a33806a6`.

Actual corrected-app startup restored synthetic `sample-a.md` automatically, including its Mermaid diagram and ORCHID/MAPLE/CEDAR markers. The app was fully quit and relaunched with the same isolated QA profile; automatic restoration passed again, without a file-picker or bookmark click. Recent Documents shows only the accepted sample, not the rejected oversized file. About displays `Version 1.0.1 (0.0.228)`. The new redirected console has no rejected startup-delivery message. This is observed native runtime acceptance on this Mac, not a claim about Intel, minimum macOS or Store-distribution execution.

Evidence is retained under canonical `ios/DerivedData/mas-local-startup-20261101/`: source/package/signature manifests, test and review logs, `runtime-acceptance.json`, UI captures, and `preservation-after.json`. All 468 preexisting canonical file hashes, 286 installed direct-app entries and four original MAS-profile metadata records remained unchanged after runtime testing. Only the two new session handoffs and additive index rows are subsequently copied into root documentation. No old profile contents were read.

The first signed artifact and its failed-startup evidence remain intact under `ios/DerivedData/mas-local-1.0.1-228-20261101/`; it is historical and must not be used as the current candidate.

## Owner local-test handoff

The current app is left running with synthetic test data. For later launches use `ios/DerivedData/mas-local-startup-20261101/Launch SpecDown Store Test.command` from the canonical repository. It opens the exact new bundle and supplies the same isolated QA profile. Opening the bundle directly without that switch could use the older MAS profile. Existing direct `Specdown Desktop` 0.0.193 remains in Applications with a separate bundle identity and unchanged bytes.

Working source stays under `.claude/worktrees/specdown-mas-local-20261101/` on `codex/mas-startup-delivery`. Version metadata is one logical commit (`b512db3`); startup delivery is the following logical commit. The final commit and artifact association are recorded in evidence `COMMIT.json`. Root phone source remains `729258b`; no source promotion, remote push, merge or release is part of this handoff.

## Remaining release gates

This is local development testing. No Store-distribution package, upload, TestFlight/App Review submission or public release is performed. Owner acceptance, Intel/minimum-macOS coverage and the later Store-distribution candidate remain separate. The independent rejected-open feedback issue is WK-31.
