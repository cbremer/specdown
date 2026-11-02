# Session 74: artwork placement and release checkpoint

Checkpoint: November 2, 2026, after the **9:18 AM PST** iOS resubmission and the
later owner-authorized desktop release dispatch.
This documentation records completed artwork placement, the unchanged production
builds and the separately prepared test/direct channels. It changes no source,
version, build, signing configuration or release setting.

## Production App Review and Search Results artwork

The existing **Halo Search Results** artwork is **Approved** and now assigned
to **Search Results → iOS App Version 1.0.1 → English (U.S.)**. The asset is
1920 × 1280; SHA-256
`145100f59dfcd82464ef3af665f4feb911136aafdb10b0f39554c8182da8af79`.
This completes the previously separate approval and placement tasks. No duplicate
artwork was uploaded. The placement applies to the iOS listing; this evidence
does not claim a corresponding Mac Search Results placement or public visibility
before the version releases.

Apple locked this placement while iOS was in review. Under the owner's explicit
authorization, only the iOS submission was removed and resubmitted after saving
the assignment. It uses the **same production 1.0.1 (230) build**, not a new binary.

| Platform | Build | Current submission | State at verification |
| --- | --- | --- | --- |
| iOS | 1.0.1 (230), `adb33253-0916-40b0-9538-048d8def946e` | `406c2e25-5414-4c3b-822b-fa7bde718005`, November 2 at 9:18 AM PST | Waiting for Review; manual release |
| Mac App Store | 1.0.1 (230), `52ed2474-d598-4790-9099-fa1a468d5537` | Original `d2bdaeb9-4fe6-4dda-9113-89015272f9d4`, November 2 at 12:48 AM PST | Waiting for Review; unchanged manual release |

