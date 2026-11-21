# Direct desktop v0.0.235

The approved C+ design became the default in PR #466. The direct desktop production package still restricted Open File to Markdown. This change exposes the existing Word and PDF converters on macOS, Windows and Linux. Scanned pages use bundled English OCR. Imported documents save to a separate Markdown file.

Run `npm run build` and `node_modules/.bin/electron scripts/test-source-editing-desktop.js` on a graphical Mac. The probe exercises the packaged channel with an isolated profile, synthetic documents and deterministic file chooser responses. It checks the brand bar, edits, recovery, imported content, and saved bytes.

The version workflow creates the release tag after the version-only PR merges. The protected desktop workflow builds and publishes the installers. Check the public release assets and updater metadata, then check for an available update from the previous public Mac version.

On November 21 the Mac Electron probe passed for DOCX, text/mixed/scanned PDFs, editing, recovery and Markdown copy saves. The web build, lint, typecheck and all 1,621 Jest tests passed on the release source branch.
