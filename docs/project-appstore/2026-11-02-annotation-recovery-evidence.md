# Annotation identity and recovery evidence — development wave 102

This is development acceptance evidence, not release authorization. Work began at
`63c2e8af12fbc2aae0ce7a2a16cabdcc32e3a07d` in the isolated
`codex/wave-102-recovery` worktree. `555ebd0` was the first review checkpoint;
`c44321a` is the complete functional checkpoint used by the runtime replays below.
The followup `44c57f1` fixes repeated protected-replacement history recovery.
`e30f062` verifies retired lineage and pages all retained history; the final
documentation/helper commit adds this report and nine-phase transaction probes.
The parent integrates and folds the logical workflow for publication; this worker
has not pushed, opened a PR, merged, signed, installed or released anything.

The default editor now uses the transactional authority. Legacy filename buckets
are immutable unassigned archives. This is a complete source workflow through
capture, preview, explicit association/reconnect, private export/file reselection,
protected replacement and operation-specific undo. The table below separately
records what is tested and what still requires platform acceptance; it does not
claim that 36 rows passed merely because a suite passed.

Read [implementation decisions](2026-11-02-annotation-recovery-decisions.md) for
backend, exact compound budgets, retention, source policies and coexistence rules.
No actual user notes, grants or profiles were read or migrated. All runtime files,
profiles, grants, registries and failures were newly created synthetic fixtures.
Old disposable prototype stores were left intact when enrollment hardening made
them unsupported.

## Verification commands and observed results

From the assigned worktree:

```sh
npm test -- --runInBand
npm run test:coverage -- --runInBand
npm run lint
npm run typecheck
npm run build
```

At `c44321a`: 83 suites / 1,429 tests passed, coverage's same 1,429 passed, full
lint and types passed, production build passed. Desktop main coverage was 72.44%
statements, 62.95% branches, 64.49% functions, 75.22% lines; enforced thresholds
passed. Renderer coverage is not meaningful with the existing eval-based loader.
Logs: `/private/tmp/recovery-{tests,coverage,lint,types,build}-final.txt`.
At final source `e30f062`, all 83 suites / 1,433 tests passed with coverage;
full lint, types and production build passed again. Logs:
`/private/tmp/recovery-{coverage,lint,build}-e30f062.txt`,
`/private/tmp/recovery-retired-types.txt`.
The repeated-replacement regression first failed with the reviewer's reported
unresolved-history error, then 50 focused tests plus types/lint passed at
`44c57f1`. Logs: `/private/tmp/recovery-repeat-replace-{red,green}.txt`.

Jest also emitted the existing git revision probe diagnostic, experimental SQLite
notice and process listener warnings; none caused a failed suite. Vite emitted
its config-loader advisory and large-chunk warning. These are recorded separately
from passing checks and are not release/runtime acceptance.

The configured stock Electron 45.1.0 executable was supplied by the icon worker at
`/private/tmp/specdown-icons-electron45/runtime/Electron.app/Contents/MacOS/Electron`.
Its official ZIP SHA-256 was independently verified by that worker as
`002b71efcf90e247317d3da486f2d4e51860e9c2889d49f33e229ab2268b0f3b`.
These commands used that executable, a fresh disposable userData per invocation,
and a restarted isolated Vite server on 5192:

```sh
npm run dev -- --host 127.0.0.1 --port 5192
node scripts/test-annotation-recovery-crash.js
"$RECOVERY_ELECTRON" scripts/test-annotation-recovery-runtime.js
"$RECOVERY_ELECTRON" scripts/test-annotation-recovery-windows.js
"$RECOVERY_ELECTRON" scripts/test-annotation-recovery-faults.js
"$RECOVERY_ELECTRON" scripts/test-annotation-recovery-file-origin.js
node scripts/test-annotation-recovery-browser.js
```

`RECOVERY_ELECTRON` above denotes the executable path just given. The crash
orchestrator accepts the same variable. HTTP helpers accept
`SPECDOWN_RECOVERY_TEST_URL` for integration replay. The browser helper connects
only to the dedicated synthetic Chrome debugger on 9302, creates new browser
contexts, and closes them afterward. It does not inspect an owner's browser.

