# Session 71: refreshed Dev/Beta builds and separate Mac Store test apps

The owner lifted the Dev/Beta build hold and requested refreshed iOS builds and
separate Mac Store test versions. This session prepares **1.0.1 (230)** local
unsigned candidates. It does not replace either production build in App Review.

## Source and identities

The review worktree is `.claude/worktrees/specdown-store-test-channels-20261102`,
based on reviewed main `a339b80556343b7c8f8aa9984b9c39cd1ae404d2`. Its application
JavaScript, Swift and dependency versions match the accepted `9d27fc1` runtime;
the later approved homepage/support/privacy copy is included in the new web
assets. The canonical owner checkout remains clean at `9d27fc1`; its generated
Xcode project, signing settings and installed applications were not changed.

| Use | Mac app name | Bundle ID | Configuration |
| --- | --- | --- | --- |
| Local Store development | SpecDown Store Dev | `com.mosaicpando.specdown.dev` | `electron-builder.mas-dev-channel.js` |
| Separate Store TestFlight | SpecDown Store Beta | `com.mosaicpando.specdown.beta` | `electron-builder.mas-beta.js` |
| Production Store | SpecDown | `com.mosaicpando.specdown` | Existing `electron-builder.mas.js`, unchanged |
| Direct download | Specdown Desktop | `com.specdown.desktop` | Existing `package.json` build, unchanged |

iOS keeps its existing **SpecDown Dev / SpecDown Beta / SpecDown** schemes and
identifiers. No iOS source/configuration change or version bump is necessary.
App Store Connect's Beta iOS history was checked separately by the coordinating
agent and only build 228 was present; 230 was available at that observation.
This is not an upload reservation. The new Mac Beta platform association and
matching profiles are separate account setup, not evidence supplied by a build.

## Data and sandbox separation

