# Session 46: aligned Store release proof candidate

Date: November 1, 2026. Scope: prepare iOS and Mac App Store 1.0.1 (229) for owner proof before submission. No public release or App Review submission.

## Source

The isolated `codex/store-release-proof-1-0-1-229` worktree combines the reviewed Mac startup baseline `eed62c9911d0477386c8dc3fd1a76a6a2db498f1`, package permission guard `cd3981f2457c2f31eeedb128db0d0f72dab0c1df` (integrated as `00da12e`), and exact-entry native open recovery `328b70c12a0910254974f998783b2e8853f86c60` (integrated as `0370329`). The sole integration conflict was the documentation index; both Session 44 and Session 45 rows are retained.

The release metadata change sets iOS and MAS build 229 while retaining marketing version 1.0.1. The web/source revision is 0.0.229; package-lock changes only its two root version strings. Bundle identities, dependencies, native source, artwork, signing settings and release workflows are unchanged by this version commit. The existing direct desktop app/update feed is not installed, updated or published by this preparation.

## Validation

Integrated full CI-mode tests with coverage: 1,294 tests / 73 suites passed. Lint, TypeScript and the production web build passed. Both feature commits have independent source reviews and regression/negative controls recorded in Sessions 44 and 45. The merged dependency-only PR 344 was reconciled against the frozen source: its runtime security dependency versions and integrities were already present.

Evidence is in canonical `ios/DerivedData/release-proof-20261101/`; final source, generated project, native artifact and screenshot manifests will identify their exact commit and hashes. Existing 228 artifacts are historical and must not be relabeled as 229.

## Proof and release gates

The owner-facing packet is `docs/project-appstore/release-proof-2026-11-01/`. Both App Store Connect draft listings have validated platform-specific copy and manual release selected. The approved Halo header is assigned to iOS 1.0.1; the new Search Results adaptation is an unsubmitted, unassigned draft. Artwork review, native screenshots and actual build verification remain separate evidence.

Unsigned archive/packaging preparation is not a signed upload or TestFlight acceptance. Final production-ID iOS distribution must have internal-only restriction OFF; tester assignment can remain Owner only. Physical iPhone/iPad and Mac TestFlight acceptance, owner proof and App Review remain explicit gates. The separate Beta app cannot be promoted across app records. No new keys or credentials may be generated or rotated.

WK-18 annotation recovery remains deferred by the release scope; native iOS annotations remain disabled. No live note stores are read or migrated. Canonical source/project promotion must preserve the owner signing and UI settings, document/artwork files and README rows.