Runtime evidence abbreviations used in the matrix:

- **C** — actual Chrome 156.0.8078.74 UI/download/reselection:
  `/private/tmp/recovery-browser-c44321a.txt`. Captured legacy/raw exactness true;
  11,218-byte actual private file; original supplied container export matched
  downloaded bytes exactly; fresh context staged four archives, zero documents,
  zero bindings; protected recovery and historical undo retained only the newer
  edit, with one reported conflict and zero imported bindings. The actual modal
  screenshot was visually inspected. Its path is included in the log.
- **P** — actual editor process kill/restart:
  `/private/tmp/recovery-crash-c44321a.txt`. Hook armed after actual editor/view
  readiness, on the intended durable request transaction. SIGKILL after prepare
  and after commit-before-ack; each fresh process reopened IndexedDB, used visible
  recovery actions, produced one `durable once` note and one add operation,
  acknowledged true, no sessionStorage receipt. This proves persistent receipts,
  rather than reducer-only same-ID retry.
- **W** — two actual BrowserWindows sharing a fresh authority:
  `/private/tmp/recovery-windows-c44321a.txt`. Attach versus unrelated edit and
  undo versus later edit each yielded one winner / one conflict; loser draft
  retained and explicit retry; final A zero copies, B later edit intact, original
  archive two occurrences, one attach and one undo.
- **F** — actual IndexedDB failure/capacity probe:
  `/private/tmp/recovery-faults-e30f062.txt`. The helper was expanded after the
  c443 replay to exercise add, associate and restore separately. All nine injected
  native put failures at prepare/commit/ack yielded active-note/archive deltas
  0/0/1; failed prepare/commit preserved the complete active/archive state, and
  retrying acknowledgment did not duplicate. Read/clone failures, schema version change, stale connection,
  future reopen and missing enrolled root failed closed. A 16,777,216-byte opaque
  UTF-16 archive produced a 16,779,121-byte private file, restored through actual
  IndexedDB and exported again (16,787,382 bytes); over-limit input rejected.
  Post-case heap sample was 216,106,647 bytes, not a measured peak. These are
  synthetic exceptions at real transaction boundaries, not an OS disk-full test.
- **N** — production `file://` bundle / actual trusted preload:
  `/private/tmp/recovery-file-origin-c44321a.txt`. Synthetic authorized direct read
  issued a SQLite UUID descriptor, actual accepted tab/editor committed one native
  note with acknowledged request; closing source still allowed global recovery,
  actual Electron download completed to a 5,376-byte file, actual file-input
  reselection staged it into the occupied store without adding imported bindings.
  Existing document/binding/note stayed intact; two archives included one original
  container. This is not a signed MAS-provider test.
- **R** — generic real IndexedDB two-connection CAS, read-abort, same-ID retry,
  undo/reopen and code-unit/file-byte round-trip script:
  `scripts/test-annotation-recovery-runtime.js`; earlier stock45 result
  `/private/tmp/recovery-electron45.txt`. The exact-c443 P/W/F/N/C results above
  supersede this earlier checkpoint for the complete consumer workflow.

Integration followups after the original functional checkpoint:

- `6c9e606` makes the process-crash helper use `window.loadFileContent`, real
  annotation toggle/editor controls and the configured command palette. It waits
  for actual paragraph/identity/source-revision readiness. No bare source-module
  imports or fixed readiness delay can accidentally exercise a second HMR module
  graph. Actual integrated `SPECDOWN_RECOVERY_TEST_URL=http://127.0.0.1:5184`
  replay passed both SIGKILL boundaries, with one note/one operation after
  restart. Log: `/private/tmp/recovery-crash-public-api-5184.txt`.
- `8b92c48` tracks owned session-only MAS polling holds, rechecks the captured
  session capability on each read and keeps their annotation identity ephemeral.
  File/folder tests reject forged, foreign, released and forgotten holds; changing
  the public held-path property cannot authorize a different read. Focused native
  tests: 71 passed; types and scoped lint passed. The existing real-filesystem
  `node scripts/test-desktop-watchers.js` passed outside sandbox restrictions for
  all native, polling and MAS-style polling modes (12 checks each), including
  complete writes, three atomic inode replacements, deletion/recreation,
  independent subscriptions and final release. This is synthetic filesystem/
  session-grant evidence, not signed provider evidence. Log:
  `/private/tmp/recovery-watchers-session-fix.txt`.

