# Session 15 — Local Beta import builds

The Beta test branch starts at the rebase merge of PR #443. Its Windows save fix flushes each staged Markdown file through the writable handle. All 11 GitHub checks passed before the merge.

The direct Mac test configuration is `electron-builder.beta.js`, with the independent `com.specdown.desktop.beta` bundle ID, separate Electron data directory and disabled automatic updater. The Mac App Store Beta configuration and the shared mobile Beta scheme use `com.mosaicpando.specdown.beta`. Development and Beta builds enable DOCX, PDF and local English OCR import. The signed device product supports both iPhone and iPad. Local Beta builds use build number 253.
