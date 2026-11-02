# Session 69: Store copy sync and App Review submission

Date: 2026-11-02. Documentation of the coordinating session's portal and runtime
observations; this documentation task performs no Apple actions.

## Current release checkpoint

Production record **6822086808**, bundle `com.mosaicpando.specdown`, now has
**1.0.1 (230)** submitted for both iOS and Mac. The coordinating session observed
Apple's **1 Item Submitted** confirmation and **Waiting for Review** status for
each at **2026-11-02 08:50:52 UTC**. Manual release remains selected on both;
submission is complete, but no App Review approval or public release is claimed.

| Platform | Apple submission ID                    |
| -------- | -------------------------------------- |
| iOS      | `9fa906c7-c8e8-4a2d-9454-d61e8344c5f0` |
| Mac      | `d2bdaeb9-4fe6-4dda-9113-89015272f9d4` |

The approved [Session 67 packet](submission-copy-2026-11-02/README.md) remains the
exact copy source. The coordinating session saved and read back these fields in
the existing signed-in Comet session:

| Scope                     | Verified saved fields                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| iOS version               | Promotional text, description, keywords, What's New and App Review notes |
| Mac version               | Promotional text, description, keywords and App Review notes             |
| Shared TestFlight         | Approved description                                                     |
| Each production 230 build | Its platform-specific What to Test                                       |

The shared name **SpecDown** and subtitle **Markdown & Mermaid viewer** were
already exact and were verified without mutation. The TestFlight marketing and
privacy URLs were recorded as the existing SpecDown website URLs. The first Mac
version has no
What's New field; no historical reference text was added. This checkpoint
supersedes Session 67's pending TestFlight-copy status; it does not change the
packet's form values or the frozen application source.

## Corrected installation and acceptance

Chris clarified that his earlier passing checks covered **228**, not 230. That
clarification still supersedes the earlier attribution of those checks to 230.

The Mac has since updated through TestFlight. Independent installed-bundle
verification identifies `/Applications/SpecDown.app` as **1.0.1 (230)** and its
ASAR exactly matches the reviewed uploaded candidate. The coordinating session
observed a clean start, and Chris closed the old local 228 copy; only the installed
230 Store app was running at that checkpoint.

Chris subsequently answered **“Both platforms passed on 230”** to the explicit
production 230 iPhone/iPad and Mac testing question. This is a new owner-reported
functional acceptance of both production 230 builds; it supersedes the pending
acceptance checkpoint, rather than reusing the earlier 228 result. Installed Mac
identity/ASAR equality is independently verified. Functional acceptance is
owner-reported, with no additional per-device test matrix inferred.

## Screenshots and artwork

The portal retains five iPhone and five iPad screenshots from October 28. Those
approved assets and their existing baked-in captions were retained; the new
proposal's iOS caption changes were **not** applied to those images. They are
distinct from the retained local build 229 proof captures and are not relabeled
230 captures. Independent inspection of the corresponding retained local files
found no removed Link control or materially false current feature; Apple asset
identity is the coordinating session's observation, without a downloaded-byte
comparison.

Brand Halo and Reading Companion headers are Approved; the iOS draft retains
Brand Halo. Brand Halo search artwork is Waiting for Review and was not duplicated
or assigned.

Chris approved the five final Mac screenshots with **“Use these screenshots.”**
They use actual installed 230 app-window captures and synthetic `app-store/demo`
content. The approved existing compositor applies uniform downscaling, a window
frame and a header; it does not generate or replace application UI or stretch
it. All five final PNGs are RGB **2880 × 1800**, and their hashes match the retained
manifest. Captions come from the approved `e8dd3cb` proposal, including the updated
Gantt subtitle.

The approved five final PNGs and five referenced raw JPEGs are now also retained
unchanged in the versioned
[Mac screenshot packet](../../app-store/release-assets/1.0.1-230/mac/README.md).
Its portable manifest and composition recipe verify exact hashes, dimensions,
demo sources, caption wording and full recomposition without modifying the
retained images. Older artwork remains intact. Portal/account screenshots and
private identifiers are excluded from this asset packet.
The versioned manifest SHA-256 is
`12b6f268870e70a21e5592ae8f43402d1cca39c733bdc38028d9d7213c06603e`.
Independent asset-packet review verifies all ten original image byte streams,
exact in-memory reproduction, metadata privacy and safe output behavior. Its
local report is `independent/versioned-mac-assets-review.json`, SHA-256
`64ca769be3f6b2fe8b7e350eca923f3ed845af7b2dd9c583d153fa8db674fbfe`.

The five files are `01-source-preview.png`, `02-interactive-diagram.png`,
`03-release-plan.png`, `04-tables-code.png` and `05-dark-mode.png`, under
`mac-screenshots/final/` in the local evidence directory. The manifest's original
“Proof candidate; not uploaded” status is retained capture-time history. The new
owner approval and later upload are recorded here. The coordinating session
uploaded these five approved files in the listed order through Comet's native
file picker and read back five saved Mac screenshots before submission. No
browser extension permission was changed. Independent screenshot review passed
exact recomposition/pixel, format, caption, source and visual checks; this review
is separate from the observed Apple upload/submission.

## Evidence and preserved boundaries