Final locally executable T03/B10 replay closes the earlier helper evidence gaps:

- `/private/tmp/recovery-crash-cleanup-final.txt` runs three actual SIGKILL process
  boundaries against integrated port 5184. The new case first captures a synthetic
  immutable raw archive and commits a separate note through the actual editor,
  retains a later failed prepared draft, then uses the visible explicit discard
  action and kills at that metadata transaction's completion. A fresh process
  finds an acknowledged abandoned request with its staging command removed, the
  exact original raw archive and committed note/bindings unchanged, and the same
  active revision. The comparison baseline is an independently fsynced synthetic
  profile file; it is not an app receipt or reliance on session/localStorage
  durability. There are no separately stored chunks to garbage-collect in this
  root-transaction design.
- `/private/tmp/recovery-faults-replace-concurrent-final.txt` adds five actual IDB
  replacement cases to the nine save/associate/stage cases. Prepare and commit
  quota faults leave the complete old active/archive root unchanged; failed
  acknowledgment retains one atomically replaced root with one exact protective
  snapshot and retry creates neither another replacement nor another snapshot.
  Invalid protective bytes reject activation. A second real database connection
  edits after protective capture; stale replacement fails while that newer edit
  stays intact. Latest 16 MiB sample: first file 16,779,121 bytes, second file
  16,787,376 bytes, post-case heap sample 216,370,219 bytes (not peak memory).
- `tests/unit/document-context.test.js` now waits for the accepted tab's actual
  current annotation context before returning from `openDocument`, with a bounded
  timeout. This removes a fixed-delay assumption around real WebCrypto; all 30
  context tests passed, and scoped helper/test lint and syntax passed. Final full
  coverage run passed all 83 suites / 1,435 tests; log:
  `/private/tmp/recovery-coverage-final-test-closure.txt`.

Final B06 maximum-bound evidence and admission correction:

- `scripts/test-annotation-recovery-capacity.js` derives the largest accepted
  one-opaque-archive payload for its fixed journal/command shape: **33,290,194
  original invalid-UTF8 bytes**, plus 2,086 bytes of state metadata and the full
  256 KiB manifest reserve. One additional payload byte is rejected by both the
  reducer and an actual fresh IndexedDB prepared capture; active revision and
  archives remain unchanged. Plain-file restore with a spoofed verification flag
  is also rejected. Original bytes are never decoded/repaired.
- Actual Electron download produces a **33,292,780-byte** private file whose
  filesystem SHA-256 matches the renderer's exact transport bytes. Actual file
  input reselection verifies every original byte, prepares a verified restore,
  closes/reopens its authority, resumes its persisted request and completes fresh
  staging. The next complete backup is **33,301,447 bytes**, still below 32 MiB,
  and reconstructs the exact opaque original. Log:
  `/private/tmp/recovery-capacity-max-e98959a.txt`.
- `--inventory` proves **20,000 active + 20,000 original archived occurrences**,
  backup → fresh stage of 40,000 → protected activation with 20,000 active plus
  40,000 archived = the hard **60,000** aggregate. Its next private backup is
  **27,090,564 bytes** and reselects all 60,000 occurrences. Admission of 20,000
  active + 40,000 new raw occurrences, and one additional active note, reject
  without changing the supported source store. A separate **60,000 pure-archive**
  store rejects its next occurrence, then completes backup → fresh staging →
  protected activation with all 60,000 retained. Log:
  `/private/tmp/recovery-capacity-inventory-e98959a.txt`.
- These are real stock45 IndexedDB/file cases at source `e98959a`, using the
  isolated port 5192. Commands use the same executable/URL environment convention
  above, with the capacity script once normally and once with `--inventory`.
  Largest observed post-case heap samples were **606,484,735 bytes** for the
  byte/file case and **411,058,838 bytes** for inventory; they are samples, not
  measured peaks or formal memory guarantees. No memory settings, OS quota or
  disk-fill behavior was changed.
