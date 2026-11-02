# Session 33: Apple development and beta channel setup

Status: Dev profile, Beta app record and internal testing group created. The Beta manual distribution-profile wizard remains blocked at certificate selection. No signed build, upload, submission or public release occurred.

## Scope and source

The owner signed into Chrome and explicitly authorized the offered Dev/Beta setup checklist. This session follows [Session 32](2026-10-31-tasks-session-32-ios-development-channels.md) and the [channel contract](2026-10-31-spec-ios-development-channels.md). The canonical checkout remains at `729258b3ef31d9a4167e8e93fdd3f095d92a08d2`; source version remains 1.0.1 (228). Portal setup does not establish a new build identity.

The browser confirmed Apple team `582YQWPT9G`. All operations stayed on this Mac and the owner's connected Apple project pages. No other computers were accessed. Application source, signing configuration, owner keys, artwork and existing production identity were preserved.

## Completed portal setup

| Item                          | Verified result                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Development identifier        | Registered explicit App ID `com.mosaicpando.specdown.dev`.                                                                |
| Beta identifier               | Registered explicit App ID `com.mosaicpando.specdown.beta`.                                                               |
| Capabilities                  | Added no optional capabilities. Apple's non-editable In-App Purchase default remained present.                            |
| Beta App Store Connect record | Created iOS **SpecDown Beta**, Apple ID `6829391032`, bundle ID `com.mosaicpando.specdown.beta`, SKU `specdown-beta-ios`. |
| Primary language              | English (U.S.), matching the production record.                                                                           |
| Access                        | The individual account offered only Full Access; Limited Access was disabled. No account users or roles were changed.     |
| Internal TestFlight group     | Created **Owner**, UUID `3d912a7d-aff5-4004-aa60-d493653ee239`, with Chris as the only tester: **1 tester, 0 builds**.    |
| Group distribution            | Manual distribution of Xcode builds. No build was assigned or distributed.                                                |
| Beta store draft              | Default version **1.0** is metadata only. Saved the **manual public release** setting.                                    |

The portal confirmed creation of the Development profile **SpecDown Dev - iPhone Z - 2026-11-01**, profile ID `L5DG5F7Y8B`, for App ID `582YQWPT9G.com.mosaicpando.specdown.dev`, expiring **2027-11-01**. It uses only the existing current-Mac development certificate and the independently matched connected iPhone; no iPad or other Mac was selected. The team matched across all six local configurations. The portal showed the Download and Install success page, but the profile was **not downloaded or installed locally**. No certificate or private key was created or used for signing.

Beta remains a testing-only channel under project policy. Creating its app record also creates store metadata; the default 1.0 draft is neither a compiled version nor an App Review submission. Manual public release is a safeguard, not authorization to submit or publish Beta.

## Pending and blocked

- **Local Dev signing and physical acceptance pending:** the new portal profile has not been installed or used. No signed build, Run or physical-device test was performed in this session.
- **Beta manual distribution profile blocked:** the manual App Store Connect provisioning wizard reported **“No Certificates are available.”** No eligible distribution certificate appeared at that step. The Create Certificate action was not selected. This observation does not rule out Xcode-managed signing or establish that every certificate or signing option elsewhere in the account is absent.
- **Agreement status needs owner review:** the account page showed an October 13 agreement acceptance, while the App Store Connect apps banner requested review of a license update. These are conflicting visible status signals; no agreement was accepted in this session.

## Evidence and links

The local browser captures are retained in `ios/DerivedData/apple-channel-setup-20261101/`:

- [Registered identifiers](../../ios/DerivedData/apple-channel-setup-20261101/registered-identifiers.png).
- [Dev profile creation confirmation](../../ios/DerivedData/apple-channel-setup-20261101/dev-profile-created.png).
- [Beta Owner group](../../ios/DerivedData/apple-channel-setup-20261101/beta-owner-group.png).
- [Beta group settings](../../ios/DerivedData/apple-channel-setup-20261101/beta-group-settings.png).
- [Beta profile certificate blocker](../../ios/DerivedData/apple-channel-setup-20261101/beta-profile-no-certificate.png).

Portal links: [SpecDown Beta in App Store Connect](https://appstoreconnect.apple.com/apps/6829391032/distribution), the observed [Owner group settings](https://appstoreconnect.apple.com/teams/6b430881-e40a-419c-a973-2d9c009d82d3/apps/6829391032/testflight/groups/3d912a7d-aff5-4004-aa60-d493653ee239/settings), and the observed [Developer profiles list](https://developer.apple.com/account/resources/profiles/list). Find the Dev profile by the exact name and ID above; the creation wizard URL is not a stable profile link. These links require the owner's authorized account session. No private device identifier, tester email or certificate secret is included in this document.

## Next steps

1. Let the owner choose Xcode-managed automatic provisioning or download the completed Dev profile if needed. Do not pin a manual profile identifier into shared source configuration.
2. Have the owner reconcile the agreement banner and choose the appropriate Beta distribution-signing path. Any certificate/key creation remains a separate owner decision; no certificate was created here.
3. When provisioning is ready, use `SpecDown Dev` for the authorized local device test and verify coexistence with the production installation. Portal registration alone does not validate installation, data isolation or icon switching.
4. For a later Beta upload, confirm `SpecDown Beta` / `Beta Release`, the `.beta` bundle ID and an unused build number for that record. Create and verify the signed archive before upload; wait for Apple processing before assigning a build to Owner. All of those steps remain outstanding.
5. After beta feedback, validate the exact production-identity upload in TestFlight before App Review. A successful Beta test cannot substitute for that production gate. App Review submission remains conditional on acceptance of that exact production build; public release remains owner-controlled.

This local handoff changes documentation only. No commit or public deployment is part of this session record.
