# Session 54 — aligned Store build 230 replacement

Date: November 1, 2026. This is a separate version-only preparation on `codex/appstore-1-0-1-230` in `.claude/worktrees/specdown-release-230-20261101`, directly atop reviewed Close Folder commit `2414bc5745efe9a7dd4b765d2196cedfecfabc15`.

## Version contract

Both the production iOS/iPadOS and Mac App Store candidates remain marketing version **1.0.1**, advancing their build number to **230**. All six iOS configurations inherit build 230. Package/root lock metadata and the shared viewer revision advance to **0.0.230**, following the exact established build-229 pattern. The change touches only the five version-bearing files plus this handoff and the documentation index.

Close Folder is the reviewed prerequisite from Session 53. This version preparation introduces no application behavior, dependency, icon/artwork, bundle identity, entitlement, signing configuration or release-workflow change. The original direct desktop channel retains its independent identity and release feed; nothing installs, updates or publishes that app here.

## Validation

Evidence is in canonical `ios/DerivedData/release-230-20261101/author/`. All 1,341 tests across 77 suites and required coverage pass; lint, typecheck and the production web build pass. `candidate-manifest.json` binds source hashes, all 110 generated web files and required validation evidence. `version-verification.json` confirms 458 inherited files and all 806 dependency-package entries are unchanged. The focused audit reverses only the six intended version-string substitutions and compares bytes with `2414bc5`, checks unchanged dependency metadata, and validates all three generated iOS schemes/six configurations as 1.0.1 (230). Generated project checks are not native compilation, signing or upload evidence.

## Release boundary

The existing production-ID iOS and Mac build-229 Owner TestFlight records and their exact signed artifacts remain historical. They do not contain Close Folder and must not be relabeled or reused as build 230. Their processing/upload/assignment evidence remains in the earlier release-proof handoff; no Apple state is changed here.

Build 230 needs newly bound native artifacts and subsequent owner-authorized signing/upload, physical TestFlight acceptance and final proof before App Review. This task performs no signing, key generation, credential access, upload, submission, public release, canonical checkout promotion or remote push. Existing source, generated project/signing settings and owner files in the canonical checkout are preserved. A source commit follows independent review; a source/CI pass alone does not authorize submission.