- Source `a9cd50e` fixes exact encoded-manifest restore preflight with durable
  locally issued verification proof. `35b25b0` reserves the complete virtual
  future protected recovery before new-data admission, references retained
  incoming bytes by ID and removes only redundant decoded-container cache.
  `e98959a` replaces a metadata-name collision with an owned WeakSet descriptor
  identity; deterministic Unicode/escaped-extension regression compares projected
  cost with real typed payload cost and round-trips unknown `capacityBytes: 0`.
  Independent immutable probes confirmed conservative model costs after the fix.
  The count-bound regression now admits one real 126-archive batch and rejects
  the next archive, exercising the boundary without repeating 126 projections.

## All 36 contract rows

Deterministic test names below are searchable verbatim by their leading contract
IDs. `AR` is `tests/unit/annotation-recovery.test.js`; `AC` is
`tests/unit/annotation-contract.test.js`; `AI` is
`tests/unit/annotation-identity.test.js`. Other test paths are explicit.
“Local verified” means the listed synthetic source/runtime evidence passed; a
remaining surface is stated on the same row. It does not mean signed or physical
platform acceptance passed.

| Row | Deterministic regression / implementation evidence                                                                                                                                              | Runtime and remaining acceptance                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I01 | AR `I01/I02`; annotations `I01: browser selections with equal filenames`; separate source documents, no digest/name merge.                                                                      | C separate accepted source, N native descriptor. Local verified.                                                                                                                                                                           |
| I02 | AC `I02 — requested URL case, slash, query ordering and raw/blob provenance`; AR `I01/I02`; parsed requested URL only, fragment removed.                                                        | Recovery C/P/F has no networking code; fixture URLs make no fetch. Redirect-provider integration remains a platform surface.                                                                                                               |
| I03 | AC `I03 — captured browser identity survives metadata edits`; File selections independent, WeakMap capture survives view transitions.                                                           | C actual accepted browser selection and context change; full browser-provider picker variants remain unexecuted.                                                                                                                           |
| I04 | AC `I04 — native content descriptor`; `desktop-open-acceptance` production bounded-reader afterRead regression; existing entry-path desktop/context tests.                                      | N real preload/read/editor chain. Native picker/Finder/MAS workspace/recent/watch provider combinations need signed provider replay.                                                                                                       |
| I05 | AI `I05: file-bookmark move, vacated-location reuse and repeated collision reads`; mas-access held polling moved-A/reused-B and repeat selection regressions; exact direct logical path policy. | Native adapter uses synthetic filesystem/bookmark capability fixtures, including repeated read/reopen. Actual MAS moves, symlinks/case providers and moved folders remain pending.                                                         |
| I06 | AI revoke/regrant, lost registry/corrupt rows/zero-byte tests; mas-access failed/throwing persistence; annotations accepted native unavailable/conflict visible recovery action test.           | N source-independent recovery, F enrolled-root failure. Actual OS revoke/evict/regrant and signed registry failure presentation pending.                                                                                                   |
| I07 | AC both `I07` tests, including equal independent saved copies with notes after renderer restart; bookmark explicit revision/new-document choice.                                                | Deterministic editor/reopen path verified; full native saved-copy UI replay remains pending.                                                                                                                                               |
| I08 | AC `I08 — bundle namespace and independent generated shares`; explicit sample namespace versus user files.                                                                                      | Deterministic local verified; independent native share-provider replay pending.                                                                                                                                                            |
| I09 | AC `I09 — explicit split/reconnect preserves both collections`; direct location atomic replacement is documented, no universal object replacement claim.                                        | Global C/N recovery available; no signed replacement-provider claim.                                                                                                                                                                       |
| A01 | AC `A01 — mixed legacy bucket subsets`; selected occurrence copies only, raw/archive multiplicity unchanged.                                                                                    | C actual select/associate/edit/undo preserves raw. Local verified.                                                                                                                                                                         |
| A02 | AR `A02/B04`; V1 exact 01/1 and decoded duplicate rejection, V2 repeated IDs/text/empty/prototype-shaped data retained.                                                                         | C opaque/raw code units and repeated occurrence selection; local verified.                                                                                                                                                                 |
| A03 | AC `A03 — preview separates matched, ambiguous, positional-only and unresolved anchors`; uncertain anchors never select document.                                                               | C actual preview/selection. Exhaustive huge-DOM interactive responsiveness remains unmeasured.                                                                                                                                             |
| A04 | AR `A04/A05/B09/T02`; AC transaction-time guard; document-context stale editor/tab/root/raw/watch tests.                                                                                        | W real CAS, C preview flow. Local verified for tested view/race cases.                                                                                                                                                                     |
| A05 | AR atomic retry/altered ID; annotation-storage `T03/A05` actual editor lost-ack retry; durable prepare/outcome/ack journal.                                                                     | P process restart exact-once; intentional fresh operation remains distinct. Local verified.                                                                                                                                                |
| U01 | AC `U01 — simple associate/reconnect undo and retry`; new history paging >100 operation UI regression.                                                                                          | C actual operation undo and P retry; W undo once. Local verified.                                                                                                                                                                          |
| U02 | AC `U02 — deleting one copy and independently associating another`; AR private remapped history/newer-edit tests and repeated occupied replace regression.                                      | C historical undo preserves edited note, W unrelated later edit. Local verified; repeat-replace followup has deterministic evidence.                                                                                                       |
| U03 | AR CAS/newer-edit cases; authority transaction reads latest root and preserves unrelated prepared requests.                                                                                     | W two real windows attach/undo versus unrelated edit, one winner/one conflict and retained draft. Local verified.                                                                                                                          |
| T01 | AR atomic revision test; real read-write IndexedDB CAS.                                                                                                                                         | W/R actual separate connections/windows. Local verified.                                                                                                                                                                                   |
| T02 | AC unsupported serialization/nesting; annotation-storage transaction failure keeps editor draft; AR batch-restore conflict preserves earlier archive.                                           | F actual native IDB injected read/clone and nine add/associate/restore quota prepare/commit/ack failures, W loser retained. Genuine OS fault/process phase combinations remain pending.                                                    |
| T03 | annotation-storage actual consumer lost-ack retry; durable prepared request/outcome reconciliation; abandon clears only its command, never archive/live notes.                                  | P actual SIGKILL after prepare, after commit-before-ack and at explicit discard/cleanup transaction completion. Restart preserves committed originals and removes only abandoned staging. See final local-phase replay below.              |
| T04 | AR explicit replace epoch/CAS; AI stale open registry future version; enrolled authority root/schema checks.                                                                                    | F real versionchange, stale window/future reopen/lost root; W concurrent revisions. Local verified for tested phases.                                                                                                                      |
| T05 | AI corrupt schema/rows, lost/truncated DB, failed write, POSIX sync failure and Windows branch; mas-access false/throw acknowledged-write regressions.                                          | N actual SQLite durable descriptor; F note commit failure. Windows directory-entry crash durability, Windows runtime and signed MAS remain pending.                                                                                        |
| T06 | AC `T06 — old-version legacy writes become additional immutable candidates`; localStorage remains unchanged and separate from authority.                                                        | C original legacy string preserved. No cross-version localStorage CAS claim; old released binary downgrade replay not executed.                                                                                                            |
| B01 | AR `B01/B02/B05` exact UTF16 and bytes.                                                                                                                                                         | C actual file download/reselection with whitespace/BOM/CRLF/non-BMP/lone-surrogate raw; N actual completed native download. Local verified.                                                                                                |
| B02 | AR original SDR unknown fields/container byte equality through another backup; byte-origin opaque capture.                                                                                      | C actual Export Original equals downloaded supplied bytes; N original file container. Local verified.                                                                                                                                      |
| B03 | AC >2,000 occurrences / collection paging; history >100 paging; annotation-storage grandfathered oversized fields.                                                                              | Final B06 maximum-byte and 20k/60k full protected recovery probes passed; UI worst-case responsiveness and other-platform ceilings remain unmeasured.                                                                                      |
| B04 | AR strict decoded duplicates, unsafe numeric spellings, malformed known fields whole-inventory opaque; AC future/corrupt fixtures.                                                              | C exact opaque raw; F future authority rejected. Local verified for fixtures, no migration/repair.                                                                                                                                         |
| B05 | AR false index/offset/units/inventoryCount/total/chunks/depth, tamper/truncation/digest and bounded parser tests.                                                                               | F >32MiB rejected before activation; no network/provenance trust. Worst-case adversarial peak allocation not formally proved.                                                                                                              |
| B06 | AR archive-count boundary reserves state payload, full-export compound preflight; explicit 32 MiB transport/96 MiB root limits.                                                                 | Final B06 exact one-archive compound maximum, next-byte rejection, actual file reselection/rebackup and 20k/60k protected cycles passed. Heap samples are not peak guarantees; real OS quota/disk-full and other platforms remain pending. |
| B07 | AR restore batch/ID conflict + private history remap; repeated occupied replace→backup→empty→occupied restore regression.                                                                       | C fresh profile unassigned staging→explicit protected recovery with zero imported bindings; N occupied same-store staging; local verified.                                                                                                 |
| B08 | AR `B08: portable exchange preview explicitly drops private...`; exchange redaction requires explicit preview/choice, private warning remains.                                                  | C/N private transport; portable actual downloaded-file/UI cycle not separately replayed.                                                                                                                                                   |
| B09 | annotation-storage grandfathered oversized records untouched; AR oversized edited note rejected; sourceFields preserves unknown original note fields.                                           | F 16MiB opaque preservation; actual huge-note interactive draft case uses deterministic editor tests.                                                                                                                                      |
| B10 | AR explicit protective snapshot required, bad snapshot rejection, epoch conflict; repeated occupied cycles preserve protective original bytes.                                                  | C protected replacement; final F actual IDB replacement prepare/commit/ack faults, invalid protective snapshot and concurrent second-connection edit all passed. Physical disk/power-loss remains untested.                                |
| V01 | document-context tests A→B→A, same filename, root replacement, watcher generation/rejected input/raw; existing document-open atomicity/render tests retained.                                   | C real view/editor, P actual editor readiness, N actual accepted native content. Full native provider watcher visual replay remains pending.                                                                                               |
| V02 | AC closed collection >2,000 paging and operation paging; global recovery command independent of tab/filename.                                                                                   | N source closed then command palette download; C independent context stage; local verified.                                                                                                                                                |
| V03 | `ios-annotation-boundary` direct render/panel/editor/storage/import/export and command-path guards; isIOSNative prevents opening recovery authority.                                            | Native iOS annotations stay disabled. This worker did not execute every proposed entry path on physical native iOS; parent iOS simulator evidence is separate.                                                                             |

