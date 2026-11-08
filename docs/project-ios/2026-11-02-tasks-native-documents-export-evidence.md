# iOS wave report — 2026-11-02

**Latest feature source: `3826a90e970fc17b269c04847b3bd8cc88bb848a`.** Eight native tests pass on both task-created Phone and iPad; every one of the ten real bundled diagram types stages as SVG. The final combined eight-test replay also passed; see the final section for exact input head and source manifests. Earlier replay entries remain historical checkpoints.

## Source and boundaries

Assigned worktree: `<isolated-ios-worktree>`
Branch: `codex/wave-102-ios`; baseline `63c2e8af12fbc2aae0ce7a2a16cabdcc32e3a07d`.

Local commits, in order:

1. `91f9b2a876bb9359374fd041892845ff0e4507e3` — accepted bookmark-backed recents.
2. `d3e2cc1dc108e61e44348073ad8f269801380a95` — separately authorized relative image resources.
3. `81b7741c1192a0021c94dd3c72f454f1237aa6bd` — native diagram Save/Share lifecycle and hosted native runtime tests.
4. Earlier review head `5635cc77d0103b18b9d7379797e630c4b6f67eb6` — final independent-review fixes: folder chooser ownership, canonical root pinning, bounded bookmark resolution/source registry, resource-free SVG policy and export action ownership.

5. `b9d7ccaf8ef7c50e51c8b060e9030ee05979cdc9` — CI verifier accepts only the known optional hosted test bundle, with strict app/channel and unknown-target rejection. Parent already integrated this as `747a813`.
6. `c9bec88e6cd95fe9f991d1228fbcf9b1c2014ac0` — preserve newer native reads after older accepted opens; distinguish native acceptance from manual navigation; carry coordinated accessor URL consistently.
7. `8da327006168b7acb618e0df4aa4a81decee2b6c` — narrow safe SVG support for all bundled types, permanent actual-showcase regression, accurate native file-export help.
8. Protocol review head `de82714be97799ccaadd458a0965a8c032f608fd` — ignore unknown/expired native delivery IDs after manual navigation/reset/rejection.

9. **Latest head `3826a90e970fc17b269c04847b3bd8cc88bb848a`** — defer same-ID moved recent image authority until the acknowledged coordinated URL; actual moved-bookmark/new-folder/image regression.

**Review/publish the complete stack together.** Earlier snapshots have findings fixed by the final lifecycle commit. Nothing was pushed, no PR was created by this agent, and no merge/signing/device installation/Apple account/upload/deployment action occurred. Canonical checkout, frozen artifacts, and other worktrees were not modified. No live document or annotation store was inspected. Native iOS annotations remain disabled.

Source Store configuration remains baseline 1.0.1 (230); simulator commands explicitly override `MARKETING_VERSION=1.0.2`, retain the existing non-upload build placeholder, disable signing, and preserve the direct package series 0.0.232. Parent owns the integration marketing-only decision. No Apple build number was allocated.

## Implemented behavior

### Recent documents

Accepted native Files opens retain bounded provider bookmarks, independent record IDs and full parent location hints. Same filenames are not merged. Reopening a recent resolves its bookmark without system UI, coordinates provider reads off the main thread, renews bookmark data after success, then records it only after renderer acceptance. Legacy filename-only defaults remain untouched and confer no authority. Corrupt/future recent stores are preserved rather than overwritten.

Bookmark resolution and reading share one permit/deadline. There are at most four outstanding provider operations and two waiting renderer deliveries. A 15-second deadline invalidates a slow result and offers recovery; a blocked system provider operation may continue until the OS returns, and still occupies its slot. Late results cannot become accepted documents. Provider objects stay on their worker thread. Retry/Locate/Cancel recovery leaves the current view intact.

