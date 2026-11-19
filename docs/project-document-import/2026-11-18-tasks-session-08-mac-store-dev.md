# Session 08 — Mac App Store Dev imports

The Mac App Store Dev configuration enables the shared DOCX and PDF converters and the bundled English OCR engine. The local Apple Silicon package is signed for the sandboxed `com.mosaicpando.specdown.dev` identity. The installed location is `~/Applications/SpecDown Store Dev.app`.

Build 251 opened a Word fixture in the native Open File panel and recognized “Project Atlas 425” on the scanned page of a mixed PDF. The native Save panel returned a selected Markdown destination, but the app reported a save failure and the destination was empty. The shared writer stages a temporary file beside the destination, while the Store sandbox grants only the selected file. Build 252 asks Foundation for an item replacement directory on the destination volume. The writer stages there, preserves its conflict check for overwrites and uses an exclusive rename for new files.

The root README records the four-platform Dev/Beta/Prod matrix, current build and install locations and the proposed worktree-independent retention layout. Archive migration and release delivery are separate from this local installation.

Installed and launched Mac App Store Dev 1.0.4 (252) in the existing user Applications location. Its strict signature, sandbox and selected-file read/write entitlements passed verification. In that installed app, a mixed PDF rendered its selectable first and last paragraphs around the scanned middle page. After editing the result and using the native Save panel, the destination on disk contained “Project Atlas 425” in order and the additional edit. The synthetic source PDF matched its committed bytes. The real native helper also passed create, replace and no-clobber checks.
