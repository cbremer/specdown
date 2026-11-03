# Annotation identity and recovery implementation decisions

This development change implements WK-18 on web and Electron. It does not enable
native iOS annotations or authorize a release. The evidence matrix is in
[the evidence matrix](2026-11-02-annotation-recovery-evidence.md). Signed MAS/provider and physical
acceptance remain separate from the local source/runtime results.

## Authority and source continuity

IndexedDB `specdown-annotation-recovery-v1`, version 1, owns annotation commits.
One read-write transaction reads the authoritative epoch/revision, validates the
caller and view guard, applies changes, records the operation/outcome, and commits.
Initialization writes the root and enrollment marker together. Missing, corrupt,
future or mismatched roots fail closed; they are not recreated in an existing DB.
A version change closes stale connections. There is no localStorage fallback,
timed lock or storage-event write ownership.

Storage is shared only within the browser origin/Electron session partition.
Separate profiles and application channels remain separate authorities. Real
Chrome localhost and stock Electron 45.1.0 localhost and production `file://`
origins were tested with disposable profiles. This is not evidence about a signed
MAS container, provider grant, a different browser, or physical iOS behavior.

Desktop source identity is issued after a successful authorized read, in the same
content descriptor. `annotation-identity.sqlite` uses SQLite immediate transactions
and FULL synchronous durability; a separately fsynced enrollment marker detects a
lost database. Schema version 2 separates logical locations from file-specific
bookmark keys and retains retired alias/token history. POSIX enrollment also
fsyncs the marker directory and fails closed on errors. Windows fsyncs the marker
file, without unsupported read-only directory fsync; persistence of the directory
entry through sudden power loss remains a platform acceptance limit. Schema/version/UUID/row/size checks run inside each allocation.
Registry failure leaves the authorized document readable with ephemeral note
identity; it never fabricates a durable token. Grants are separate and are never
included in an annotation backup. Registry capacity is 10,000 locations, 4 MiB of
UTF-8 bytes of locations/keys/history and a 16 MiB database, with no automatic eviction.

- Direct desktop: exact logical location supplied by the authorized reader; no
  new identity-only stat/realpath request, lowercase normalization, inode or digest
  merging. Atomic saves at that logical location retain the token.
- MAS file bookmark: only proven file-specific moved-alias evidence can retain a
  token. The proof runs after the complete bounded authorized read, and polling
  re-resolves its owned bookmark on each read. A vacated location no longer maps
  to that file. Repeated picker selections reuse a key only when the prior native
  bookmark resolves to the accepted source; unacknowledged grant writes remain
  ephemeral. Session-only watcher holds are also owned capabilities: every read
  rechecks the original session grant, and release/forget revokes the hold. They
  never advertise a durable source descriptor. Destination-token collisions quarantine both identities with a visible
  explicit-reconnect notice. Moved folders do not
  prove child continuity; children at the new location require explicit reconnect.
- HTTPS: parsed requested URL without fragment; query order, path case and slash
  distinctions remain significant. Redirect/raw/blob rewriting is provenance.
- Browser File/share: independent ephemeral source for each new accepted selection;
  its captured descriptor remains stable through tab switches/raw/preview. A
  filename, size, mtime or equal bytes never attach a prior collection.
- Saved copy: explicit saved-copy ID; revision versus different-document replacement
  is a user choice. Old tabs retain their captured collection. Equal names/content
  do not prevent saving two independent copies.
- Bundled sample: explicit bundle namespace; a user `sample.md` remains independent.

Content revision evidence is SHA-256 over exact UTF-16LE code units, tagged with
its algorithm/encoding. It is not document identity. Accepted source revisions
are observed transactionally; a different observed revision invalidates stale
cross-window note commits. Generation/tab/root guards remain in force.

The app cannot universally detect an unrelated replacement at the same logical
location or URL. Recovery offers a separate collection and explicit reconnect.
Imported paths/tokens/IDs never establish local source identity or file access.

## Archive, transport and capacity

