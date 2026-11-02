# iPhone Duo 1.0.1 (230) screenshots

These five owner-approved images were uploaded for the iOS resubmission on
November 2, 2026. They show the real inner-display interface of the
retained production-identity **1.0.1 (230)** simulator app, from frozen source
`9d27fc1a6961e29c86def43cee17c6fbb7d66db1`. They preserve the exact approved PNGs,
five selected raw PNGs and the compact contact sheet used for owner review.
No app rebuild was performed for this capture, and these are **simulator
screenshots, not physical iPhone Duo captures**.

The normal native Files picker opened synthetic documents from `app-store/demo/`.
Captions come from the approved proposal at
`e8dd3cb95a41c19ad10c14e6f1efba3287866625`, retained in the submission copy packet.

| Order | Final file           | Content                                      |
| ----- | -------------------- | -------------------------------------------- |
| 1     | `final/inner-01.png` | Architecture document and diagram in Preview |
| 2     | `final/inner-02.png` | Centered fullscreen sign-in sequence         |
| 3     | `final/inner-03.png` | API reference in Raw view                    |
| 4     | `final/inner-04.png` | Find results with visible controls           |
| 5     | `final/inner-05.png` | Order lifecycle in native and web Dark Mode  |

All final files are **2007 × 2853 RGB PNGs**, without alpha or metadata. The
existing repository compositor uniformly scales the complete captured viewport
and adds the caption, background and rounded frame. It does not stretch or crop
the viewport, generate UI, or add capabilities. The five raw capture files are
unchanged. The last image uses the additive system-dark capture; the earlier
mixed-appearance capture remains in private local evidence and is not selected.

`contact-sheet.jpg` is a review aid, not an App Store upload. This packet contains
no outer-display marketing image. The initial landing and inactive-display
captures were excluded. Existing iPhone, iPad and Mac artwork is preserved.

`manifest.json` binds raw/final files, captions, demo documents, provenance and
composition parameters. `provenance.json` records the simulator artifact checks:
117 app files matched the retained simulator report, and 110 shared web files
matched the simulator, submitted archive and exported IPA. The simulator binary
is distinct from the signed device binary. Private machine paths, simulator IDs,
portal screenshots, contact details and credentials are not included.

## Verify or reproduce

Use Python with **Pillow 12.2.0** and the matching macOS `SFNS.ttf` system font.
The font is not redistributed. From the repository root:

```sh
python3 app-store/release-assets/1.0.1-230/iphone-duo/compose.py
```

The default command is read-only. It checks retained image, caption, demo,
provenance, contact-sheet, font and compositor hashes, then recomposes all five
images in memory and compares exact pixels and PNG bytes. The recorded Duo
profile is applied only to the imported compositor in memory. The existing
repository compositor and older screenshot sets are unchanged.

Use `--output-dir /path/to/new-directory` to reproduce the final PNGs in a new
directory outside this packet. Existing directories, output symbolic links and
paths within the packet are rejected. `--font` can specify another path to the
same verified font. The retained approved PNGs remain authoritative if a different font or encoder
cannot reproduce their exact bytes.

Run the verifier's focused failure checks with the same Python environment:

```sh
python3 -B app-store/release-assets/1.0.1-230/iphone-duo/test_compose.py
```

These checks reject missing or extra captions, unavailable compositor loaders,
and unsafe output paths without writing any retained image.

Apple shows the same iOS build 230 Waiting for Review, with manual release
selected. Owner approval and the exact resubmission checkpoint are recorded in [Session 70](../../../../docs/project-appstore/2026-11-02-tasks-session-70-duo-release-artwork.md).
