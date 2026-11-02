# Session 45: native open feedback and saved-tab recovery

Date: 2026-11-01. Scope: WK-31 and WK-32, isolated from the canonical phone checkout and the previously delivered Mac build.

## Problem and resulting behavior

Native file reads could fail before the shared viewer received a document, leaving only a log entry. A missing saved startup file offered Locate but no explicit way to stop reopening it. Saving a different accepted tab could also overwrite the unresolved startup reference accidentally.

The desktop direct and Mac App Store shells now show persistent, accessible feedback for rejected native opens and manual refreshes, including the 8 MiB limit. Existing accepted content remains visible. Each failed startup entry offers three distinct actions:

- **Locate…** opens the native file picker. Cancellation keeps the entry and controls available. A selected replacement replaces the saved startup reference only after renderer admission.
- **Dismiss** hides this notice for the current page load. It does not change the saved session; the file may be offered again on relaunch.
- **Stop reopening** removes only that unavailable saved startup entry. It does not delete the original file, annotations, recent-file history, grants, or other saved entries.

Multiple failures remain separate, including identical display names. Session saves retain unresolved entries until acceptance or explicit Stop reopening. A rejected document or full tab list does not silently remove its saved startup reference. Failed persistence retains the previous in-memory and on-disk value; the control stays available for retry.

## Authority and lifecycle

`desktop/open-recovery.js` retains paths and exact saved-entry identities in the main process. Renderer recovery actions carry an opaque ID and an allowlisted action, with no path or filesystem authority. Records bind to the receiving webContents, main frame and navigation generation. The main process rejects forged, stale, replayed, wrong-frame, loading-frame and closed-window requests. Native picker results are revalidated before recording any new grant. Navigation, process loss, superseded attempts, successful recovery and window closure retire old controls.

Strict file-open receipts retain their existing bounded, expiring, one-use acknowledgment checks. An optional main-only context and validated result callback associate a renderer admission with its original startup entry; the renderer cannot supply that context. Actual acceptance still gates native and app recents. Authorized path-bookmark reads now return a receipt through the same protocol; accepted, rejected and superseded bookmark recalls report their outcome. Moved bookmark paths use the canonical authorized path for the opened tab while the main process retains the original requested reference for recovery accounting.

Session writes also carry a private preload nonce issued for each successful restoration. The main process seeds retained entries and sends the nonce before any cold Finder or restored-file delivery. Old queued saves cannot overwrite a newer session, including when a navigation reuses the same native frame object. The renderer-facing `saveSession(tabs)` interface is unchanged.

Recovery records are bounded at 256 per page load; saved references are retained even if the notice bound is reached. The normal viewer tab limit remains 10. This change does not migrate annotation identities, clear user data, expand filesystem capabilities, or enable deferred iOS annotations. Native iOS uses its existing file-error presentation; this desktop bridge is inactive there.

## Validation and evidence

Implementation base: `eed62c9911d0477386c8dc3fd1a76a6a2db498f1`. Version/build metadata is unchanged in this logical fix. All fixtures use disposable synthetic files and state; no live app store or user document was read.

- Baseline negative control against the unchanged base: six expected failures and two passing strict-acknowledgment controls across direct and MAS modes. The failures demonstrate missing visible feedback and lost unresolved references after a session save or rejected admission.
- Full required Jest CI/coverage gate: **1,260 tests in 72 suites passed**. The three new suites add 75 cases across actual native main/preload wiring, the recovery protocol and renderer controls. Two additional receipt regressions cover response admission and main-held context. Existing renderer recovery tests now exercise the opaque-ID contract.
- ESLint with zero warnings, TypeScript checks, and the production web build passed. The existing Vite large-chunk advisory remains informational.
- Independent source review and synthetic probes passed: 134 focused tests, 18 protocol/nonce/rollback probes and six actual renderer/receipt/recovery bookmark probes. Replacing the bookmark implementation with the original base produced four expected failures and two passing safety controls. Review caught and corrected queued stale-session saves and the alternate bookmark-admission path before freeze.
- Targeted coverage includes mixed sessions, exact-entry removal, same names, disk-write failure, canceled/stale pickers, positive replacement admission, tab rejection, old saves across same-frame reload, accepted/rejected/superseded path bookmarks, crash/close cleanup, untrusted frames, detached renderer controls, truthful failure feedback, and literal filename rendering.

Local evidence is under `ios/DerivedData/store-open-recovery-20261101/`: `baseline-negative.log`, `focused.log`, `full-tests.log`, `lint.log`, `typecheck.log`, `build.log` and the final candidate manifest. These are local build/review evidence, not Apple processing or owner acceptance.

An integrated signed candidate, native screenshots/relaunch proof, owner review and any TestFlight/App Review actions remain separate gates. The previously delivered 1.0.1 (228) artifacts and canonical checkout are unchanged by this worktree. The integrating release preparation selects the next build number separately.
