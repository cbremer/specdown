# Session 37: Consistent Mac Store version and local testing

Date: November 1, 2026. Source base: `729258b3ef31d9a4167e8e93fdd3f095d92a08d2`. Branch: `codex/mac-store-1-0-1-local`.

Chris requested consistent App Store versions and a local Mac Store build/test without touching the existing direct desktop app. The selected preparation version is **1.0.1 (228)**, matching the iOS security update. Store release numbers can stay aligned while each platform retains its own acceptance and release gate. The direct channel remains independently versioned at source `0.0.228`; its installed `0.0.193` app is preserved.

## Implementation

Only the MAS configuration overrides packaged marketing/build metadata. `package.json`, lockfile, direct build configuration and iOS project remain unchanged. A small MAS-only main/preload bridge supplies the existing native About-version hook to the trusted bundled viewer. Strict version validation rejects duplicate, malformed or coerced values. About displays `Version 1.0.1 (0.0.228)`, using the existing iOS convention for the internal shared-viewer revision. Direct behavior is unchanged.

Independent source review passed. Full **1,157 tests / 68 suites**, lint and type checking passed; 63 focused tests / 5 suites also passed. Fresh Vite output was built in the separate in-repository worktree.

## Actual local artifact

Evidence: `ios/DerivedData/mas-local-1.0.1-228-20261101/` in the canonical checkout. The development-signed arm64 app is `build/mas-dev-arm64/SpecDown.app` within that directory. It uses the existing Apple Development certificate and verified current-Mac profile; no new keys or profiles were created. Deep/strict host signature verification passed. The restricted execution sandbox could not validate code-signing data; host execution verified the same unchanged bytes.

Verified bundle ID `com.mosaicpando.specdown`, version `1.0.1`, build `228`, macOS 13 minimum, sandbox and inherited helper entitlements, exact development profile, 126 application/web files and 8,555 production dependency files. No updater or update feed is packaged. Dependencies were a verified physical copy, not a top-level symlink. The unchanged universal bookmark addon was reused with verified provenance.

No installation into Applications, Store signing, installer package, upload, App Review, public release or main merge occurred. Root source remains the owner's phone candidate. Existing direct app bytes and prior MAS profile metadata are checked separately.

## Synthetic runtime testing and discovered follow-up

An older MAS profile existed from October 13. Every test launch therefore passes an absolute `--user-data-dir` pointing to a new `SpecDown-QA-20261101-1.0.1-228` directory inside the MAS container. Electron 44.10.1 applies this switch before application initialization and session storage uses the same path. Initial UI was empty; fresh QA files were created and original profile metadata remained unchanged. This does not isolate the production MAS app-group or OS Recent Documents identity.

Observed passes: native About version; real Markdown/Mermaid rendering; visually centered fullscreen zoom/reset; Find marker and dismissal; native open-panel grant; oversized-file rejection preserving the accepted document; atomic file-replacement live reload; bookmark persistence and opening after full quit/relaunch; exported PDF containing text and diagram; native Print sheet opens and cancels without printing. All documents were synthetic.

**Follow-up required:** automatic session restore did not deliver the saved tab after relaunch. The generated console says `File open was not delivered; recents remain unchanged.` Manual bookmark reopen succeeds. This is a startup-delivery failure, not proof of lost state or lost sandbox grants. A separate scoped correction must retain receipt/frame/lifecycle security and be tested in the real signed app before claiming startup restore passes.

Oversized native opens currently log rejection without a visible explanation. Record this usability gap; do not claim a visible error was displayed. Full Intel/runtime, minimum-macOS, Store-distribution/TestFlight and owner acceptance remain separate gates.

## References

- [Electron local MAS testing](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide/).
- [Builder version metadata](https://www.electron.build/v26/docs/configuration/).
- [Electron 44.10.1 user-data-dir startup](https://github.com/electron/electron/blob/v44.10.1/shell/app/electron_main_delegate.cc#L250-L259).
