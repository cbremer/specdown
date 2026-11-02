# Session 73 — explicit owner approval for desktop releases

Date: 2026-11-02. Chris clarified that he is SpecDown's sole maintainer and that
independent contributor review exists for future outside contributions. This
change supports his release approval without altering contributor PR protection.

## Result and authorization boundary

The desktop workflow now offers an explicit `release-approval-mode` choice:

| Mode                    | Required `desktop-release` environment configuration                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `independent` (default) | At least one required reviewer, self-review prohibited, administrator bypass prohibited, only the `main` branch allowed.                                                                                     |
| `repository-owner`      | Exactly one required User reviewer matching the live user-owned repository's owner by numeric ID and login, self-review explicitly allowed, administrator bypass prohibited, only the `main` branch allowed. |

Owner mode is never inferred from missing reviewers, an inaccessible API or a
failed independent check. Organizations, teams, bots, additional reviewers,
mismatched IDs/logins, unknown modes and missing required metadata fail closed.
The API checks are read-only. The provenance job has explicit `contents: read`
and `actions: read` permissions for repository and deployment-policy inspection;
no administrator token or account-write permission is added. GitHub documents
Actions read permission for both [environment inspection](https://docs.github.com/en/rest/deployments/environments#get-an-environment)
and [deployment branch-policy inspection](https://docs.github.com/en/rest/deployments/branch-policies#list-deployment-branch-policies).

This source change does **not** create an environment, assign reviewers, move or
read signing secrets, change branch protection, approve a deployment, sign,
notarize or publish an app. Those provider settings remain separate owner-scoped
setup. The current source review is not proof that the live environment exists.

The existing signing step reads GitHub's `secrets` context; the verifier does not
require environment-only secret storage. Existing repository-scoped signing
secrets can therefore satisfy the unchanged signing step after normal deployment
approval. Narrowing their storage scope is separate maintenance, not an added
publication blocker in this change. Repository-scoped secrets remain available
to other sufficiently authorized repository workflows, so passing this release
gate must not be described as completing credential-scope hardening. No secret
values are inspected or moved here.

## Human approval remains required

In owner mode, Chris must use GitHub's pending-deployment approval UI himself.
An agent must never approve its own release run, click the owner's approval
button or call the approval API on his behalf. Starting a run is not approval.
If GitHub presents build and publication deployments separately, Chris approves
each pending stage after reviewing it. Administrator bypass is prohibited in
both modes; this is a normal required-reviewer approval, not a bypass.

The existing release boundaries remain intact:

- Dispatch only the reviewed workflow from `main`, with an exact existing tag
  that resolves to an ancestor of `origin/main` and matches its package version.
- The default remains unsigned artifact-only preview. Owner mode has no effect
  on an unsigned preview and does not make it publishable.
- Signed release builds require the verified environment, unchanged signing and
  notarization checks, and all macOS/Windows/Linux artifacts to pass.
- Publication uses that run's artifacts, rechecks immutable tag identity, requires
  an existing draft release and refuses to replace a public release.
- GitHub PR review and branch protection remain unchanged. Apple Store signing,
  TestFlight, App Review and public release remain separate workflows.

The provenance verifier is checked out from the selected `main` workflow
revision. The application is separately checked out from the resolved immutable
tag. Therefore, this policy must be reviewed and merged before dispatch, but an
already reviewed app tag does not need application-source changes just to use
the new owner approval policy. Production iOS/MAS **1.0.1 (230)** and the direct
desktop candidate's version/source are not modified by this change.

## Validation

The focused suite passes **75 cases**, including default-independent behavior,
owner-mode success, mode typos, organization/bot ownership, absent metadata,
wrong owner/reviewer IDs or logins, extra/duplicate reviewers, self-review and
bypass settings, wrong branch/tag policies, HTTP failures at every API boundary,
and unchanged workflow publication dependencies. All fixtures are synthetic;
no GitHub account setting or signing credential is used by the tests.

Full **1,413 tests / 78 suites with coverage**, lint, typecheck and the web build
pass. Independent review is recorded with the candidate handoff.
Local evidence lives in `ios/DerivedData/owner-release-policy-20261102/`. The
canonical checkout and its generated Xcode project remain untouched.
