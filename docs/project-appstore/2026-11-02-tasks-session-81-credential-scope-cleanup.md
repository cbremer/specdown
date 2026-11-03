# Session 81: protect regular desktop release credentials

Checkpoint: November 2, 2026. This work narrows the availability of existing
regular-desktop signing credentials. It does not change the application, Store
identities, release versions, certificates or the owner's release approval.
The source baseline is `6f2747af4949540854152206f9d04d9f5da2192d`.

## Current evidence and boundary

- The initial names-only GitHub inventory found five signing/notarization entries
  at repository scope and no secrets in `desktop-release`. After the owner entered
  the saved values privately, all five environment-secret names were independently
  verified present. Values were not read; the broad repository copies remain until
  protected validation passes.
- The existing `desktop-release` environment still requires the sole repository
  owner, permits that human owner to approve their own dispatch, disallows
  administrator bypass, and permits only the `main` branch. The current workflow
  verifies those settings before signing. The cleanup does not imply that the
  published direct desktop 0.0.232 release lacked its approval gate.
- The only pre-migration source consumer of these five entries is the signed macOS
  step in `.github/workflows/desktop.yml`. No other workflow/script in that
  baseline references them. The validation workflow added here is also a
  protected consumer. Existing Store signing is a separate local/Apple process.
- A repository `ADMIN_PAT` entry remains. Historical version automation used it;
  the current workflow uses `GITHUB_TOKEN`. Absence from current source is not
  proof that every external or older integration has stopped using the token.
- The coordinating agent applied the independently reviewed tag rule
  `release-tag-immutability` (ruleset `26429892`): active tag target `refs/tags/v*`,
  restricted updates/deletion, no bypass actors, and creation still allowed.
  Readback preserved the existing branch rule, complete release environment
  settings, main-only deployment policy and the `v0.0.232` target `cc7024d`.
  This is provider-configuration evidence, not a destructive tag-mutation test.

The new validation workflow is prepared for review. Actual protected validation,
removal of repository copies and retirement of the legacy token must be recorded
separately when completed. Do not mark WK-47
complete from this source change or synthetic tests alone.

## The five existing entries

| Secret name                   | Existing value to preserve                                                   | Validation                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `MAC_CERT_P12`                | Base64 representation of the existing Developer ID Application PKCS12 export | Bounded import and exact public-certificate fingerprint; no URLs or filesystem paths accepted by the validator |
| `MAC_CERT_PASSWORD`           | That export's existing password                                              | Import and use of the matching private key in a disposable keychain                                            |
| `APPLE_ID`                    | Existing notarization account identifier                                     | Basic configuration validation; optional explicit read-only authentication check                               |
| `APPLE_APP_SPECIFIC_PASSWORD` | Existing notarization app-specific password                                  | Optional explicit read-only authentication check                                                               |
| `APPLE_TEAM_ID`               | Existing team identifier                                                     | Must match the retained direct-release identity                                                                |

The expected public leaf certificate is taken from the retained signed direct
desktop 0.0.232 application, not from a private credential store. Its SHA-256 is
`3E9546741A6FF820AE629E684F70433E20CEB6BDD561812A9F3BE7EBC506A82B` and team is
`582YQWPT9G`. It expires June 17, 2031 at 03:30:14 UTC. This is the **Developer ID
Application** identity. Apple Distribution and Mac Installer Distribution
certificates used for Store builds are not substitutes.

GitHub does not reveal stored secret values through its secrets API. The owner
must use the saved originals through a private entry mechanism. Do not print
values, put them in chat, commit an export or attach a backup to an issue. Base64
is an encoding, not protection for a private key.

## Migration sequence and evidence

1. Verify current `main`, live environment/reviewer/branch settings, active
   release runs, names-only secret inventories and exact workflow consumers.
   Preserve the frozen canonical app checkout and all unrelated local edits.
   Avoid a migration during a pending or active signed release.
2. Review and merge the credential-validation workflow before dispatching it.
   Its job is on `main`, uses the existing owner approval policy and has no
   publication path. A normal signed desktop release is not a validation probe:
   its `validate-only=false` path also enables eventual publication.
3. The owner enters the same five saved values into **Settings → Environments →
   desktop-release → Environment secrets**, using the exact unchanged names.
   Independently verify that all five environment entries exist using names-only
   metadata. Keep the working repository copies for this initial stage.
4. Dispatch **Validate desktop release credentials** on the reviewed `main`
   revision with `verify-scope-only=false` and `require-environment-only=false`.
   The owner personally approves
   the pending `desktop-release` deployment. Record that exact run and source.
   This checks the newly selected environment credentials; success alone does
   not prove environment placement because broader same-name fallbacks could
   otherwise hide a missing entry. The names-only inventory in step 3 is required.
5. `check-notarization` defaults to `false`. Select `true` only for a concretely
   owner-authorized check using the existing notarization account. It makes one
   `notarytool history` request, suppresses all history/account output and never
   retries authentication, uploads or saves a credential profile. Stop on an
   authentication/agreement error for owner action. Success proves authentication
   and read access, not successful notarization of a new application.
