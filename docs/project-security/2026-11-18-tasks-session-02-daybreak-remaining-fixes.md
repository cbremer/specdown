# Session 02: remaining Daybreak fixes

Date: November 18, 2026

## Scope and baseline

The owner authorized fixing the two findings left open by the existing Daybreak
reconciliation, testing the changes and opening a PR. No new Daybreak scans,
cloud fix jobs or release actions are part of this work.

The original diagnosis and failing regressions use main
`566310245a442137ed9641d045786768d574f93e`. Concurrent PR #443 covers document
editing/import, build retention and channel work. When that PR merged, this
isolated branch advanced to `b0f700c3ec22fd2f100a21fe540a767201c181c9` before
full validation. None of the fix files overlapped its changes. The other chat's
primary checkout, generated apps and signing configuration were left alone.

## Confirmed causes

- **Nested recovery archives** (`acf_18ea018c98fa45056c54139fa6c8768e`): the
  transport limits its outer entries, but restore expands private-state archive
  metadata before enforcing store capacity. Repeated scans of the growing
  archive list amplify the work. Capacity must be checked before nested
  reconstruction, with indexed lookup and running totals.
- **Failed direct-desktop grant persistence**
  (`acf_9a2e232ed28720c5a3119478d62ee710`): `direct-access.js` clears pending
  grants without checking the transactional settings store's success result.
  A failed write leaves the old store intact but drops the newly selected file's
  session authorization. Pending changes must survive until persistence is
  acknowledged, including a subsequent forget operation.

## Changes

Restore preflights all outer private-state metadata before constructing or
hashing nested history. It caps aggregate metadata work at 1,024 entries,
reserves space for the retained input container within the existing 256-archive
store limit, and bounds cumulative reconstructed bytes by the existing 96 MiB
budget. Duplicate references consume work and byte budgets but do not consume
extra unique-archive slots. ID-indexed lookup and running inventory totals replace
growing-array scans. Every duplicate payload still has its digest checked;
first-seen order and exact original backup bytes are preserved.

Direct-desktop grants and pending removals remain in session memory until
`store.set` explicitly acknowledges success. False, throwing and unacknowledged
writes remain retryable. Forgetting a grant immediately suppresses it in the
current session, including while persistence is unavailable. Existing path and
canonical-target authorization checks remain unchanged.

A failed removal cannot change an existing on-disk grant across restart until a
write succeeds. This inherited durability limit is explicit; a session-only
success is not a persistence claim.

## Validation

- New regressions: 11 of 15 recovery cases and 11 of 12 direct-grant cases fail
  on the original baseline. Compatibility controls pass both versions.
- Focused groups: 41 recovery tests and 28 direct-access/security tests pass.
- Latest-main integrated suite:
  `npm test -- --runInBand --roots ./tests --coverage` — **1,586 tests in 96
  suites pass**, including the required desktop coverage thresholds.
- Scoped lint, typecheck, shared-viewer production build and touched-file
  formatting pass. Dependency installation used the exact lockfile with
  `npm ci --offline --ignore-scripts --no-audit --no-fund`.
- Codex `daybreak_release_evidence` completed an independent review of the
  two production changes and regression tests against `b0f700c`, with no
  blocking or actionable finding. Additional memory-only checks cover the
  60,000/60,001 inventory boundary, malformed metadata, async/held grants and
  no-probe denial. The final PR identifies the reviewed commit.

The successful suite retains existing SQLite/listener warnings and a subprocess
`fatal: Needed a single revision` diagnostic. The web build retains its large
chunk warning. These are not reported as new failures or silently suppressed.
No application version, dependency, Swift/Objective-C source, workflow or release
control was changed by these fixes.

All recovery and permission tests use synthetic data. Passing local checks do
not establish physical-device behavior or published-binary status. Daybreak's
two findings remain open until the fixes land and their merged state is verified.