Renderer delivery is serialized through its acknowledgment, then eligibility is rechecked. Each synchronous native acceptance is marked with a unique call-local delivery ID; later tab/raw navigation never reuses that marker. Native acceptance preserves newer eligible native reads; manual transitions invalidate their generation and permits. Owned native transition messages do not activate a previously stored URL before acknowledgment, so moved same-ID recents cannot reuse an old image base. The current expected view token is captured at actual serialized dispatch and checked **inside** `loadFileContent` before `createTab`. The native request/response returns the actual accepted token and open source IDs; late acknowledged or unknown native messages are inert and cannot roll a newer view backward. Older requests are cancelled once a newer request is accepted, while a rejected newer request does not suppress older valid content. Coordinated accessor URLs determine accepted names, location hints, bookmarks and image bases; scope is balanced on the original grant. Initial cold-start requests survive first viewer setup; old-page callbacks are invalidated on subsequent page loads. Accepted view tokens contain a per-page epoch, so A→B→A and WebKit reloads do not reuse image/export authority.

Reopening an existing recent preserves its native record ID. A new picker selection conservatively creates a fresh ID rather than merging documents by a filename, content hash or unproven path equivalence. Repeated picking of the same item can therefore leave separate recent occurrences, bounded to 20. These IDs are not imported annotation identity or file grants.

### Relative images

`Allow Local Images…` is a native-only viewer-menu item with menuitem semantics. It asks through the native folder picker; a Markdown file grant never implies folder authority. The chosen folder must contain the current document. This permission is deliberately scoped to the accepted view and is requested again after view changes.

`specdown-resource://<view-token>/<encoded-path>` is separate from bundled `specdown://app` assets. CSP grants the new scheme only to `img-src`. Ordinary URI-encoded filenames are decoded once before transport encoding, and the native transport decodes once. Parent traversal, absolute paths, remaining encoded escapes, NUL, backslashes, query/fragment tricks and symlink components are refused.

The selected folder is canonicalized with POSIX `realpath` (Foundation can rewrite `/private/var` to `/var`), then opened by a per-component `O_SEARCH`/`O_NOFOLLOW` walk from a pinned filesystem root. The final descriptor is pinned while its scope is active; reads duplicate that descriptor and use `openat`/`O_NOFOLLOW` for every child. Replacing any ancestor after selection cannot redirect authority. The scope and descriptor are released on view changes/deinitialization. Folder pickers retain weak-keyed controller identity and original view tokens. Navigation dismisses/invalidate the current picker; old selections/cancellations neither consume a newer picker token nor fall through to file opening. Cancelled scheme tasks receive no callbacks; a final token check rejects delayed results.

Limits: single-frame PNG/JPEG/GIF/WebP only; 8 MiB encoded, 16 million decoded pixels and 8192 per edge per image; 64 read attempts, 32 MiB encoded and 32 million pixels per accepted view. Real ImageIO metadata is used. Local SVG/animated image resources are intentionally excluded. Aggregate tests use actual generated PNGs, not mocked dimensions.

### Native diagram files

Existing fullscreen SVG/PNG actions now send actual current-diagram payloads to the native shell. The renderer never falls back to an unrelated fullscreen diagram. PNG rasterization is single-flight, bounded before allocation, cancelled on document replacement, and expires after 30 seconds. It checks context again after image loading, canvas encoding and FileReader completion.

The native Export Diagram chooser offers **Save to Files…** (`UIDocumentPickerViewController` copy export) and **Share…** (`UIActivityViewController`), with proper iPad popover anchors. Only one export is staged/presented at a time. Both Save and Share chooser actions require their captured native-generated lifecycle ID; controller-identity checks reject stale callbacks even if a caller replays a request ID. Chooser dismissal completes before the next sheet is presented.

SVG is limited to 2 MiB and parsed with namespace-aware SVG/limited label-HTML element, graphics attribute and CSS function/at-rule allowlists. All namespace aliases of href must be fragments. External image/srcset, CSS image-set, entity/stylesheet PI and active content are rejected. Unsupported SVG elements/CSS fail explicitly rather than being silently removed. PNG is limited to 8 MiB encoded, 8192 pixels per edge and 16 million pixels. Native ImageIO validates actual PNG metadata. Temp files use generated names in an app-private directory, are removed after completion/cancellation/navigation, and abandoned directories are cleaned once at the next process start. The removed Link control was not restored; no hosted link sharing is implied.

