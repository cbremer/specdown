# Session 09 — Bookmark documents from More actions

## Problem and behavior

The document toolbar gave Bookmark a prominent standalone button even though
bookmarking is a secondary document action. Remove that button and keep
**More actions → Bookmark this file** available whenever a document is open.
The app-header Bookmarks button still opens the saved collection. The existing
keyboard shortcut, command palette, and iOS action sheet remain available.

Native validation also exposed a pre-existing issue with bundled samples:
their local URLs were saved as remote bookmarks, then rejected when reading the
bookmark collection. Only HTTP(S) sources now use remote bookmarks; native
samples use the existing saved-copy behavior, including duplicate detection.

## Work

- [x] Remove the standalone document Bookmark button and its unused styling.
- [x] Call the existing bookmarking action directly from the document menu.
- [x] Keep native sample bookmarks readable by saving their contents as a copy.
- [x] Verify menu bookmarking and collection reopening in tests and previews.

## Verification

- Jest: 41 suites / 682 tests passed, including the menu-save-and-recall flow
  and regression cases for native sample URLs preserving existing bookmarks.
- Lint, typecheck, and production build passed.
- The browser preview was refreshed and verified visually: the document toolbar
  has no Bookmark button, More actions includes Bookmark this file, and choosing
  it saves the sample in the existing Bookmarks collection. After reloading,
  the app-header Bookmarks button reopens the saved document successfully.
- Electron: at 1200 × 768 and 390 × 844, the menu saves the bundled sample as a
  copy and the app-header Bookmarks button reopens it after its tab is closed.
  All ten sample diagrams render, the menu fits, and no renderer errors occur.
  The standard unpackaged Electron unsafe-eval warning remains.
- Both user previews have been refreshed with the final build. The installed
  app is unchanged; iOS and Windows/Linux native runtimes were not exercised.
