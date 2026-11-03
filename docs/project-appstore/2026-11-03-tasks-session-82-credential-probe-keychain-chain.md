# Session 82: repair the isolated desktop credential probe

Checkpoint: November 3, 2026. Source baseline:
`e9b3e4e45f2972e59f89aa13e4d550ebd2e791e9` on remote `main`, after PR #407.
This is a fresh validation-only change; it does not change application code,
versions, release workflows, signing identities or personal release approval.

## Observed failure and remaining boundary

The owner-approved [validation run 41598226573](https://github.com/cbremer/specdown/actions/runs/41598226573)
failed in job `125790596000` at the existing-key signing probe. PKCS12 import,
the public leaf pin, private-key identity lookup and probe compilation had
already passed. Cleanup did not report a failure. The optional Apple history
request was not reached. This is not proof that the saved credentials are
invalid, and it is not a successful credential migration.

Read-only comparison found that `codesign --keychain` restricts identity lookup
but still uses the user's search list for certificate-chain resolution. The
existing desktop builder includes its temporary signing keychain in that list;
the first probe did not. It also supplies a public certificate-chain keychain.
The failed run discarded native diagnostics, so the exact cause of that run
remains unknown. This repair addresses the documented setup difference and
provides fixed diagnostic categories for any subsequent failure.

The five original repository signing/notarization entries remain present until
protected positive validation succeeds. Their environment-secret names were
independently verified earlier; secret values were not read. The unused
repository `ADMIN_PAT` entry has now been removed and its absence verified.
That repository deletion does not revoke the underlying token at its issuer;
global token identification/revocation remains separate.

## Narrow implementation

- Parse the bounded existing user-keychain list as literal, quoted absolute
  paths. Preserve path order, spaces and literal backslashes. Reject malformed,
  duplicate, relative, noncanonical or oversized path inventories before any
  keychain mutation. Empty lists are supported.
- After checking the original pinned Developer ID Application leaf, ensure the
  exact public Developer ID G2 intermediate is present in the disposable
  keychain. Skip import if already present; otherwise import only the locally
  retained, hash-verified public DER and verify the resulting inventory. No
  root certificate or trust setting is added. The [certificate source note](../../scripts/certificates/README.md)
  records its official source and independent public-byte verification.
- Within an owner-approved GitHub-hosted macOS job, temporarily prepend only the
  disposable signing keychain to the original user search list. The default
  keychain and all existing entries remain unchanged. Mark restoration required
  before attempting the mutation, since a failing command can partially apply.
- In `finally`, attempt exact original-list restoration before deleting the
  disposable keychain, then remove temporary files and verify both the raw
  search-list and default-keychain snapshots. All cleanup attempts run even if
  an earlier cleanup operation fails. Any cleanup failure overrides a successful
  signing result and requires the disposable runner to be discarded.
- Capture only the signing probe's stderr under the existing bounded subprocess
  and reader cleanup rules. Emit a fixed category for argument configuration,
  certificate chain, keychain interaction, allocation tool, generic signing
  service, or unclassified signing failure. Raw text, paths and account details
  are never returned, logged or uploaded. `errSecInternalComponent` remains a
  generic signing-service category, not an asserted key-access diagnosis.

This supersedes Session 81's original prohibition on temporarily changing the
probe runner's search list. It does not authorize changing the owner's Mac,
changing default/trust settings, importing a broad certificate collection,
loosening key ACLs, or retrying Apple authentication. Hosted-only/main-only
guards, the existing personal environment approval, timestamp-disabled tiny
probe, strict signature verification and the original leaf pin remain intact.
Scope-only checks still receive availability booleans and do not use credentials.

CodeQL also flagged the inherited runtime SHA-1 calculation for selecting the
certificate. The helper now uses the independently verified, fixed public
`codesign` lookup selector `348BDE654F13CAACABB81B4F68AC2D785251400F` instead.
This is lookup metadata required by `codesign`, not a security fingerprint.
SHA-256 still verifies the imported leaf before signing and the extracted
signing certificate afterward. Wrong-selector and wrong-certificate regressions
remain in place; no CodeQL rule is suppressed or dismissed.

## Verification and continuation

Synthetic tests cover list parsing, empty and partial mutations, restoration
before deletion, cleanup failures, unchanged default/trust settings, pinned
public intermediate reuse/import/readback, corrupted public assets, fixed
diagnostic labels, stderr closure, discarded successful diagnostic output and
bounded diagnostic timeouts/output overflow. They use synthetic credentials and
mocked native operations. Disposable POSIX subprocess checks involve no keys.
Local checks passed 1,443 Jest tests across 81 suites with the existing coverage
gates, 23 Python test methods, lint, typecheck, targeted formatting and whitespace
validation. These results do not establish real signing or Apple authentication.

Actual credential use remains a separate owner-approved hosted run after review
and merge. Record that run's exact source and result. Do not remove the five
repository copies, claim Apple authentication, or mark WK-47 complete from
synthetic results. No new signing certificate/private key or app build is needed.

Development and evidence stay in an in-repository worktree. The canonical
checkout, owner signing configuration and existing app artifacts were not
edited by this task.

Primary references: installed `codesign(1)` sections **--keychain** and **Signing
Identities**; Apple's [private-keychain search-list rules](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_keychain/lib/StorageManager.cpp)
and [literal list formatting](https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/macOS/keychain_list.c);
the installed `app-builder-lib` signing implementation and the pinned public
certificate source linked above.
