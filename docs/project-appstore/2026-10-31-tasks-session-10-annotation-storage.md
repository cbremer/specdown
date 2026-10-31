# Session 10: preserve unreadable annotation stores

Date: 2026-10-31 (America/Los_Angeles). Follow-up to [session 07](2026-10-31-tasks-session-07-launch-weekend.md).

## Problem and resulting behavior

Previously, an inaccessible, malformed or unsupported annotation store could be treated as an empty collection. Saving or importing afterward could replace recoverable data. A transient read failure could also open a blank editor for an existing note or replace its document's collection with a new note after storage access returned.

The annotation reader now distinguishes missing, valid, corrupt, unsupported and unavailable storage. Only missing or valid storage permits changes. Save, delete, import and automatic legacy-anchor updates cannot overwrite unreadable data. The write boundary checks the current store again. An editor does not open for an unreadable or missing existing note, and a failed save retains the user's typed text.

## Scope

- Recognize the existing unversioned v1 map and explicit v2 schema; an unknown explicit version is not interpreted as legacy data. Invalid entries reject the operation instead of being silently skipped.
- Keep stored collections above today's import limits intact. Shape validation does not trim note counts, note lengths, or other records. Empty legacy note text, unaffected empty collections, extension fields and document names such as `__proto__` remain representable.
- Use dictionaries without inherited keys and own-property checks for document collections.
- Export the original stored text, including whitespace, legacy schema, corrupt JSON and future-version content. A missing store exports an empty v2 backup. If storage access itself fails, export reports that no backup was created rather than downloading an empty replacement.
- Continue bounded v1/v2 imports and exact-repeat deduplication. Preserve supported note/root/anchor extension fields. Imports reject root-metadata conflicts or duplicate notes carrying additional/conflicting extension data, leaving the entire existing store unchanged.
- Keep annotation identity and editor tab/render-context behavior unchanged. **WK18 filename-only identity remains open.** This persistence fix does not make same-named documents independent or migrate old notes to source identities.

## Verification

The focused annotation/storage/renderer security suites pass **108 tests**. Regressions exercise malformed and unsupported schemas; permanent and one-read storage failures; new/edit/delete/editor-open and anchor migration paths; quota failure; exact backup download content; prototype-shaped names; legacy collections over 500 notes; text beyond today's length and import-size limits; extension metadata conflicts; and valid legacy/v2 behavior.

Full lint and type checking pass. `npm run test:ci` passes **900 tests across 53 suites**, including required coverage thresholds. The production build passes, with the existing large-chunk advisory. Changes were independently reviewed; the transient save/read, blank-editor and duplicate-metadata cases identified during review now have regressions. The reviewer reran all three reproductions and 87 focused annotation tests without findings.

Local logs: `/private/tmp/specdown-annotation-targeted-20261031.log`, `/private/tmp/specdown-annotation-full-tests-20261031.log` and `/private/tmp/specdown-annotation-build-20261031.log`. Reviewed annotation source SHA-256: `3dc41ec074218b2905755aa482a1b0e94e01c18eab08aaced713aef808049663`.

## Evidence boundary and remaining work

Work was performed in an isolated local checkout on this Mac, without browser/native UI interaction, unlock attempts, Apple account access, signing, keys or other-computer access. Dependency files match the previously verified toolchain lockfile; local dependencies were cloned into this checkout. No dependency, native-shell, workflow or version source was changed.

Oversized or unsupported backups remain recoverable exports, but the existing bounded importer is not a general repair tool: it still rejects unsupported schemas and backups beyond its limits. This change preserves those bytes; it does not claim a new oversized-backup restore format. Filename identity recovery, a lossless migration/restore design, and editor context races remain separate follow-ups. Native touch/download behavior has not been retested while the Mac is locked.
