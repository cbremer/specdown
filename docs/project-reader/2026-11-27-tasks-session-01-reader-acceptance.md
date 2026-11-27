# Read Aloud and Explain · Dev build and acceptance

## Build on your Mac

Use Node 22.22 or later. Use Xcode 26 or later to compile the Foundation Models integration. Model availability also depends on the runtime OS, Apple Intelligence eligibility, settings, downloaded model and supported language. Older supported systems can use speech and the source walkthrough.

From a checkout of the feature branch, run the commands below for **direct Mac Dev on Apple silicon**. The desktop packaging hook builds the matching native helper with Xcode.

```sh
npm ci
npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx --no-install electron-builder --config electron-builder.dev.js --mac dir --arm64 --publish never
open -n 'dist/development-edit-save/mac-arm64/SpecDown Dev.app'
```

For **iPhone or iPad**, generate the project with XcodeGen in a fresh checkout after building the viewer. The generated project includes the shared Apple reader source. If your usual checkout contains local signing settings, use a separate checkout for generation. Build the Dev simulator to check compilation, or open the generated project, select **SpecDown Dev**, and run it on each paired device to try audio and local inference.

```sh
(cd ios && xcodegen generate)
scripts/build-mobile.sh dev simulator
open ios/SpecDown.xcodeproj
```

For the **Mac App Store Dev** edition, use the signed, sandboxed Dev channel command in the [build matrix](../../README.md#app-names-build-channels-and-versions). The Mac packaging hook embeds the same native helper in this edition. Validate it in the signed app.

## Test the reader

Open [reader-retry-policy.md](../../tests/fixtures/reader-retry-policy.md) as a file. Start from **More actions (⋯)** in the header or the iPhone action bar.

| Check | Expected result |
| --- | --- |
| Select “retries twice” across formatting and choose Read selection | Only the selection is spoken. Pause, resume, rate and stop affect that reading session. |
| Choose Read from here at the Retry policy heading | Sentences highlight in order. Code and diagrams receive short announcements. |
| Select the retry sentence and choose Explain… | The right rail opens with Selection as the source. An available model explains the two retries with a link to that occurrence. |
| Ask whether permission errors are retried | The selection alone does not establish the permission-error policy. Switch to Whole document and ask again. The supported answer cites the permission-errors section. |
| Select the code block as the source | Inspect why the function stops after two attempts and follow the citation to its source. |
| Pick the Worker lifecycle diagram | The timeout branch shows the API canceling the job and returning the timeout. The two “Record outcome” occurrences lead to different steps. |
| Listen to an answer while reading the document | Only one stream plays. Resume document returns to the saved sentence. |
| Narrow the window, open a citation, and return | The rail fills the compact window. Back to explanation restores the thread. Closing the rail restores the reading position. |
| Switch files while speech or an answer is pending | Audio stops. A late answer cannot appear in the new file. |
| Try without an available model or local voice | The rail describes model availability. Source navigation and the deterministic sequence walkthrough remain available. Speech reports an unavailable local voice when playback cannot start. |

## Other platforms

Build the web viewer with `npm run build` and serve it with `npm run preview -- --host 127.0.0.1`. Test a browser tab and the installed PWA independently. Browser narration requires a usable local voice.

On Windows use `npm run desktop:build -- --win nsis --publish never`. On Linux use `npm run desktop:build -- --linux AppImage --publish never`. Test actual audio in each package. The Linux fallback uses the distribution’s installed eSpeak NG or eSpeak executable. The Windows fallback uses Windows PowerShell and System.Speech.

Record the runtime, build, scope, model availability, audible output and citation outcome separately for each device. A simulated model or voice checks the UI interactions. Real answers and audible output require an available model and audio device.

## Cloud checks

Chromium 156 on Linux exercised the production viewer, an installed PWA and the compact layout. The PWA reopened the fixture offline after its diagram assets had been loaded online. A packaged Linux AppImage also opened the fixture and showed the local-model availability state. The two repeated diagram links resolved to distinct SVG labels in the running viewer. A test voice and model exercised the follow-up, playback and cancellation UI. Physical Apple devices, signed Store builds and Windows audio require separate runtime checks.

To repeat the browser checks, build the viewer and run `python scripts/test-reader-browser.py` with Python Playwright and Chromium installed. Pass `--installed` on a graphical host to exercise the offline PWA. Set `SPECDOWN_CHROMIUM` to select a system Chromium executable.