## Independent findings addressed

Immutable recents review: `/tmp/specdown-ios-recents-review.md`.

- Dispatch/ack race: fixed with `DocumentDeliveryQueue`, a portable held-ack ordering regression, and renderer-side expected-view checks.
- Indistinguishable same-name hints: production records now retain the full parent path.
- Cold-start invalidation: first page load does not invalidate initial pending opens; intentional queued content is rebound for a later page.
- Parent follow-up: ID/name/location and aggregate encoded recent-store sizes are bounded on write and read.

Immutable images review: `/tmp/specdown-ios-images-review.md`.

- CSP missing the new resource scheme: fixed narrowly in `img-src`, protected by the security regression and real WK image test.
- Root-ancestor replacement escape: fixed by pinned folder descriptors/scopes, protected by an actual rename+symlink substitution test.
- URI-space double encoding: fixed and tested through real Marked + DOMPurify and a native PNG named `my diagram.png`.
- Inert iOS menu action on web/desktop: now native-only and supplied with menuitem semantics.

Further review findings, addressed by final `5635cc7`:

- Folder picker callback ownership: weak-keyed controller/token registry, stale callback classification and navigation dismissal; a fifth hosted test preserves the first-view image test and proves an old folder selection/cancel cannot consume the new view's picker.
- Grant-time root ancestor race: POSIX canonical string + per-component `O_SEARCH`/`O_NOFOLLOW` walk, then pinned final fd. Portable tests initially exposed Foundation's `/private/var` alias normalization; the final realpath-based implementation passes both ordinary temp-root and replaced-ancestor tests.
- Unbounded rejected-open URL registry: URLs are inserted only after renderer acceptance, then retained only for at most 20 recents plus at most 10 native open-tab IDs. Equal-token activation explicitly fills a previously nil document URL after the acceptance callback; the original real WK image regression still passes.
- Bookmark resolution outside provider bounds: resolution now runs inside the same four-slot/15-second accounting and permit as the read. Actual blocked operations retain their slot until the worker exits.
- Lost main TypeScript pragma: `// @ts-check` is again the first line; imports follow it, and typecheck passes with the file opted in.
- SVG export validator bypasses: `/tmp/specdown-ios-export-review.md` recorded actual img/srcset, CSS image-set and aliased XLink fixtures. All three are now rejected by native regressions; a safe drop-shadow CSS regression and actual Mermaid SVG runtime test prevent over-restricting current output.
- Stale Save/Share chooser actions: captured native lifecycle IDs are required by both action closures and the transition method; the hosted test attempts old-A selection against B and confirms B's chooser remains unchanged.

Subsequent review followups are now implemented and tested:

- CI project verifier: known optional `SpecDownTests` unit-test bundle only; no filtering away unknown targets. It rejects extra applications/aggregate targets/unknown test names, wrong product types, duplicate targets, incorrect host dependencies, app→test dependencies and wrong test bundle identity/host/loader. All original six app configurations and three channel schemes still receive their original identity/icon/ATS/document checks. Twenty-three CLI tests pass, including generated real projects with marketing 1.0.1 and 1.0.2.
- Accepted A before newer B: an actual held `NSFileCoordinator` read deterministically reproduced the old failure. The final transition protocol lets B complete after A, while preserving B-first/late-A, rejected-newer/older-valid, cold start and manual A→B→A guards. Unknown nonnil delivery IDs are ignored rather than treated as manual navigation.
- Real bundled SVG compatibility: the read-only combined probe rendered all ten types but initially rejected sequence `name`, Gantt `transform-origin`, git `xml:space`, and journey `switch`. Only those harmless SVG names were added; namespace, child element, URI and CSS restrictions remain. The permanent hosted test stages every real bundled type, and malicious external-reference fixtures remain rejected.
- The diagram-showcase introduction now describes SVG/PNG files and native Files/Share, without advertising hosted links.