6. After the protected identity check passes and the existing Apple credential
   check is adequately established, remove only the five duplicate repository
   entries. Verify the names-only inventories again. Keep the original saved
   values in owner-controlled storage; do not create replacement keys.
7. Dispatch again with `verify-scope-only=true`, `require-environment-only=true`
   and `check-notarization=false`. The unprotected preflight
   receives only expression-derived availability booleans, not secret values.
   It must confirm all five are unavailable outside the protected environment.
   This detects broad repository/organization fallbacks; the API inventory proves
   the specific storage locations. This mode skips the credential-bearing job;
   it does not sign again, contact Apple, or require a repeated environment
   approval. Its pass proves scope absence only, not credential identity or
   usability. Retain the positive protected result from steps 4–5 and the
   independently verified environment inventory as the separate identity proof.
8. Record the exact source, positive validation, absence result, unchanged
   approvals/branch policy and remaining owner tasks in the tracker. No app
   release, tag creation or release feed is part of credential validation.

## Validation implementation and limits

`credential-validation.yml` is manual and main-only. The preflight uses the
existing `verify-release-environment.js` in explicit `repository-owner` mode;
no workflow grants itself approval. Repository permissions are read-only, and
the protected job uses GitHub-hosted macOS. Checkout actions are pinned and
checkout resolves the dispatch's exact SHA without persisted credentials. The
job installs no npm dependencies and has no artifact-upload or publish step.
`verify-scope-only` defaults to `false`; selecting it skips the credential job
without weakening that job's environment gate when it is requested.

The helper checks bounded inputs, creates a mode-restricted temporary directory
and disposable keychain, imports the existing PKCS12, and pins its public leaf.
It compiles a tiny disposable C executable, signs it with the expected existing
private key, verifies its signature, and compares the extracted public
certificate to the pinned fingerprint again. The executable is never launched.
Timestamping is disabled. There is no app build, notarization upload or release.

Each keychain mutation names only the disposable keychain. The helper does not
set a default keychain, set a search list or change trust settings. It compares
the search list/default metadata before and after cleanup and fails if they are
not restored. Certificate chain construction can still use the runner's normal
trust/search context; a missing chain fails rather than broadening that context.
`--timestamp=none` is not a claim that macOS trust evaluation makes no network
requests.

Temporary keychain/files are removed in success and handled failure/interruption
paths, and cleanup is checked. A cleanup failure fails the job; discard that
hosted runner. SIGKILL or host loss cannot run a cleanup handler, so runner
destruction remains the final boundary. The helper refuses ordinary local,
self-hosted, non-main or non-dispatch execution with real credentials.
Debug runner modes are rejected before any credential operation. The optional
Apple request binds credential arguments as values and rejects option-like
app-specific passwords rather than treating CLI help as authentication evidence.

Only fixed stage failures and a pass/fail summary are logged. Child processes
receive a minimal environment, diagnostics are discarded, metadata capture and
execution time are bounded, and the optional notarization output is discarded.
This reduces exposure; it does not make arbitrary malicious code in an approved
credential-bearing job safe. Review the exact source before owner approval.

Synthetic tests exercise input/context rejection, all command failure stages,
certificate/private-key/signature mismatches, cleanup failure, scope booleans,
optional single-attempt authentication and error redaction. They never call
signing tools or use real certificates/private keys. Real protected validation
remains a separate required evidence surface.

The local review checks passed 1,443 tests across 81 suites with the existing
coverage gates, lint and typecheck. The workflow test invokes 15 additional
Python test methods with synthetic credentials and mocked macOS operations.
Real disposable POSIX subprocess checks cover timeouts, excess output and a
leader exiting while a descendant holds its output pipe. Cleanup kills the
owned process group even after the leader exits, settles the reader before
closing its pipe, and suppresses background exception diagnostics. These are
subprocess-boundary checks, not real keychain or Apple authentication results.
The final cleanup wait also has failure regressions: a timeout or OS error must
still allow reader/pipe cleanup attempts and must fail with a fixed redacted
message, including after an otherwise successful command. A reader that remains
alive is never closed through its potentially locked buffer; the job fails and
requires the disposable runner to be discarded.

## Failure, rollback and separate owner decisions

Before removal of repository copies, correct environment entries from the
existing saved originals and retry only after understanding the failure. Preserve
the earlier failure evidence. Do not rotate a key, substitute a Store identity,
disable the approval gate, enable admin bypass or modify system trust to force a
pass. Do not repeatedly retry Apple authentication.

After removal, recover a broken environment entry from the same owner-retained
original. Reintroducing broader repository access is not an automatic rollback;
it requires a specific owner decision. The release workflow's secret names stay
unchanged. No existing release artifacts need replacement for this configuration
change alone.

The owner must confirm the legacy token's remaining consumers and ownership
before removal/revocation. A repository secret deletion does not revoke the token
at its issuer. Independent off-device credential-backup recovery is also still a
separate owner task; a correct GitHub scope check does not establish it.

References: [GitHub environment secrets](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#environment-secrets),
[secret API metadata](https://docs.github.com/en/rest/actions/secrets),
[ruleset update/deletion rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
and the installed Apple `security`, `codesign` and `notarytool` manuals.
