# Session 44: permanent Mac Store package permission gates

Date: November 1, 2026. Base: `eed62c9911d0477386c8dc3fd1a76a6a2db498f1`.
Branch: `codex/mas-package-permissions-20261101`. Work is isolated under
`.claude/worktrees/specdown-mas-package-guard-20261101`; the canonical phone
checkout, existing installers and owner stores are preserved.

## Problem and resulting behavior

Apple rejected the first Mac 1.0.1 (228) installer with 90255 because its
embedded public provisioning profile inherited the private source profile's
`0600` mode. The one-off corrected package was delivered and validated, but
ordinary subsequent builds would repeat that error.

The MAS configuration now installs two mandatory hooks. After successful app
signing and before installer creation, `afterSign` changes only
`SpecDown.app/Contents/embedded.provisionprofile` to `0644`. It rejects symlinks,
hard-linked profiles and redirected app/Contents directories. It neither finds
nor reads the private input profile, certificate or keychain. Other bundle files
are checked for public readability, directories for traversal, and links for
containment. Unexpected restricted, special or group/world-writable modes fail
the build instead of receiving a broad chmod. Read-only deep/strict signature
verification must then pass; the hook does not sign again.

`artifactBuildCompleted` expands the completed installer to temporary scratch,
checks its exact single-component shape and `/Applications` destination, and
validates every BOM record before the builder announces/publishes the artifact.
All records must be root:wheel; files must be publicly readable and directories
traversable. Both the embedded profile and any AppleDouble companion must be
`0644`. Extra payloads, installer scripts, malformed/duplicate/escaping paths,
unsafe links and unexpected object types fail closed. Scratch is removed on
success or failure. The package itself is not modified by validation.

Direct DMG/ZIP configuration is unchanged. Explicit local unprovisioned
`mas-dev` keeps its existing missing-profile exception; Store builds cannot use
it. The installed locked `app-builder-lib 26.18.1` awaits MAS `afterSign` before
installer creation and the artifact hook before publication. A regression
asserts this sequencing so a dependency update requires renewed review.

## Verification

- 49 focused tests across two suites pass, including synthetic private-profile
  preservation, hardlink/symlink rejection, signature-verification failure,
  full BOM negative controls and dependency hook ordering.
- Full suite: **1,217 tests / 70 suites**, including required coverage. Lint and
  type checking pass.
- The new validator rejects the actual preserved Apple-90255 installer and
  accepts all **1,175 BOM records** of the delivered corrected installer. Both
  SHA-256 hashes remain unchanged. This read-only control expands the packages;
  it does not install, launch, sign or upload them.
- Evidence: canonical `ios/DerivedData/mas-package-guard-20261101/`, including
  `real-package-controls.json`, both validator logs and full-check logs.

The old rejected package remains `5465f128…f64e761`; the delivered corrected
package remains `3ce91397…6560de`. The existing independent content/signature
review and Apple validation remain separate evidence. This guard verifies
permissions, ownership and payload shape; it does not replace complete source,
web/native-byte, identity, entitlement, installer-signature or TestFlight gates.
No new app/package build, signing, credential access, install, UI interaction,
Apple action or source promotion is performed here. Application code,
dependencies and version numbers remain unchanged.

For an already-created installer, the same read-only validation is reproducible:

```sh
node scripts/mas-package-permissions.js /absolute/path/to/SpecDown.pkg
```

For future authorized Store packaging, keep the hooks enabled and use the
reviewed physical dependency tree. A top-level `node_modules` symlink previously
made production dependency collection omit runtime dependencies; successful
packaging alone is insufficient. Continue checking the final ASAR inventory,
universal native slices, embedded profile and no-updater boundary. Do not modify
private profile permissions to satisfy the public installer rule.