Parent final combined review and exact-head CI remain separate; this report does not claim final-candidate certification.

## Checks and evidence

All commands ran in the assigned worktree; dependencies were a read-only symlink to the already installed canonical `node_modules`. No dependency or lockfile change occurred.

- `npm test -- --runInBand`: **82 suites / 1,450 tests passed**. Log `/tmp/specdown-ios-final-moved-tests.log`.
- `npm run test:coverage -- --runInBand`: **82 suites / 1,450 tests passed**, configured desktop-main thresholds passed. Desktop main 72.89% statements / 63.04% branches / 64.49% functions / 75.49% lines. Log `/tmp/specdown-ios-final-followup-coverage.log`. Renderer instrumentation remains the known eval-harness limitation; no renderer coverage claim is made.
- `npm run lint`: passed with zero ESLint warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed. Build output `/tmp/specdown-ios-final-followup-build.log`, generated `markdown-viewer/dist`; package version 0.0.232. Existing Vite large-chunk advisory remains.
- `bash scripts/test-ios-security.sh`: passed all portable native executables: security policy/acceptance, icon catalog, recent persistence and held-ack ordering, actual image authority/limits/symlinks/ancestor replacement, exact diagram bytes/concurrency/cleanup/unsafe XML. Log `/tmp/specdown-ios-final-protocol-portable.log`.
- `git diff --check`: passed.
- Generated isolated Xcode project via `xcodegen generate --spec ios/project.yml --project ios`; generated project is ignored.

Actual hosted native test command:

```sh
xcodebuild -project ios/SpecDown.xcodeproj -scheme 'SpecDown Synthetic Tests' \
  -configuration 'Dev Debug' \
  -destination 'platform=iOS Simulator,id=08DC8F57-C450-47C1-B883-2215ACF85522' \
  -derivedDataPath /tmp/specdown-wave-ios-derived \
  MARKETING_VERSION=1.0.2 CODE_SIGNING_ALLOWED=NO test
```

**Eight tests passed, zero failures on both Phone and iPad**, with real bundled Vite/Marked/DOMPurify/Mermaid, WKWebView, native file coordinators/bookmarks, ImageIO, UIKit presentations and actual canvas PNG output:

1. `testColdOpenRecentRestartAndRealWKImageAuthority`: a synthetic open before initial WebView; accepted recent; image width zero before explicit authority and one after grant; new bridge instance reloads/reopens the retained bookmark.
2. `testFilesAndSharePresentationCancellationAndStaleCallbacks`: actual native Files export picker and Share sheet presentations; cancellation delegate/completion callbacks clean temp files; an old picker callback cannot clean a newer share. The production `choose` method is invoked directly in this test; user taps in the system sheets are not claimed.
3. `testNativeExportChooserAndCancellationCleanRealFiles`: actual Mermaid rendering and fullscreen SVG button dispatch reach the native chooser; changing the accepted document removes the staged SVG.
4. `testRealPNGExportStagesPNGBytes`: actual fullscreen PNG action goes through real image/canvas/FileReader/native validation and stages a PNG with the correct eight-byte signature; navigation cleans it.

5. `testStaleFolderPickerCannotConsumeNewViewAuthority`: two real native Files document opens and folder picker presentations; navigation invalidates/dismisses A; A selection/cancel callbacks cannot authorize B or consume B’s picker; B’s own callback then loads its image.

6. `testNewerNativeReadMayFinishAfterOlderAcceptedRead`: holds newer B with a real coordinated writer, starts A and B, observes A accepted first, then releases B and verifies B becomes current with recents `[B,A]`. Old code failed specifically at the newer-eligibility wait; final code passes.
7. `testEveryBundledDiagramStagesNativeSVG`: renders all ten actual bundled Mermaid types and stages each through the real native SVG policy; SVG attachments are retained in the result bundle. The host chooses actual phone/pad layout by idiom for this test.

