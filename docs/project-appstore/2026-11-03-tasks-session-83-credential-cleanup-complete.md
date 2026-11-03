# Session 83: release credential cleanup completed

Checkpoint: November 3, 2026. Both verification runs used reviewed `main` source
`2679334f5d0b053efc8971ab4b69b0a2bca6f9b2`, after PR #409. This completes the
repository/environment credential-scope cleanup described in [Session 81](2026-11-02-tasks-session-81-credential-scope-cleanup.md)
and the isolated probe repair in [Session 82](2026-11-03-tasks-session-82-credential-probe-keychain-chain.md).
Their earlier pending-validation checkpoints are historical.

## Verified result

| Evidence                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Protected validation 41603836719](https://github.com/cbremer/specdown/actions/runs/41603836719)    | Passed after the owner's personal GitHub environment approval; finished at 08:32:07 UTC. The existing Developer ID certificate/private-key pair signed the disposable probe, signature and certificate checks passed, one read-only Apple notarization-history authentication check passed, and temporary keychain/files/search-list cleanup was verified. |
| Names-only inventory after successful validation                                                    | All five signing/notarization entries remain in `desktop-release`; their duplicate repository entries were removed. The repository-secret inventory is empty. Inventory verification used metadata only; no secret values were disclosed.                                                                                                                  |
| [Scope-only verification 41604425632](https://github.com/cbremer/specdown/actions/runs/41604425632) | Passed at the same source; finished at 08:35:53 UTC. Preflight job `125810634638` succeeded and credential job `125810728536` was **skipped**. The run used `verify-scope-only=true`, `require-environment-only=true`, and `check-notarization=false`.                                                                                                     |

The scope-only run verified that the five names were unavailable outside the
protected environment using availability booleans. It performed no key use or
Apple authentication. The earlier protected result supplies the separate
credential-usability evidence; neither result alone substitutes for the other.
Tracker task **WK-47 is Done** on this combined evidence.

The five unchanged names are `MAC_CERT_P12`, `MAC_CERT_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. Existing keys and saved values
were reused. No signing certificate, private key or Apple account setting was
created, replaced or rotated.

## Release controls retained

The `desktop-release` environment still requires the repository owner's personal
GitHub approval, permits deployment only from `main`, and disables administrator
bypass. Agents cannot approve the protected deployment for the owner. Contributor
review protection remains separate and unchanged.

The active `release-tag-immutability` ruleset (`26429892`) protects `v*` tags from
updates and deletion with no bypass actors. This is configuration/readback
evidence, not a destructive tag-mutation test. Normal reviewed tag creation
remains available.

The protected run built only a disposable signing probe; the scope-only run built nothing. No application build, Store
submission, desktop publication or public release was performed, and existing
application versions/artifacts remain unchanged. The canonical checkout and
owner signing settings were preserved; documentation work uses a separate
in-repository worktree.

## Separate remaining owner tasks

- **WK-49:** The obsolete repository `ADMIN_PAT` entry was removed. Its underlying token
  has not been identified or revoked at the issuer. Confirm its identity and
  remaining consumers before a separate issuer-level revocation; removing a
  repository entry is not token revocation.
- **WK-46:** Independent off-Mac credential-backup recovery remains unverified. Keep the
  existing owner-controlled encrypted backups and password-manager records;
  this GitHub scope check does not prove those backups can be restored.

Future desktop releases continue through the existing reviewed release workflow
and personal approval gate. Credential cleanup does not authorize another signed
build, Apple request or release. No application version bump is needed for this
configuration change.
