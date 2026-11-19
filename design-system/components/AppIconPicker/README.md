# AppIconPicker

App Icon picker: choose one of eight icon artworks. The same IDs work on iOS (Home Screen) and desktop (Dock or window icon).

**Source:** `ios/SpecDown/AppIconPicker.swift`, `AppIconCatalog.swift`, `desktop/app-icons.js`. Static rendition of the iOS sheet.

- `NavigationStack` titled "App Icon", with a Done button. One row per artwork: a 60pt preview clipped to a 13pt rounded rectangle, the title, and `checkmark.circle.fill` in `.tint` on the current icon.
- The footer explains the system confirmation and how to reset. Errors appear in red with an accessibility label.
- IDs `original … light` must stay in sync across iOS, desktop and both asset catalogs.

The preview's images load from the published artifact's asset store (`/_blob/…`), so they show only on the artifact page, not when the file is opened from the repository.