The five approved Duo images remain in their approved order:
`inner-01.png`, `inner-02.png`, `inner-03.png`, `inner-04.png`, `inner-05.png`,
with **Room for your Markdown** first. Existing iPhone, iPad and Mac screenshots
were retained. The earlier 8:32 AM iOS submission
`95e90789-90d9-43b5-a370-75f62050b8bf` is now historical/Removed. Its original
Duo upload and resubmission evidence remains in [PR #382](https://github.com/cbremer/specdown/pull/382)
and [Session 70](https://github.com/cbremer/specdown/blob/151441c7352685980d492aeab1597ddd056f17ba/docs/project-appstore/2026-11-02-tasks-session-70-duo-release-artwork.md), retained in that PR; that history is not rewritten here.

Local verification at **17:20:28 UTC** is canonical
`ios/DerivedData/release-followup-20261102/artwork-completion.json`, with retained
portal readbacks and screenshots for assignment, Duo order and both review queues.
These local records are not copied into the public repository because the raw
portal captures include account-interface details. No public Store release is
claimed. The user controls release after Apple approval.

## Refreshed iOS and separate Mac Store test channels

The owner lifted the Dev/Beta build hold. [Draft PR #384](https://github.com/cbremer/specdown/pull/384),
commit `ce28899e9084e9521da148ea4c9694c2d5712dea`, prepares separate Mac Store
test configurations and retains the existing iOS channel identities.

| Test channel | iOS name | Mac name | Bundle identity |
| --- | --- | --- | --- |
| Local development | SpecDown Dev | SpecDown Store Dev | `com.mosaicpando.specdown.dev` |
| Separate TestFlight | SpecDown Beta | SpecDown Store Beta | `com.mosaicpando.specdown.beta` |

Unsigned **1.0.1 (230)** iOS Dev/Beta simulator/device apps and a Beta device
archive are built and verified. Two unsigned universal Mac test apps are also
built, with separate packaged runtime names and per-channel sandbox IPC groups.
No live data, recents or annotations were copied between apps. The Mac packages
exclude the direct updater. Production Store 230 and direct desktop identities
are unchanged.

The channel candidate passed **1,382 tests across 79 suites**, coverage,
lint/typecheck and native checks, plus **116 independent checks**. Exact-head
GitHub CI **41489846648**, iOS **41489846350**, desktop package validation
**41489846443** and version check **41489846346** all passed. PR #384 remained an
open draft at this checkpoint; its [Session 71](https://github.com/cbremer/specdown/blob/ce28899e9084e9521da148ea4c9694c2d5712dea/docs/project-appstore/2026-11-02-tasks-session-71-store-test-channels.md), retained in that PR, records the full artifact paths,
source provenance and signing boundary.

Evidence is retained in
`.claude/worktrees/specdown-store-test-channels-20261102/ios/DerivedData/test-channels-20261102/`.
Its `COMMIT.json` SHA-256 is
`fd7791f286d0f79f773a1def7a337b717674628a4a1c7ee14da5b6fcb6b2d08e`.
These are **unsigned inspection artifacts**, not installed test versions,
uploadable Store packages or TestFlight acceptance.

The existing Beta record's iOS history showed only 1.0.1 (228); build number 230
was unused in the inspected Beta history. This is not an upload reservation or
an available TestFlight build. Adding macOS to that Beta record is a separate persistent
account association awaiting its specific owner authorization at this checkpoint.
No Mac Dev/Beta profiles existed in the inspected profile inventory. Dev needs
a matching Mac development profile for this Mac; Beta needs a matching Mac App
Store distribution profile. Existing suitable owner certificates can be reused;
creating a profile does not create a new key. Exact profile app ID, team,
certificate, validity and entitlement checks precede any authorized signing.

## Direct desktop and release controls

[Session 72](2026-11-02-tasks-session-72-direct-desktop-231.md) records the regular
desktop **0.0.231** candidate, including Close Folder and the reviewed security
and dependency changes. PR #383 was rebase-merged to
`df3701c0ce2d9a4651caa7a62b04512bb789b07d`; the version workflow created the exact
immutable `v0.0.231` tag and a draft release. The original reviewed package source
`66a805bb88071471f1a788890b09ea21c371d1fd` has the same complete Git tree. The
unsigned Mac artifacts and 13 isolated runtime cases passed, followed by the
independent archive/native/dependency audit. The release was still unpublished
with zero uploaded assets at the independent readback.

[PR #385](https://github.com/cbremer/specdown/pull/385) added an explicit
owner-release mode for this sole-maintainer repository. Independent review
cleared reviewed commit `3558a807fce2052ae6780305a5942fcd1b9af78b` after 75 focused
tests and 20 additional malformed/network failure checks; all CI and CodeQL checks
passed. The owner then explicitly approved its merge and provider configuration.
It was rebase-merged to `3759f7606f9ded1e002065343274465d2cab6575`; both reviewed
and merged commits have tree `befc7dd6f33158b467492206d2d98829566b93c6`.

The default independent-approval mode stays intact. The explicit owner mode
requires an exact owner/repository identity, the owner as sole reviewer,
main-only deployment, no administrator bypass and a deliberate mode selection.
The human owner must approve the actual pending deployment directly in GitHub;
the agent cannot approve on his behalf.

The live `desktop-release` environment was created and independently read back:
the sole required reviewer is **cbremer**, numeric owner ID **4009517**;
`prevent_self_review=false`, `can_admins_bypass=false`, and the sole allowed
deployment branch is exact **main**, with no tag policy. The reviewed verifier
passed against the actual GitHub API responses. Contributor PR ruleset inventory
was unchanged. Provider evidence is canonical
`ios/DerivedData/release-followup-20261102/desktop-release-environment-verified.json`
and `desktop-release-branches-verified.json`. No signing secrets were read or
migrated; their scope remains a separate maintenance item.

The authorized signing/publication workflow was dispatched from main in explicit
`repository-owner` mode for the existing immutable **v0.0.231** tag:
[run 41496140750](https://github.com/cbremer/specdown/actions/runs/41496140750).
Its provenance job **passed**, including the live owner-policy verification.
At the saved checkpoint, all **three release build jobs were waiting for the
required owner deployment approval**. No release build or signing step had
started; this dispatch is not a signed/notarized artifact or public release.

Chris must personally open that run and choose **Review deployments →
desktop-release → Approve and deploy**. If GitHub is signed out, he signs in
himself first. The agent does not retry authentication or click the approval.
The saved `desktop-release-owner-approval-waiting.jpg` and `.txt` in the same
evidence directory record this gate. After approval, every platform must pass,
and signed/notarized Mac artifacts and update feeds must be verified before
claiming publication. Manual release for the two Apple submissions is unchanged.

## Concise owner handoff

- **Artwork:** Search Results artwork is approved and assigned; all five Duo
  screenshots remain attached. Both production apps are Waiting for Review with
  manual release. Apple review and the later owner release decision remain.
- **Dev/Beta:** local unsigned candidates are built and checks pass. Finish the
  separate Mac Beta association/profile setup, then exact signing, installation
  and Owner-only TestFlight acceptance under the applicable owner authorization.
- **Regular desktop:** 0.0.231 source is merged and tagged; verified unsigned
  artifacts exist. The release policy is merged, its protected environment is
  verified, and the release run has passed provenance. Chris must approve its
  pending deployment in GitHub; signing, notarization and all-platform validation
  follow before publication can be confirmed.

The canonical local checkout remains clean at
`9d27fc1a6961e29c86def43cee17c6fbb7d66db1`. Source work stays inside this repository's
worktrees; no other computers, live note stores, private keys or passwords were
accessed for this checkpoint. Historical [Session 70](https://github.com/cbremer/specdown/blob/151441c7352685980d492aeab1597ddd056f17ba/docs/project-appstore/2026-11-02-tasks-session-70-duo-release-artwork.md) and [Session 71](https://github.com/cbremer/specdown/blob/ce28899e9084e9521da148ea4c9694c2d5712dea/docs/project-appstore/2026-11-02-tasks-session-71-store-test-channels.md) and their artifacts
retain their original evidence rather than being relabeled as current uploads.
