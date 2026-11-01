# iOS development, beta and production identities

Date: 2026-10-31. This contract separates local development and beta testing
from the existing production installation. One Swift target and one shared web
source tree produce all three apps; there are no channel-specific source forks.

## Identity and build selection

| Channel     | Display name  | Bundle identifier               | Shared scheme   | Run / test / analyze | Profile / archive | Default icon |
| ----------- | ------------- | ------------------------------- | --------------- | -------------------- | ----------------- | ------------ |
| Development | SpecDown Dev  | `com.mosaicpando.specdown.dev`  | `SpecDown Dev`  | `Dev Debug`          | `Dev Release`     | Flat         |
| Beta        | SpecDown Beta | `com.mosaicpando.specdown.beta` | `SpecDown Beta` | `Beta Debug`         | `Beta Release`    | Light        |
| Production  | SpecDown      | `com.mosaicpando.specdown`      | `SpecDown`      | `Debug`              | `Release`         | Original     |

`ios/project.yml` defines these six configurations and three shared schemes.
The default configuration is `Dev Debug`; select the scheme explicitly in
Xcode and quote both scheme and configuration names in shell commands. Production
retains its original identifier, product name, and Debug/Release names. The Mac
App Store identifier remains `com.mosaicpando.specdown` for universal purchase.

The source marketing version and build number remain **1.0.1 (228)** across
the three identities. These values identify prepared source, not an uploaded
build. Before a later upload, the owner checks that identity's App Store Connect
build history and chooses an unused build number.

Every channel offers the same eight manual artwork choices: Original, Flat,
Glass, Ceramic, Metallic, Layered, Minimal and Light. The primary artwork differs
by channel; the other seven are alternates. The picker maps the channel's primary
choice to UIKit's `nil` reset value, so Original remains selectable in Dev/Beta
and Flat/Light remain selectable in Production. No image bytes or automatic
appearance switching are introduced. Names identify the channel even after a
user changes its icon.

## Storage and document boundaries

Each bundle identity has its own app sandbox, standard preferences and WebKit
website data. Native preferences and the recent filename list use
`UserDefaults.standard`; the shared viewer stores its theme, bookmarks and URL
recents in the installation's WebKit storage. No shared App Group, UserDefaults
suite, Keychain access group, iCloud container or cross-channel migration is
configured. Existing production data stays with the production identifier.

The internal bundled origin stays `specdown://app` for all three apps. It is a
`WKURLSchemeHandler` inside each app, not an externally registered launch URL
scheme or a shared storage location. The existing main-frame bridge checks and
bundled-resource security policy remain unchanged. Native iOS annotation
storage remains disabled and untouched in every channel.

Files documents remain external user documents. Opening a file in one channel
reads it through that app's document picker/security-scoped URL; this change
does not copy, relocate or migrate the original or grant another channel access.
The user can deliberately choose the same Files document in multiple channels.
An explicit viewer bookmark can retain a local snapshot under existing feature
behavior; it belongs to that installation. Native recents currently retain names,
not persistent reopen grants, and their deferred UI remains unchanged.

Unsigned build inspection can verify configuration and absence of shared-store
entitlements. It does not prove installed data isolation or icon switching.
Those require a later authorized test with synthetic documents and separate
settings in each installed app; no live stores need to be read or reset.

## Distribution and owner actions

**Dev** is for local Xcode development and device tests. It does not need an
App Store Connect app record for that use. Device signing still requires the
owner's appropriate identifier, registered device and development provisioning
profile. Existing suitable development certificates may be reused; creating a
channel does not by itself require a new signing key. See Apple's
[development provisioning profile instructions](https://developer.apple.com/help/account/provisioning-profiles/create-a-development-provisioning-profile/).

**Beta** is a separate App Store Connect app record for the `.beta` identifier,
used for TestFlight testing only under this project policy. Its identifier and
distribution provisioning must be prepared by the owner. A suitable existing
distribution certificate may be reused with the new profile. See Apple's
[app record instructions](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
and [App Store provisioning profile instructions](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile).

**Production** remains the existing app record and exact original bundle ID.
After beta feedback, build and validate the final production configuration,
then test that exact production upload in TestFlight before selecting it for
App Review. A successful `.beta` build is useful feedback; it is not evidence
that the production upload has passed its own gate. TestFlight installations
are testing builds with expiration, as described in Apple's
[TestFlight guide](https://testflight.apple.com/).

This source change performs no identifier registration, App Store Connect
creation, profile or key generation, signing, account login, upload or submission.
The owner performs those actions separately. Unsigned CI must continue to avoid
Apple credentials and provisioning requests, and production validation must
assert the production bundle identifier as well as version/build and web assets.

## Verification and reversibility

Required configuration checks cover all six resolved build configurations and
all three scheme action mappings. Compiled product inspection checks identifier,
display name, channel, version/build, primary and seven alternate icons for both
iPhone and iPad, unchanged ATS policy, and the exact shared web assets. Tests
must prove the picker maps every artwork correctly for all three primary icons.
Production CI selects `SpecDown` / `Release` explicitly; no default or channel
suffix may redirect production validation.

To return to the production workflow, select `SpecDown` and its production
configuration. The extra configurations can remain unused or the logical source
change can be reverted. This does not merge or move data between installations.
Do not delete app installations or stores as a rollback step without an explicit
export/backup and owner decision; deleting an app can discard its local data.

Source rollback is separate from Apple account state. App ID registrations or
App Store Connect name/identifier reservations may persist, and this plan does
not promise they can be deleted or made available again. Keep any new account
records and their ownership documented rather than treating source reversion
as an account rollback.
