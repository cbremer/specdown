# App icon switching

Bundled icon choices for the native SpecDown shells. Production desktop keeps Original as its bundled default; iOS channels keep their existing primary artwork.

| Date       | Document                                                        | Summary                                                                 |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2026-09-10 | [Session 01](2026-09-10-tasks-session-01-native-icon-picker.md) | Native icon selection, bundled assets, persistence, and validation      |
| 2026-09-13 | [Session 02](2026-09-13-tasks-session-02-normalize-icons.md)    | Centered artwork, cleaned alpha edges, reproducible desktop/iOS exports |


## Try it

- macOS: **Appearance → Dock Icon**. Changes the running Dock icon and restores the selection on launch. Finder and the signed application bundle retain the shipped icon.
- Windows/Linux: **Appearance → Window Icon**. Changes the running window icon; installed shortcuts retain the shipped icon.
- iPhone: **App Icon** on the welcome screen or **More → App Icon** while viewing a file.
- iPad: **Appearance → App Icon** in the sidebar (compact layouts also have the iPhone entry points).
- Desktop: choose **Original** to reset. iOS: choose the artwork named in the picker footer to reset (production Original, Dev Flat, Beta Light). iOS persists its selection through `UIApplication`; desktop stores `appIcon` in its existing state file. Existing selections are retained.

The desktop uses bundled PNGs in `desktop/icons`, already covered by electron-builder's `desktop/**/*` packaging glob. iOS offers the same eight artworks using the primary and alternate AppIcon catalogs declared in `ios/project.yml`; Xcode generates both phone and iPad alternate-icon metadata. Icons must be bundled at build time on iOS. No downloads, arbitrary file paths, or document-controlled icon changes are supported.

## Artwork

Original, Flat, Glass, Ceramic, Metallic, Layered, Minimal and Light are available
on desktop and iOS. Approved masters live in `build/app-icon-sources`.
Desktop alternatives use transparent 1024px PNGs with a centered 824px footprint.
Light receives a rounded desktop tile from the full approved opaque master;
legacy exports preserve their existing silhouettes and materials.

iOS supplies its own system mask: legacy choices fill the frame using an
aspect-preserving crop of the opaque tile; Light fills it from its entire approved
opaque master. Desktop padding is never reused for iOS. See the source folder's
README for reproduction commands, provenance and verification.

## Build

Run `npm run build`, then `npm run desktop` for the local Electron app. For iOS, run `xcodegen generate` in `ios/`, then build the SpecDown scheme in Xcode. Existing installed applications do not gain this feature until rebuilt/reinstalled or updated.