Raw localStorage strings are preserved as exact UTF-16 units, including lone
surrogates. File inputs retain their original bytes. Supported SDR containers also
retain their entire original byte stream, including unknown manifest fields and
spelling. A verified recipe records their exact prefix and ordered payload IDs;
subsequent backups can reconstruct original containers without recursively
copying the same payload bytes. Historical private-state payloads are embedded
losslessly in the state inventory. Every reconstruction rechecks its digest.

The SDR1 transport declares version, chunk count, indices, offsets, lengths,
encoding/unit counts, inventory counts, SHA-256 and byte totals. Missing, reordered,
tampered or contradictory chunks fail before activation. Parsing uses a bounded
strict scanner that rejects duplicate decoded keys, ambiguous numeric spelling,
unsafe numbers and excessive depth. Corrupt/future/over-inspection-limit payloads
remain opaque rather than partially inventoried. An explicit opaque-file action
can preserve an otherwise unsupported container without interpreting it.

| Independent budget                       | Limit                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Bounded file/individual raw payload read | 32 MiB                                                                          |
| Complete encoded private transport       | 32 MiB including headers/manifest                                               |
| Manifest                                 | 256 KiB; 128 ordered payloads                                                   |
| Persisted archive envelopes              | 256, including retained container recipes/history                               |
| Candidate root representation            | 96 MiB including raw, projections, requests/history                             |
| Parsed JSON                              | depth 48; 2,000,000 tokens per inspected value                                  |
| One inspected archive                    | 20,000 occurrences                                                              |
| Combined active/archive inventory        | 60,000 occurrences                                                              |
| Active notes                             | 20,000 total                                                                    |
| Inspectable legacy collection label/key  | 512 / 128 UTF-16 units                                                          |
| New/edited note text                     | 16,384 UTF-16 units                                                             |
| DOM                                      | 100 rows per archive/collection page; 500 displayed badges; 5,000 source blocks |
| Prepared request/outcome history         | 10,000 records, also subject to root/transport budgets                          |

These are independent ceilings, not a promise that every 32 MiB input can become
an active collection. New raw data and new/edited notes must also pass a
synchronous virtual future-recovery proof: current complete backup → fresh staging
→ protected activation, retaining all original archives/history. It models exact
JSON escaping, new IDs/revisions, the supplied container recipe, protective
snapshot and journal metadata using owned length-only byte descriptors, without
allocating payload copies or hashing inside IndexedDB. Unknown note metadata is
fully counted; a local WeakSet identifies only the model's archive-byte objects.
This reserves a second active-note projection (so 20,000 active plus 40,000 raw
occurrences is rejected at admission), while the actual hard aggregate remains
60,000. New archive admission currently leaves room for 126 independent raw
payloads plus the future protective snapshot/current state within 128 transport
payloads. Existing imported envelopes are independently bounded at 256.

New raw capture/plain-file restore also retains the full 256 KiB manifest
headroom. Successfully verified complete SDR input receives a non-importable
in-memory verification capability; prepare binds a locally generated proof in the
authority journal for restart. Verified recovery consumes the reserve using the
actual encoded next manifest, not a second hypothetical maximum. Imported flags
cannot select that policy. Reads, acknowledgment and later mutations still check
actual 32 MiB transport/256 KiB manifest/96 MiB representation/record hard bounds.
Every accepted result must remain privately exportable. A restore/association/replace
that would exceed a compound budget aborts without truncating/evicting data.
Opaque originals remain exportable. Browser quota can be lower; quota failures
abort the real transaction. No archive/history is deleted to make space.

The implemented transport is a bounded single-file Blob/File reader, not an
unbounded stream. localStorage itself returns a whole string. Parsing, hashing
and reconstruction happen before commit. Do not claim arbitrary-size recovery.
The measured stock45 synthetic 16 MiB opaque UTF-16 archive produced a 16,779,121
byte private file, restored through real IndexedDB, and produced a second complete
16,787,376 byte backup. Post-case JS heap was 216,370,219 bytes; this is an observed
heap sample, not a proved peak-memory bound. Allow substantial working memory and
temporary disk for clones, the database and downloaded files; memory/storage
exhaustion remains a failure, never a reason to claim a successful partial restore.

