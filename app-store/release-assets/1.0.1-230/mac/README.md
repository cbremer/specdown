# Mac App Store 1.0.1 (230) screenshots

These are the five owner-approved images uploaded for the Mac App Store
submission on November 2, 2026. They preserve the actual final PNGs and the five
raw app-window JPEGs used to compose them. They do not replace older artwork in
`app-store/screenshots/`.

The installed production TestFlight app was version **1.0.1 (230)**, with source
`9d27fc1a6961e29c86def43cee17c6fbb7d66db1`. The captures show only synthetic
documents from `app-store/demo/`. Caption wording comes from the owner-approved
proposal at `e8dd3cb95a41c19ad10c14e6f1efba3287866625`.

| Order | Final file                         | Content                         |
| ----- | ---------------------------------- | ------------------------------- |
| 1     | `final/01-source-preview.png`      | Source beside rendered Markdown |
| 2     | `final/02-interactive-diagram.png` | Fullscreen flowchart            |
| 3     | `final/03-release-plan.png`        | Gantt chart                     |
| 4     | `final/04-tables-code.png`         | Tables and highlighted code     |
| 5     | `final/05-dark-mode.png`           | Dark appearance                 |

All final files are **2880 × 1800 RGB PNGs**. The existing repository compositor
uniformly scales the raw window capture, adds the background, window frame and
caption, and rounds the frame corners. It does not generate or replace app UI,
stretch the window, or add capabilities. The raw JPEG bytes are unchanged.

`manifest.json` records source and caption revisions, raw/final hashes and
dimensions, synthetic document hashes, exact caption strings, recipe identity
and capture provenance. It contains no portal screenshots, account identifiers,
private contact details or credentials. The original local capture manifest and
wrapper remain preserved in release evidence; their hashes are recorded here
without their machine-specific paths.

## Verify or reproduce

Use Python with **Pillow 12.2.0** and the matching macOS `SFNS.ttf` system font.
The font is not redistributed. Run from the repository root:

```sh
python3 app-store/release-assets/1.0.1-230/mac/compose.py
```

This is read-only: it verifies all raw/final/demo hashes and dimensions, then
recomposes every image in memory and compares exact pixels and PNG bytes. It
uses the existing `app-store/compose-screenshots.py` at the recorded hash. A
different font or image encoder may produce different pixels or compressed
bytes; the retained approved PNGs remain authoritative.

To reproduce into a **new directory outside this packet**, add
`--output-dir /path/to/new-directory`. The command rejects an existing directory
and never overwrites these retained raw or final files. `--font` accepts an
alternative path to the same verified font.

The original proof was independently reviewed for dimensions, exact
recomposition, caption/source fidelity and visible content. Submission status,
owner acceptance and private portal evidence are documented separately in
[Session 69](../../../../docs/project-appstore/2026-11-02-tasks-session-69-portal-sync-handoff.md).