Each Mac test package embeds its own `name` and `productName` in package.json.
Electron derives `userData` from that name, and `sessionData` defaults to it;
changing only the outer app filename would not establish this separation.
See [Electron app paths and naming](https://www.electronjs.org/docs/latest/api/app#appgetname).
The distinct signed bundle IDs also select distinct macOS sandbox containers.
No migration, copied recents, bookmarks, annotations or shared preferences are
introduced. User documents remain external and must be chosen independently.

Electron's MAS IPC group is **also** separate for each test app:
`582YQWPT9G.com.mosaicpando.specdown.dev` and
`582YQWPT9G.com.mosaicpando.specdown.beta`. The production group is not inherited.
The other sandbox entitlements and inherited helper policy stay identical to
production. Test apps register Markdown as an Alternate handler, not a Default.
All MAS test builds retain the no-updater policy and exclude electron-updater.

The [Electron MAS guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
specifies the team-prefixed group and `ElectronTeamID`. Apple's
[macOS app-group explanation](https://developer.apple.com/forums/thread/721701)
distinguishes this convention from registered `group.` identifiers: macOS-style
groups cannot be explicitly registered and do not inherently need profile
authorization. Enabling the portal App Groups capability can add a team wildcard
to a Mac profile, which avoids some entitlement-validation limitations. This
session does not enable that capability or claim signed sandbox acceptance.

## Packaging checks

The existing installer permission guard is parameterized through a fixed list
of the three exact Store identities. Production exports and command-line checks
still default to the original production identity. Each test channel rejects
production/other-channel payloads and retains profile-file modes, safe links,
root:wheel installer ownership and complete-payload checks.

These guards check package identity and permissions; they do not decode and
authenticate the embedded provisioning profile's app ID/team/certificate. That
remains a mandatory independent signing preflight. No profile, private key,
certificate or signing credential is included in the source change.

## Local validation and artifacts

Evidence is under this worktree's `ios/DerivedData/test-channels-20261102/`.

- **1,382 tests / 79 suites** passed with required coverage; lint/typecheck pass.
- **60 focused packaging cases** passed, including mixed-channel payload and
  profile-environment negative cases. Existing iOS native-security/channel
  regressions pass.
- Independent review passed **116 synthetic checks**, with no blocking finding.
  It separately inspected actual packaged Dev/Beta metadata and source. Its
  report is `independent-review.json`; SHA-256
  `2d8d2471b799eb262c21e2f517657312ccb122895d816526aa263d201fda8684`.
- Actual unsigned iOS Dev Debug and Beta Release builds passed for simulator and
  arm64 device; a Beta Release unsigned archive also passed. Every app has the
  correct identity, 1.0.1 (230), both device families, iOS 16 minimum, primary
  icon plus seven alternates, and all 110 current web files. The initial sandboxed
  simulator invocation could not reach CoreSimulator; the same signing-disabled
  commands succeeded with scoped local execution.
- Actual unsigned **universal** Mac Dev/Beta applications were packaged from a
  verified physical dependency tree, never a top-level node_modules symlink.
  Each contains 128 application/native/web files including 110 current web files;
  all **8,559 packaged dependency files** exactly match the reviewed production
  230 dependency manifest. Packaged runtime names, app/helper bundle IDs, versions
  and no-updater policy were verified. Electron 45.1.0 archives and the unchanged
  universal N-API bookmark module were verified before reuse.

Exact local products (relative to this evidence directory):

- `ios-dev-device/Build/Products/Dev Debug-iphoneos/Specdown.app`
- `ios-dev/Build/Products/Dev Debug-iphonesimulator/Specdown.app`
- `ios-beta-device/Build/Products/Beta Release-iphoneos/Specdown.app`
- `ios-beta/Build/Products/Beta Release-iphonesimulator/Specdown.app`
- `SpecDown-Beta-1.0.1-230-UNSIGNED.xcarchive`
- `mac-development/mas-dev-universal/SpecDown Store Dev.app`
- `mac-beta/mas-dev-universal/SpecDown Store Beta.app`

These are unsigned inspection artifacts. They are not install-ready signed
device apps, uploadable installers, or proof of physical/TestFlight behavior.
No app was launched or installed, no live note store was read, and no QA document
or session was added to the packages.

## Next signing and test steps

1. Confirm the Beta record's macOS platform association and current build history.
2. Prepare a **Mac App Development** profile for `.dev`, using an existing valid
   development certificate and this registered Mac. For local Beta debugging,
   a separate `.beta` development profile is optional.
3. Prepare a **Mac App Store distribution** profile for `.beta`, using the
   existing valid distribution certificate. Profile generation does not create
   a certificate or private key. Validate exact app ID, team, certificate,
   expiration and entitlements before signing; never substitute production's
   profile. Existing installer signing remains separate.
4. Sign and install Dev only under the owner's applicable authorization; test
   coexistence and independent state with synthetic documents. Sign/upload Beta
   only after exact artifact verification and the applicable owner authorization;
   distribute only to the Owner group. Production TestFlight remains a separate
   final gate before any later release.

The new configs use explicit profile variables:
`SPECDOWN_MAS_DEV_CHANNEL_PROFILE` for local Dev;
`SPECDOWN_MAS_BETA_PROFILE` for Beta distribution; and
`SPECDOWN_MAS_BETA_DEV_PROFILE` for optional local Beta development. They never
fall back to production profile variables. Explicitly targeting `mas` with the
Dev configuration instead uses `SPECDOWN_MAS_DEV_DISTRIBUTION_PROFILE` for a
matching `.dev` distribution profile; ordinary local Dev uses `mas-dev` and does
not need that profile. `SPECDOWN_MAS_UNPROVISIONED=1` only
affects local mas-dev automatic entitlements; it cannot relax distribution.

After preparing the web bundle and native module, choose a config explicitly:

```sh
npx electron-builder --config electron-builder.mas-dev-channel.js --mac mas-dev --universal --publish never
npx electron-builder --config electron-builder.mas-beta.js --mac mas --universal --publish never
```

These ordinary commands can sign with configured credentials; the retained
inspection artifacts instead use recorded local wrappers with signing disabled.
Rollback is to stop using the new test configurations. Do not delete existing
apps or their data, and do not assume an Apple app-record association is reversible.