8. `testMovedRecentUsesAcknowledgedImageBase`: moves a real synthetic directory after initial bookmark acceptance, reopens the same recent at its new location, grants the new containing folder, and verifies the PNG loads. The pre-fix run accepted the new location but failed the grant because an old registry base had been preactivated; the final run succeeds.

Final Phone log `/tmp/specdown-ios-final-moved-phone.log`; result bundle:
`/tmp/specdown-wave-ios-derived/Logs/Test/Test-SpecDown Synthetic Tests-2026.11.02_16-07-17--0800.xcresult`.

Compile/test warnings are explicit: SDK XCTest dylibs were built for iOS17 while the synthetic test target inherits iOS16; AppIntents metadata extraction is skipped because there is no AppIntents dependency. Runtime logs contain Apple's WebPrivacy, duplicate AX implementation and WebProcess/RBS teardown diagnostics; the eight assertions/tests pass. No warning is being presented as a demonstrated product failure.

Final iPad log `/tmp/specdown-ios-final-moved-ipad.log`; result bundle `/tmp/specdown-wave-ios-derived/Logs/Test/Test-SpecDown Synthetic Tests-2026.11.02_16-07-39--0800.xcresult`.

The final exact-head generic simulator build uses the same 1.0.2 override and signing prohibition; log `/tmp/specdown-ios-final-head-generic-build.log` (BUILD SUCCEEDED at exact head 3826a90; status also supplied in parent handoff).

## Disposable simulator inventory and cleanup state

- `SpecDown-Wave102-01a19e5f`, iPhone Duo / iOS27.1: **EEE4EBDC-3214-4DC8-8E57-E446D77F230C**. Newly created by this task; boot, unsigned install and launch succeeded. Phone-display screenshot `/tmp/specdown-wave-ios-phone.png`. Duo's two displays require `simctl io <UUID> screenshot --display=1`; XcodeBuildMCP AX sessions timed out. No functional Duo sheet acceptance is claimed.
- `SpecDown-Wave102-01a19e5f-Phone`, iPhone16 / iOS26.5: **08DC8F57-C450-47C1-B883-2215ACF85522**. Newly created by this task; hosted runtime tests above passed. Reserved for parent integration reruns.
- `SpecDown-Wave102-01a19e5f-iPad`, iPad A16 / iOS26.5: **3F3A4EA4-9BBD-40D8-9657-C451914F084E**. Newly created for the requested combined replay; both the earlier five-test combined run and the final eight-test feature run pass.

The task-created Duo simulator was shut down at the parent’s request after its smoke evidence. The task-created stable Phone and iPad remain booted for parent review/integration. No pre-existing simulator was booted, shut down, erased or deleted. None of the three task-created simulators has been erased or deleted. The initial attempted iPhone16/iOS27.1 creation was rejected as incompatible and created no device; the runtime supports Duo only. Parent can shut down/delete these exact three UUIDs after integration evidence is retained.

## Remaining acceptance boundaries

- Physical iPhone/iPad, signed Dev/Beta/production apps and real iCloud/third-party provider moved/deleted/revoked/offline scenarios remain pending. Portable tests and simulator local bookmarks do not prove provider behavior. Verify Retry/Locate, cancellation during downloads, moved bookmark refresh and permissions after real app restart.
- System Files selection/save destination and external Share recipient completion still require owner interaction/acceptance. The suite proves real controller presentation and cleanup callbacks, not actual transfer to a third-party app.
- The relative-image folder picker needs real provider/folder-grant acceptance; the WK test grants the production resource service directly after demonstrating denial first. No implicit folder grant was added.
- Native iPad Files/Share/popover presentation and cancellation pass on the disposable A16. The original five-test harness intentionally hosts phone viewer layout even on iPad; the new actual-showcase test chooses pad layout. Full adaptive ContentView/sidebar touch reachability and physical iPad/Duo acceptance remain pending.
- Parent combined candidate and independent final review, exact-head CI and draft PR publication remain outstanding. Do not merge/deploy automatically.

## Suggested owner smoke and release-note wording

