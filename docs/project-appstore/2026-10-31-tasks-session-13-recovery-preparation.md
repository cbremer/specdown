# Session 13: inert annotation recovery preparation

Date: 2026-10-31 (America/Los_Angeles). Follow-up to [session 10](2026-10-31-tasks-session-10-annotation-storage.md) and [session 12](2026-10-31-tasks-session-12-document-context.md).

## Scope and status

This change adds a pure, unreferenced legacy annotation snapshot inspector and synthetic tests. It has no production caller and does not read a live store, attach notes, migrate data, activate v3 storage or change app behavior. The release candidate remains `da923e92e8516f87424c82c13bac24252c4005f7`. **WK18 filename-only annotation identity remains open.**

`inspectLegacyAnnotationSnapshot(raw, sha256)` accepts explicitly supplied text and a trusted SHA-256 provider. A supported result inventories fully inspected v1/v2 records. Every other result preserves the supplied raw string and returns no inventory or digest. The `archive-only` result is a classification for a future caller: this function does not save an archive or create a backup.

## Preservation and identity contract

- Preserve the exact supplied JavaScript string, including whitespace, escapes and lone UTF-16 surrogates. Inventory records retain their original JSON slices; decoded text is only a display projection. Unknown root/note/anchor fields and original numeric spellings remain in raw data.
- Record identity combines an annotation-snapshot digest with a JSON Pointer occurrence address. V1 uses exact decoded property keys (`01` differs from `1`); v2 uses array ordinals. Duplicate IDs, identical note text, empty notes and empty collections remain distinct. Prototype-shaped names are ordinary data.
- The digest input is ASCII `SpecDown/annotation-legacy-snapshot/v1/utf16le` followed by NUL, an unsigned 64-bit little-endian UTF-16 code-unit count, then those exact code units in little-endian order. Hash chunks are at most 65,536 bytes. No Unicode normalization, UTF-8 replacement, BOM insertion or JSON reserialization occurs. The provider must consume every chunk in order and compute SHA-256; the inspector checks consumption and 32-byte output, but cannot verify the provider's cryptographic implementation.
- This digest identifies annotation-store text, never the original source document. Existing legacy stores contain no document snapshot/digest; source-document provenance remains explicitly unknown. A full recovery archive may contain private information in user text or unknown fields; it is not a sanitized exchange format.
- Duplicate decoded JSON keys anywhere, including unknown metadata, prevent a supported inventory. Corrupt/future formats and ambiguous root `version` keys remain raw-only. In particular, a possible v1 document literally named `version` is not guessed to be legacy data. This preserves it for later explicit recovery rather than claiming every historical filename can be inventoried.
- Known schema integers are checked without floating-point rounding or underflow turning a fractional/future value into a valid index/version. Unknown numeric metadata remains raw; no normalized object is used as a replacement store.

## Bounds and failure behavior

Inspection is limited to 2,097,152 input code units, depth 64, 100,000 values, 262,144 raw code units per string token, 1,024 collections and 10,000 records. An additional 4,194,304-code-unit projection budget counts repeated addresses/IDs, record slices and displayed text before allocating each occurrence. It prevents a long collection name repeated across many notes from expanding a modest input into a huge inventory.

These are independent inspection budgets, not changes to the live app's import/edit limits. Larger grandfathered data is retained as raw-only; there is no partial-success inventory or slicing of stored notes. Input length is checked before parsing. All structural/schema/projection checks precede hashing; rejected inputs never invoke the provider. Provider failures likewise return the original raw string with no partial identity/inventory.

## Verification

Synthetic tests run the actual module in an isolated JavaScript realm without DOM, storage, network or native APIs. They cover preservation, duplicate keys/IDs, prototype-shaped names, Unicode/digest identity, malformed/future data, limits and output amplification, integer precision, hashing failures and retry stability. All **76 focused tests** and the full **1,014 tests across 56 suites** pass, including required desktop coverage thresholds. Lint, type checking and diff checks pass. Production build succeeds with the existing large-chunk warning.

The production build is identical by path and SHA-256 to a clean `da923e9` build made in the same isolated checkout before adding the module: **all 110 generated files match**. Both manifests include every generated file, not only the entry bundle. An independent reviewer reproduced the complete bundle comparison, confirmed there are no production references/imports, passed 492 additional adversarial assertions and found no remaining issue. A second reviewer passed 1,476 synthetic corpus cases plus three exact projection-budget boundary checks, with no findings. No dependency, build configuration or existing production module changed.

Local evidence:

- Full tests: `/private/tmp/specdown-recovery-full-tests-20261031.log`.
- Build: `/private/tmp/specdown-recovery-build-20261031.log`.
- Baseline manifest: `/private/tmp/specdown-recovery-baseline-manifest-20261031.json`.
- Final manifest: `/private/tmp/specdown-recovery-final-manifest-20261031.json`.
- Independent review manifest: `/private/tmp/specdown-recovery-independent-review/reviewed-source-manifest.json`.
- Independent parser/projection probes: `/private/tmp/specdown-recovery-native-probe-result-20261031.json` and `/private/tmp/specdown-recovery-projection-probe-result-20261031.json`.

## Remaining gates

Stable source IDs, native source-token continuity, transactional persistence across scenes/windows, explicit legacy recovery/association/undo UI and complete oversized backup/restore remain future work. A single localStorage write does not supply a cross-scene read/compare/write transaction. Recovery must retain originals and must not infer association from filenames, matching text, imported IDs or claimed source provenance.

This session used only isolated local source, synthetic fixtures and headless tests/builds. No user annotation stores, browser/native UI, unlock attempt, Apple account, signing keys, other computer, release or deployment was accessed. An identical production bundle requires no new native rebuild for this inert preparation; it does not resolve any prior native interaction or release gates.
