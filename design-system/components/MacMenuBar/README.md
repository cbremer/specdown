# MacMenuBar

Mac menu bar: the Electron application menu (also the in-window menu on Windows/Linux).

**Source:** `desktop/main.js`, application menu template. Static rendition with macOS system colours. It's native UI, not tokens.

- Menus: SpecDown · File · Edit · View · Appearance · Window · Help. The Appearance menu holds Theme ▸ (from `visualThemeCatalog`), Custom CSS and App Icon ▸.
- Labels are Title Case, with an ellipsis for anything that opens a dialog. Standard items use Electron `role`s so they localise and get system shortcuts.
- Help ▸ Check for Updates… isn't present in Mac App Store builds. DevTools appears only in unpackaged builds.
