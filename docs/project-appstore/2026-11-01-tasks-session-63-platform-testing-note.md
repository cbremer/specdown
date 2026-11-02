# Session 63: Desktop testing coverage in the README

Date: 2026-11-01. Documentation-only clarification requested by Chris.

## Change

Add a visible testing-coverage note immediately below the desktop download table:
Windows and Linux builds have received less testing than macOS builds. Link to
GitHub issues for platform-specific reports. Keep the existing download options
and installation instructions; do not describe the builds as unsupported or
invent a new experimental designation.

## Validation and boundary

Independent review passed the narrow README diff, link destination and scope.
Full 1,371 tests across 78 suites, lint, typecheck and diff checks passed. All 548
protected canonical-file hashes remain unchanged. Normal PR checks are required
before merging. No runtime source, dependency, version, native project, artifact or Store
metadata changes are required. The canonical phone checkout remains preserved.
