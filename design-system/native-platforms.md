# Native platforms

The shared viewer renders inside every shell. Native code owns only what the operating system should own. Keep new native UI to that list, and route everything else through the `window.specdown` bridge.

| Surface         | Shell               | Native UI it owns                                                                                | Shared-viewer layout                                         |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Web / PWA       | browser             | none                                                                                             | full toolbar                                                 |
| Mac (direct)    | Electron            | menu bar, open/save dialogs, message boxes, Dock icon switching, updater                         | full toolbar                                                 |
| Mac App Store   | Electron, sandboxed | same as Mac direct, minus the updater; file access by security-scoped bookmark                   | full toolbar                                                 |
| Windows / Linux | Electron            | menu bar in the window, dialogs, window icon switching                                           | full toolbar                                                 |
| iPadOS          | SwiftUI + WKWebView | `NavigationSplitView` sidebar, URL form popover, App Icon sheet, document pickers, alerts, print | `ios-pad`: toolbar kept, bottom bar hidden                   |
| iOS (iPhone)    | SwiftUI + WKWebView | same as iPadOS; the sidebar collapses to a pushed column                                         | `ios-phone`: toolbar hidden, `ios-action-bar` + action sheet |

## Rules

- **Native components look native.** Don't restyle UIKit, SwiftUI or macOS menus with SpecDown colours. They take the system tint, the system font (Dynamic Type on iOS) and system materials. SpecDown's identity comes through the web surface, the logo and the app icon.
- **iOS tint:** the selected App Icon checkmark uses `.tint`. The asset catalog defines no AccentColor, so the tint is system blue. If the tint ever gets set, use `accent-color` light/dark so native and web agree.
- **Errors in SwiftUI** use `.foregroundStyle(.red)` below the field, plus a VoiceOver announcement.
- **Breakpoint:** iPad switches between `pad` and `phone` layouts at 768px of detail-column width, the same breakpoint as the shared viewer. A narrow split-view column gets the phone controls.
- **Every toolbar control must also exist on iPhone.** The phone layout hides `.content-header-actions`, so wire each new toolbar action into the iOS action bar or action sheet too.
- **Safe areas:** the web view paints under the home indicator. Bottom controls pad with `env(safe-area-inset-*)`.
- **Menu labels (Electron):** Title Case with an ellipsis for anything that opens a dialog ("Open File…", "Print...", "Export as PDF..."). The source mixes `…` and `...`; use `…`.
- **Dialogs:** use `dialog.showMessageBox` / `showErrorBox` for errors that block a native action. Everything else is an in-app toast.
- **App icons:** the eight artwork IDs (`original`, `flat`, `glass`, `ceramic`, `metallic`, `layered`, `minimal`, `light`) must match across `AppIconChoice` (iOS), `desktop/app-icons.js` and both asset catalogs.

## Mac menu bar (Electron)

`SpecDown` (About, Services, Hide, Quit) · `File` (Open File…, Open Folder…, Close Folder, Open Recent ▸, Close Tab, Print…, Export as PDF…) · `Edit` (Undo … Select All, Find…) · `View` (Read Selection or Read from Here, Explain…, Reload, Zoom, Full Screen; DevTools in dev builds only) · `Appearance` (Load Custom CSS Theme…, Clear Custom Theme, Theme ▸ Basic / Starfield / Aurora / Blueprint, App Icon ▸) · `Window` · `Help` (Check for Updates… outside the Mac App Store, Open Log File).

The native reading commands use ⌥⌘R and ⌥⌘E on Mac and Apple hardware keyboards. Windows and Linux use Ctrl+Alt+R and Ctrl+Alt+E. Both commands target the active viewer. Selecting document text changes the read command to **Read Selection**. iPadOS also exposes these commands in its system menu where supported.

## iOS sidebar (SwiftUI, `.listStyle(.sidebar)`)

Open (Open from URL…, Open File) · Appearance (App Icon) · Samples (Open Sample, Open Diagram Showcase) · Recent Files (name + location caption in `.secondary`; empty state "Open a file to remember it here.").
