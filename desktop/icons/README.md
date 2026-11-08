# Runtime icon choices

Original is copied from `build/icon.png`. Six legacy variants are transparent 1024px exports prepared from the six-concept presentation. These files are shipped by the existing `desktop/**/*` packaging rule and selected only by the allowlist in `desktop/app-icons.js`.

They are raster concept artwork. The installed app bundle icon remains defined in package.json; runtime switching changes the macOS Dock or Windows/Linux window icon. Keep the IDs in sync with AppIconChoice and the alternate catalogs under ios/SpecDown/Assets.xcassets.


Light reuses the approved opaque `build/app-icon-sources/light.png` master,
resampled within a centered 824px rounded tile on a transparent 1024px canvas.
Use `swift scripts/export-app-icons.swift --desktop-light-only` to reproduce it.
This is separate from iOS's full-bleed geometry; no existing export is rewritten.
All eight artwork IDs match the iOS catalog. Existing persisted IDs remain valid.
