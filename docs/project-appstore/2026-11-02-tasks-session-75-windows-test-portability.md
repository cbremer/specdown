# Session 75 — Windows coverage for Mac packaging contracts

## Problem and scope

The Windows job in [desktop release run 41496140750](https://github.com/cbremer/specdown/actions/runs/41496140750) failed 11 of 1,371 tests. Three synthetic Mac bookmark cases used host-dependent path operations with macOS bookmark strings; eight embedded-profile cases assumed that Windows implements POSIX `chmod` mode bits. The other 76 suites passed. These failures do not demonstrate a Windows application defect.

The correction starts at `3759f7606f9ded1e002065343274465d2cab6575`. It changes tests and PR CI only, plus this handoff/index. Application source, native shells, package versions, dependencies, packaging/signing guards and release workflow permissions remain byte-identical. Production Store **1.0.1 (230)** remains unchanged. The existing **v0.0.231** tag is immutable; this correction needs the next reviewed direct-desktop version before another release attempt.

## Correction

- The Mac bookmark suite explicitly uses POSIX paths within its own Jest module scope. The separate direct-desktop capability suite still uses the real host filesystem and path implementation, including on Windows.
- The original embedded-profile security assertions now share one contract. Every OS runs it against a small POSIX filesystem model. Linux/macOS additionally run the same contract against the real kernel. Only this extra real-POSIX integration block is skipped on Windows; BOM and installer-hook assertions continue on all platforms.
- The model represents shared inodes, link counts, descriptor identity after unlink/replacement, symbolic-link resolution, `O_NOFOLLOW` errors and permission bits. Five independent mechanism tests verify those semantics. An additional contract case rejects profile-path replacement while the descriptor is open. Existing private-source byte/mode protection, symlink/hardlink rejection, bundle traversal and signature-verification failures remain asserted.
- A separate **Windows Tests** PR/main job runs the full coverage suite and real Windows file-watcher checks. The required **Lint & Test** check keeps its existing name and Ubuntu runner. Both jobs retain read-only permissions; no signing/release authority is added.

## Evidence and limits

Local validation passed: **1,429 tests / 79 suites** with the existing coverage threshold; focused portability/direct-access checks **83 cases**; lint and typecheck. No application rebuild was needed for this test-only correction. A real GitHub Windows run remains the acceptance gate for Windows behavior; a Mac run of the model alone is not that evidence.

Evidence is retained under this worktree's `ios/DerivedData/windows-test-portability-20261102/`: original release failure log and excerpt, `baseline.json`, full/focused check logs and a source-invariance/hash manifest. The model is a focused test fixture, not an alternate production filesystem or proof of Apple signing/runtime acceptance. No owner credentials, profile contents, installed apps or saved sessions were accessed or changed.