## Remaining acceptance and limits

No known source defect from the initial five review findings remains at the
reported followups: consumer crash receipts, private usable undo history, full
backup reservations, original SDR container fidelity and independent equal saved
copies all have specific regressions plus the runtime evidence described above.
Independent review additionally found repeated occupied-replacement history and
history pagination and invalid retired-archive references; each was fixed with
reproducing regressions. Superseded history is retained in its verified protective
snapshot; only current mapped history is offered as active undo.

This does not convert pending physical/platform acceptance into passes. Signed
MAS security-scoped provider behavior, Windows/Linux actual runtimes, Safari and
Firefox, native physical iOS all-entry checks, genuine OS quota/disk exhaustion,
maximum compound live-memory stress and physical disk/power-loss failure behavior
still need their own authorized environment. Windows deliberately avoids unsupported
directory fsync while retaining file fsync, so sudden power-loss directory-entry
durability is explicitly unproved. The selected source policies fail closed or
leave an ephemeral collection with visible recovery rather than invent authority.

The single-file implementation is bounded, not streaming. Supported maximums are
independent ceilings and actual quota may be lower. Compound preflight can reject
an otherwise individually legal input; it preserves original supplied bytes and
committed state. No silent trimming, automatic archive/history eviction, imported
grant, filename match or content-hash attachment is part of this implementation.
