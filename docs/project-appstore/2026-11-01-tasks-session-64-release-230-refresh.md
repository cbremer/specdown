# Session 64: Refresh Store build 230 after dependency merges

Date: 2026-11-01 (America/Los_Angeles). Chris authorized fresh iOS and Mac App
Store builds and TestFlight uploads after the reviewed dependency updates merged.
App Review submission and public release remain separate steps.

## Exact candidate and preserved history

The refreshed candidate is `9d27fc1a6961e29c86def43cee17c6fbb7d66db1`, with native
version **1.0.1 (230)** and shared viewer version **0.0.230**. It includes Marked
18.1.2, Chokidar 6.0.0, Electron 45.1.0 and Vite 8.3.5, plus the reviewed desktop
watcher compatibility and destroyed-window cleanup corrections from Sessions
57–59. Marked and the rebuilt shared viewer affect iOS and desktop; Electron and
Chokidar are desktop dependencies. No new native iOS feature is implied.

| Artifact generation   | Source    | Meaning                                                                                                                         |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Historical signed 229 | `b9e5472` | Retained iOS/Mac Owner TestFlight builds from Session 52; predates Close Folder and these dependency updates.                   |
| Earlier unsigned 230  | `28848a2` | Session 55's unsigned iOS device/simulator and Mac arm64 review artifacts; includes Close Folder with the earlier dependencies. |
| Refreshed 230         | `9d27fc1` | New source-bound builds with the merged dependencies; this session's artifacts.                                                 |

The existing signed-in Comet session showed build 229 as the latest upload on
both platform histories before this refresh. Build 230 was unused, so its
number was retained. Earlier artifacts and their evidence were preserved; none
was relabeled as the refreshed build.

## Source and local verification

- Canonical source remains under `<repo>`; the iOS build uses
  `<repo>/ios/SpecDown.xcodeproj`. The generated project, schemes, signing settings
  and Xcode UI state were preserved. Ordinary local Run remains **SpecDown Dev**.
- Fresh **1,371 tests across 78 suites**, lint, typecheck and the production web
  build passed. The lockfile was unchanged by the physical dependency install.
- The frozen inventory binds **548 tracked files, eight generated project/UI
  files and 110 fresh web files**. Independent source and artifact reviews passed.
- The signing-disabled production iOS Release simulator build passed for arm64
  and x86_64 with matching dSYMs. The arm64 linker's ad-hoc signature is not owner
  distribution signing; this simulator result is not physical acceptance.

## Refreshed iOS TestFlight build

The production archive and exported IPA independently verify
`com.mosaicpando.specdown`, **1.0.1 (230)**, arm64, iOS 16 minimum, iPhone/iPad
families, Original plus seven alternate icons, and all 110 frozen web files.
The executable and archive dSYM share UUID
`F2AFC511-7901-3F44-A469-53F5E51926B9`.

Existing owner-approved distribution credentials were used. Manual export kept
version/build management off and symbols on, with no new keys, profiles or
provisioning-network updates. The verified IPA is **31,462,590 bytes**:

`96822947833dbec3e297651152045673177fd23b8c4d6a5f595fdf2c7241d514`

Transporter reported delivery at **11:09 PM on November 1**. Apple subsequently
processed the build. Read-only TestFlight verification showed the exact
**1.0.1 (230)** under production app **6822086808**, with **Owner** as its only
group (Internal, one tester) and zero individual testers. Existing automatic
assignment supplied that group; no portal fields were changed. The build list
said **Ready to Submit**; that label does not mean App Review submission occurred.
Physical iPhone/iPad acceptance of this exact build remains pending.

## Refreshed Mac Store build

Unsigned universal MAS packaging and independent verification passed for
`com.mosaicpando.specdown`, **1.0.1 (230)**, macOS 13 minimum and Electron 45.1.0.
The ASAR contains 127 source/web files, including the same 110 web files, and
8,559 dependency files. All ten native binaries contain arm64 and x86_64. The
Electron slices match the verified official MAS runtime archives; the existing
universal bookmark addon is preserved.

Unsigned manifest SHA-256:
`71cb0ff5089e26461cd36fe963ef1f7813577774a60512646d19cc6fcad5ee17`.
Store-only signing wrapper manifest SHA-256:
`43fb029fe958649b4a93c1d63d78db60ba5e829dd20d7e19c28bbe4df0ab98b9`.

Independent wrapper review passed its exact-source, existing-identity/profile,
permission-hook, universal-output and preservation guards. Publishing is
disabled. Store signing and independent final package verification now pass:
272 payload files, four internal links, 1,183 BOM entries and 591 extended-attribute
sidecars were checked, including the existing distribution/installer identities,
profile, entitlements, permissions and all 20 signed native architecture slices.
The verified package is **275,524,507 bytes**, SHA-256:

`b3d6abb9daf47681ff5de0a7d4e67d2324f29d96d86fa3d9942496b39f5c8809`

Transporter confirmed delivery at **11:22 PM on November 1**. Apple subsequently
processed the exact **1.0.1 (230)**. Read-only TestFlight verification showed
**Owner** as its only group (Internal, one tester), zero individual testers and
**Ready to Submit** in the build list. Existing automatic assignment supplied
that group; no portal fields were changed. This is not an App Review submission.
No refreshed Mac app was locally installed or launched; physical acceptance
remains pending. The installed direct-download desktop application and its data
remain separate.

## Remaining acceptance and proof

- Test the exact refreshed iOS/Mac TestFlight builds. Earlier Dev, simulator and
  unsigned Mac checks do not substitute for this acceptance. Include document
  open/recovery, diagrams/Find, iOS icons and Mac Close Folder with retained
  documents and live reload. Native iOS does not expose folder controls.
- Finish owner proof of the selected copy, artwork and screenshots. The clean
  copy proposal remains a proposal; this build refresh changes no listing copy,
  asset assignment or screenshot selection. Historical screenshots retain their
  recorded build provenance.
- Submit only after the exact build passes acceptance and owner proof. No app
  build was submitted for App Review or released publicly by this refresh.

Eleven existing Launch Weekend tracker rows were updated and read back through
the connector during preparation. After Mac processing completed, WK-12 was
updated to **Waiting for Chris**, with the exact Owner-ready build link and
physical acceptance still pending. Owner/dependency columns and formatting were
preserved.

## Local evidence

Evidence is retained under the ignored
`ios/DerivedData/release-230-refresh-20261101/` directory: `LOCAL-READY.json`,
`apple-before.json`, `ios-delivered.json`, `ios-owner-testflight.json`,
`mac-delivered.json`, `mac-owner-testflight.json`, the iOS
run's source/archive/IPA inventories, `mac/9d27fc1/`, and `independent/` reviews.
`tracker-update.json` and `tracker-mac-ready-update.json` record the bounded
tracker update requests; the request records alone do not prove readback.
The independent IPA report SHA-256 is
`e57c93be22586b5d7a122247f7cc4f8928a8cddc9850c35ec379f371ece7f626`;
the unsigned MAS report is
`d9b1eb7e35628486b06bfb0fc259f880355981bd907bf0d4f47642fb72c58894`.
The final combined independent release verification is
`721107d071159e50e819543e60bc18ad3b15c75cef7559157da6b845176aed84`;
it also confirms the canonical tree remains clean and all frozen source,
generated-project and web files remain unchanged.
Credential files, private profile locations, account screenshots and large
artifact inventories are not copied into this public handoff.