A verified container keeps its exact bytes and reconstruction recipe; its decoded
binary preview is discarded as redundant cache. Equal embedded snapshot IDs are
verified/deduplicated before charging inventory again, so repeated references in
protective history do not invent additional occurrences. These rules never trim
unknown raw data or distinct archive/ordinal occurrences.

Finite retained history can eventually exhaust the actual compound budget. A
verified recovery does not promise unlimited further whole-store recovery cycles.
Unsupported subsequent work keeps current data, original bytes and drafts intact.

A download button only requests a download. The app asks the user to save and
reselect the actual file; it does not infer completion from `link.click()`.
Native/browser cancellation leaves the store and selection unchanged.

## Association, private recovery, history and retention

Legacy raw snapshots are immutable, global Unassigned notes, never filename-bound
active notes. V1 exact decoded keys and V2 array ordinals identify occurrences;
repeated IDs/text/empty notes remain independent. Per-note selection copies only
selected occurrences into a captured target. Preview labels matched, ambiguous,
positional-only and unresolved anchors; uncertain matches do not become badges.
Unknown source fields remain available in immutable raw evidence and the copied
note's source-fields envelope. Editing a copy does not rewrite the raw archive.

Private restore first stages unassigned archives. Explicit protected replacement
preserves a verified snapshot of the current revision, allocates a new epoch and
local document/note/operation IDs, and remaps usable occurrence/undo history.
Imported source bindings stay quarantined. A later explicit reconnect can map the
latest recovered binding history to the accepted local source; no path is opened
and no grant is recreated. Imported note after-revisions use an epoch-scoped token,
so a numerically equal newer local revision cannot make an edited note removable.
Protected UI activation references the retained private-state archive ID; it
parses those owned bytes instead of copying the complete incoming JSON into its
request and operation signature. The old current store remains in its protective
raw snapshot. Superseded
operation receipts stay retained but are marked with their protective archive and
original operation ID. They cannot undo replacement documents. Subsequent private
recovery validates that exact retained snapshot and operation effects before
accepting retired history; missing/unrelated references reject activation. Current
recovered history retains usable remapped undo, with pages through all retained
operations rather than a last-100 cutoff.

Undo targets the operation's unchanged created notes/binding only. Edited,
deleted or rebound effects become conflicts; other notes/operations remain.
Original occurrences remain available for deliberate new copies. Repeated undo
is harmless. There is no whole-root rollback over another writer's work.

Actual UI/editor requests prepare a stable operation ID and original command in
IndexedDB before commit. Outcome is recorded with the note/association commit;
acknowledgment is another durable metadata transaction. After restart, recovery
shows committed versus uncommitted requests, original target/revision and draft
or selected occurrences. Explicit resume uses the original ID. Lost acknowledgments
reconcile against the operation ledger. A failed request does not close the editor
or discard its draft. Explicitly discarding an uncommitted request cancels that
request and its staging; committed archives and undo history remain untouched.

No archive, active-note, binding or undo-history automatic retention deletion is
implemented. Permission revocation/forgetting stays in the native access adapter.
Archive deletion, note deletion, source disconnection and forgetting file access
are not conflated. A new retention policy requires a separate explicit decision.

Private backup is not sanitized: it can contain note text, URLs, locations,
identifiers, opaque fields and history. Portable exchange has a separate explicit
lossy preview/confirmation and exports only note text with generic collection
labels; it excludes original archives, bindings, IDs, anchors, opaque extensions
and history. Neither preview/restore fetches a URL or opens an imported path.

## Mixed versions

The legacy key is never overwritten or marked permanently migrated. Changed old
text becomes a new immutable candidate on the next load/capture. Storage events
notify about older-window changes; they do not provide CAS. Close older windows,
then capture the final changed legacy snapshot before recovery. New collections
are not visible to an older app. There is no claim to recover every intermediate
write by an uncooperative older version or to atomically lock its localStorage.