Local evidence lives under `<repo>/ios/DerivedData/release-submission-20261102/`:

- `portal-copy-readback.json`: visible-UI field comparisons, build IDs, artwork
  status and explicit limitations; SHA-256
  `d220179b3da495217d615c2181ed6699a35a709b7346ba71399c53aa0dcf314a`.
- `independent/installed-mac230-after-update.json`: installed identity and matching
  ASAR; SHA-256
  `ec73628399421c4600644dce130a00b80e4f00ab3920107ee5a073979dc19651`.
  The matching ASAR SHA-256 is
  `6b0a8d1f77cd4621f737357f061e3c0ded11a04223050025113daa2a5bd76f15`.
- `independent/packet-acceptance-correction-review.json`: independent clearance of
  the corrected acceptance history with unchanged approved form values; SHA-256
  `5f948813522be3ed78dd5ac6a714322d64f88d9eb514b8a3a4c89797e301979d`.
  Its pending acceptance state is historical and is superseded by the new owner
  report above.
- `mac-screenshots/manifest.json`: five real-app captures, composition details,
  exact captions, dimensions and final hashes; SHA-256
  `14c90fdb96599306886b581d64370451951255c26b283609ca735ef22e24e956`.
- `mac-screenshots/independent-review.json`: passed screenshot review; SHA-256
  `a5b490d43e047f199d75f390495da8ed9d553adf6518d076e4b9589d1a827564`.
- `independent/ios-retained-screenshot-review.json`: narrow retained-image review
  and explicit historical/provenance limits; SHA-256
  `79f2032c00339a9ff152a4b41d4fe533967276b54fac1110d4efc7bce054579c`.
- `specdown-mac230-submitted.jpg`: retained Apple confirmation; SHA-256
  `c7ead12a2a7d971c0b20e5a76563bad4ae44ff5ba2d0007aad784c11bb02b131`.
- `specdown-ios230-submitted.jpg`: retained Apple confirmation; SHA-256
  `e68402527ced7b3f3368eb51cf37e3fd5d46f1c6f2ed4a632983bdf4b7f7cbdf`.

The portal report identifies iOS build
`adb33253-0916-40b0-9538-048d8def946e` and Mac build
`52ed2474-d598-4790-9099-fa1a468d5537`. The submission confirmations above are
retained browser images; earlier copy-form observations were inspected inline.
Contacts, privacy labels, ratings, account
settings, keys/profiles, Owner-only groups and the separate direct-download
desktop app were preserved. Website source changes are recorded in Sessions 66
and 68; their final deployment is verified below.

Canonical source `9d27fc1a6961e29c86def43cee17c6fbb7d66db1`, signing settings,
uploaded build 230 and earlier artifacts remain unchanged. Owner-reported
exact-build acceptance, approved Mac screenshots, portal synchronization and both
App Review submissions are complete. Apple's review outcome and eventual manual
public release remain separate next steps. This checkpoint records no
authorization bypass or authentication retry.

## Public website completion

Approved homepage, support and privacy copy from PRs #373/#374 is live from
`ae5d8bef57fa92dc14b20404f013f0aee566ad6d`. GitHub Pages run **41418925979**
succeeded. Fresh public HTTPS responses for `/`, `/support.html` and
`/privacy.html` all returned 200 and matched the reviewed production-build bytes.
The coordinating session also checked the actual public homepage in the browser.
Mac App Store availability remains described as coming; the Store releases are
still awaiting review and manual release.

Evidence is `independent/live-copy/http.json` and `RESULT.json` in the local
release directory. The retained public-homepage screenshot is
`specdown-live-homepage-20261102.jpg`, SHA-256
`66628d35bc0ded6ecab47de9a42a0c67a35d8ff6098df3dd16852be8e0d53170`.
Canonical native source and signed build 230 remain unchanged.

## Copy-packet reproducibility

The retained copy extractor now handles a missing Git executable as well as an
unavailable original Git object. The fallback still accepts only the five
independently reviewed snapshot hashes. The change catches `FileNotFoundError`
only around the Git subprocess; missing snapshot files and hash mismatches still
fail closed.

An isolated fixture without Git on `PATH` or Git metadata demonstrates the old
helper failure and the corrected read-only success. Changing or removing each of
the five pinned snapshots is rejected. All **40 generated copy outputs** remain
byte-identical to merged `ae5d8be`; the only generated change is the manifest's
extractor hash. No Apple field or submitted artifact changed. Evidence is
`independent/copy-no-git-fixture/RESULT.json` in the local release evidence.
Independent review also passed the exact helper/manifest delta and the
no-Git read-only check; report
`independent/copy-no-git-independent-review.json`, SHA-256
`9a2739d512b6a17291e4b3b7bb47f6ccc1942de55a6f1926d5c490196c345f18`.

## Documentation validation

All cited final evidence hashes and the five final/raw image pairs were checked.
The documentation worktree passes 1,371 tests in 78 suites, lint, typecheck,
Session 69 formatting and diff checks. These checks validate the unchanged
application baseline and documentation preparation; they do not replace the
separate portal, screenshot or owner acceptance evidence above. The temporary
dependency link was removed, and canonical source remains clean at `9d27fc1`.
