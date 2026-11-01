# Session 25 — desktop open acknowledgment and recents

Date: 2026-10-31 (America/Los_Angeles).

## Scope and acceptance boundary

This isolated desktop follow-up starts at `f2715df42edd96e77841bd7ce7ca859f28aee864` (#333) on `codex/desktop-open-acceptance`. Session 19 fixed renderer refresh/new-open acceptance but deliberately left main-process and OS recent documents behind: `openFileByPath` recorded every readable document before the renderer could reject parsing, resource limits or the tab cap, even when no receiving window existed.

Each newly delivered desktop open now carries a main-issued random receipt. The main process retains the resolved, already-authorized path and binds the receipt to its receiving webContents, exact main frame and document lifecycle. The renderer reports only the receipt and the strict `createTab(...) === true` result, immediately after synchronous tab admission and before unrelated recent-list UI/persistence. Acceptance means prepared/sanitized content was admitted to a tab; it does not promise every asynchronous Mermaid render has finished.

Only a valid, current, one-use accepted receipt calls the existing `addRecentFile` path for the main menu/store and OS recent documents. False results consume receipts without a write. Missing, expired, malformed, duplicate, replayed, wrong-window/frame and old-document results cannot add recents. Main-frame document navigation, renderer process loss, window closure and receiver replacement invalidate outstanding receipts; same-document and subframe navigation do not. Pending receipts are capped at 256 and expire after 30 seconds, with expired entries pruned on delivery/acknowledgment. Independent accepted opens remain eligible after another open is rejected; accepted acknowledgments update recency in receipt-arrival order.

The acknowledgment never accepts a filesystem path, probes or rereads a document, grants access, or takes ownership of watches. Dialog/Finder/drop grants and existing resource policy remain tied to the original user intent and authorized read, including when content is later rejected. They are not silently revoked by renderer refusal. Existing watch/manual-refresh, bookmark-read, session and source-identity semantics are unchanged.

## Validation

Evidence lives in the canonical checkout's ignored `ios/DerivedData/desktop-open-ack-20261031/` directory. All files and stores used by the tests are disposable synthetic fixtures; Electron/OS operations are mocked.

- Exact prior `f2715df` main-process negative control: three new recents regressions fail, while the bounded-read positive control passes. `negative-control.log` and its JSON capture the command and baseline main-file hash. An initial module-resolution harness failure is preserved separately and is not counted as a product failure.
- Focused suites cover actual main-process delivery/receipt plumbing, preload payload restriction, real renderer admission/refusal, asynchronous Mermaid admission, raw/preview refresh preservation and existing bridge/security behavior. Startup session restore is delivered but not recorded until accepted. Wrong frames/windows, frame replacement, modern navigation-event details, false/replayed/malformed receipts, expiry/cap, send failures and old receiver listener cleanup are covered.
- Existing direct and MAS tests that previously used OS recents as a proxy for reading now assert the authorized bounded read itself. The moved MAS-path regression still verifies an active scope during probing and reading, and release afterward; no receiving window means no recent-document update.
- Full CI-style regression passes **1,048 tests / 64 suites** with required coverage. The broader focused run passes **160 tests / 9 suites**, and the MAS channel suite adds **13 passing tests**. Lint, typecheck and the 110-file production web build pass. Independent source review and a separate rerun of the four new suites plus MAS checks pass **54 tests / 5 suites**. The adjacent local verification report binds source and evidence hashes; no native runtime was run.

## Remaining boundaries

The frozen mobile iOS **1.0.1 (228)** candidate remains `e7b842bfee5e360b9e9aaea8285c79c28f6fccbc`. Its native accepted-load title/recents callback was already guarded; this correction neither edits Swift nor replaces its owner signing source, Xcode settings, bundle or runtime evidence.

This is future desktop recents correctness, not a historical cleanup or a transaction across OS and app persistence. OS updates and JSON persistence remain best effort; an absent acknowledgment conservatively leaves recents unchanged. The existing Finder-open-during-window-loading delivery gap remains: only opens arriving before a window exists are queued. A loading or unavailable receiver is not treated as acceptance, and this patch does not add a retry/delivery queue. Navigation-start invalidation can also conservatively discard a pending receipt when later navigation is canceled.

No native runtime, live user document/store, simulator/physical device, signing credentials, Apple account, keys, upload or other computer was accessed. Signed MAS sandbox/bookmark behavior and OS UI interaction still need their own acceptance evidence. No artifacts are refreshed by this source change; earlier desktop packets remain tied to their recorded application revisions. One logical change should be committed and reviewed separately, following the repository's rebase-and-merge discipline.
