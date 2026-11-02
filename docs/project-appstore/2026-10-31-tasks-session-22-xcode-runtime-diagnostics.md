# Session 22 — Xcode runtime warnings and fullscreen focus

Date: 2026-10-31 (America/Los_Angeles). Read-only application investigation; no application source changes, builds, signing, installation, uploads or account operations.

## Observed state

Canonical checkout remains `codex/local-ios-1-0-1` at mobile candidate `e7b842b`. Xcode shows one project issue: Update to recommended settings. Its visible console does not show a compiler error, crash backtrace, `[WebView] Navigation failed`, renderer-ready timeout or a WebContent-termination callback.

Chris configured his development signing in Xcode. Device Hub's Apps inspector now independently lists **SpecDown 1.0.1 (228)**, `com.mosaicpando.specdown`, on the available physical device named iPhone Z (iPhone 17 Pro Max / iOS 27.2). Xcode reports Running on that destination. This establishes listed installation and debugger status, not passing physical functional acceptance. Chris initially believed it had not installed; the agent corrected its earlier unsupported implication and then verified the installed-app entry. No agent-initiated signing/install/Run occurred.

## Console diagnostics

Startup logs include bundle sandbox-extension failure, private-path missing/denied messages, PointerUI/handler diagnostics and WebKit URL-parameter handling diagnostics. File-access attempts did fail, but the logs do not identify a failed SpecDown asset or user operation. The viewer uses a bounded custom `specdown://app` URL scheme, not loadFileURL. Do not relax ATS, file grants, sandboxing or other protections to silence these messages.

Repeated keyboard-will-change/hide warnings were followed by `Conversion error` messages. A zero-height rectangle at y956 with width440 became width22000 at x-10780, exactly a centered50x coordinate conversion. It is hidden-keyboard geometry; this is not evidence of a visibly22000-pixel keyboard. No source explicitly sets a native view transform, pageZoom or scrollView.zoomScale. Diagram Panzoom affects the cloned SVG only and permits0.05–20 scale. The current console does not establish whether this is framework diagnostics or a visible app defect.

## Confirmed source/DOM focus gap

Independent bounded synthetic-DOM probes of the actual handlers found:

- `diagrams.js` calls `fsOverlay.focus()`, but `index.html`'s fullscreen overlay is a div without tabindex. It does not take focus away from Find.
- The keyboard handler permits Cmd+F while a fullscreen diagram is visible, focusing the obscured Find input behind it.

This is a reproducible focus gap at the DOM level, not a proven explanation for the physical-device conversion warnings. Prepare any fix on a separate branch/worktree inside this repository; preserve the canonical owner phone checkout until review. Cover focus transfer and preventing obscured Find focus with regression tests and real-browser validation. Do not silently add an unreviewed fix to source e7 or relabel existing native artifacts.

## Remaining diagnostic check

Correlate the console with (1) plain-text Find then Done/Close, (2) Find to fullscreen with keyboard active and (3) diagram-only pinch/control zoom/reset then close. Verify visible header position, document scrolling and focus. If needed, capture activeElement, actual visualViewport geometry/scale, actual Panzoom scale and native WebView zoom/offset values. The displayed diagram percentage is clamped and does not prove the actual scale. The global native keyboardDidHide observer can animate offset back tozero; inspect its interaction with transitions if a reproduction implicates it, rather than removing it speculatively.

Physical functional acceptance and TestFlight remain pending. These findings supersede any blanket claim that every console message is harmless; no root cause for the conversion diagnostics has been established.