Owner: in a disposable Dev channel, open two same-named files in different folders, restart and reopen each recent; move/delete/download/revoke one and verify recovery preserves the current file. Authorize a containing image folder, then test nested images, spaces, denied traversal and navigation during loading. Export both SVG and PNG through Files and Share on iPhone/iPad, cancel each, then switch documents while a sheet is pending. Confirm annotations remain absent and existing diagrams/Find/layout still work.

Proposed 1.0.2 notes: “Reopen recent Files documents with remembered permission, allow local images from a folder you choose, and save or share diagrams as PNG or SVG files.”


## Read-only combined replay and discovered regressions

Integration worktree `<isolated-wave-worktree>` was replayed from HEAD `79ae70e15dd3fe1cfe864f88772634fa7ed81bf1`, later `747a813885a04f687d87520a1b900b876b200d21` after the parent added only the two verifier scripts. Native/shared input hashes remained identical during that replay (WebBridge SHA256 `aa498ab27828197829b36c984bab032a0e6d285600dd4298e8ea35596f36ca3a`, main.js `1239e62dc575988a93ffeb1c54643cedf93904b09d98b2f2825606c48d0cc75e`). The parent’s uncommitted marketing edits were 1.0.2 in iOS and MAS, retaining placeholder 230; direct package was 0.0.232. Parent-owned documentation/test edits were present and preserved.

`npm run build`, isolated ignored XcodeGen, then five hosted tests passed on both Phone and the new iPad. Built metadata read back `com.mosaicpando.specdown.dev`, 1.0.2, 230; web bundle contained 0.0.232. Only generated ignored project/dist/test output was changed. Separate integration output:
`ios/DerivedData/wave-102-integration-native-20261102`.

- Phone log `/tmp/specdown-integration-native-phone-tests.log`, result `.../Logs/Test/Test-SpecDown Synthetic Tests-2026.11.02_15-26-54--0800.xcresult`.
- iPad log `/tmp/specdown-integration-native-ipad-tests.log`, result `.../Logs/Test/Test-SpecDown Synthetic Tests-2026.11.02_15-28-23--0800.xcresult`.
- Temporary read-only all-showcase probe and generated project are under that ignored integration output’s `showcase-probe/`; it deliberately exposed the four SVG compatibility failures. Its first project relocation attempts failed to find dist and were corrected only in generated output. Native log `/tmp/specdown-integration-native-showcase-tests.log`; exact rejected names `/tmp/specdown-showcase-validator-diagnostics.log`.

These combined results predate c9bec88/8da3270/de82714/3826a90 and are regression evidence for that snapshot, not proof of the final combined candidate. Parent should integrate the final native changes, preserve recovery additions at the shared acceptance seam, then replay the eight-test suite and exact-head CI after the recovery followup.

Parent integrated the moved-recent fix as `66463f5`. The final combined replay below supersedes the earlier pending checkpoint.

## Final combined replay

The final functional candidate was replayed at
`b181cc313834ed01ceecdfba4c3d3b1d40c70d5d`, after capacity and Windows hardening.
All eight named tests passed on both Phone and iPad with zero failures, including
all ten actual bundled SVG types. Compiled development identity, Store marketing
1.0.2, non-upload placeholder230 and110bundled web files passed strict verification.
Native/renderer source hashes and HEAD remained unchanged across replay. Final
publication is verified against that118-file manifest; subsequent changes are
external test helpers and documentation only. Direct desktop remains0.0.232.

Local evidence:
`ios/DerivedData/wave-102-final-native-b181cc313834-20261103T015806Z/`
contains summary.json, Phone.xcresult, iPad.xcresult, before/after source manifests,
compiled-app-verification.json and generated-channel-verification.json. Phone
executed8tests in17.033s andiPad8tests in15.254s. Only the two task-created
simulators were booted; cleanup shuts both down. The earlier task-created Duo
remains Shutdown. No existing device was erased/deleted and no signing or
physical/provider acceptance is claimed. Earlier624replay remains historical.
