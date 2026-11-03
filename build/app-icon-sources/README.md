# Alternate icon masters

These 1254×1254 PNGs are the source of truth for the six legacy alternate icons
and Light on desktop and iOS.
They are build inputs, excluded from the desktop app's packaged file glob.
Do not regenerate from the 1024-pixel exports or the original presentation sheet.

Flat, Glass, Ceramic, Metallic, and Minimal retain the standalone generated
masters from September 10. Layered received a targeted transparent-edge cleanup
with the built-in imagegen tool on September 13. These are raster masters;
a larger canvas does not imply vector-level detail.

Layered cleanup prompt:

> Use case: background-extraction. Production cleanup of this exact existing SpecDown Layered app icon. Preserve the exact dark navy rounded square, cyan-to-coral circular ring, curved cyan eyes, gold diamond, proportions and layered material. Clean ONLY the rough speckled light fringe on the outer silhouette and provide crisp smooth antialiased edges on a genuine transparent alpha background. No white matte, no checkerboard pixels, no cast shadow beyond silhouette. Do not redesign or reinterpret the face, ring, diamond or lighting. Center it on a square canvas with equal margins, visible icon occupying approximately 80.5% of canvas width and height. Output high resolution square PNG with real transparency.

Rebuild on macOS from the repository root:

```sh
swift scripts/export-app-icons.swift
python3 scripts/verify-app-icons.py
```

The verifier requires Pillow. The exporter uses AppKit/Core Graphics only.
For desktop, it removes a one-source-pixel extraction fringe, antialiases the
silhouette, and scales directly from the master to a centered 824-pixel maximum
visible dimension on a 1024-pixel canvas. Desktop exports use transparent sRGB.
The separate iOS path below fills the asset frame from the master, preserving
aspect ratio and internal artwork without reusing the padded desktop export.
Original and the signed app's primary bundle icon are unchanged.

## Full-edge iOS geometry for the six existing alternates

Reproduce only Flat, Glass, Ceramic, Metallic, Layered and Minimal on iOS:

```sh
swift scripts/export-app-icons.swift --ios-legacy-only
python3 scripts/verify-app-icons.py --ios-legacy-only
python3 scripts/test-app-icons.py
```

The iOS crop is a square centered on the original master's opaque tile bounds
(alpha at least 250), with side length equal to the shorter bound dimension
minus four source pixels. The two-pixel inward guard removes the outer antialias
edge. This uniform aspect-fill reaches all four asset mid-edges without
stretching or adding the desktop inset. The full square is resampled directly
to 1024×1024; RGB (11, 17, 29) fills only remaining transparent corner pixels
under the system mask. Existing material, bevel, ring and face artwork is kept.
The result is opaque sRGB and the picker preview is a byte-identical copy.

The default export command produces desktop and iOS outputs through their
separate paths. `--ios-legacy-only` does not write any desktop or Light asset.
The verifier still checks desktop's 824px geometry, then compares iOS to an
independent full-frame crop from the master and checks all four mid-edges.
Original, Light, the masters and desktop exports are not changed by this fix.

## Approved Light choice

The owner requested a manually selectable **Light** option and approved the
generated preview ("Looks ok"). `light.png` is the exact approved opaque RGB
1254×1254 master from the built-in `image_gen` tool, using the Original AppIcon
as its reference. Approval applies to this additional choice; Original and all
six existing alternate masters and exports remain unchanged.

Approved source:
`/Users/chrisbremer/.codex/generated_images/01a190ef-3d3b-7990-a26f-1e5764cfbaaf/exec-fb389325-cc4c-4d71-bdb1-33a3fdfa81bd.png`.
SHA256: `61d214a1870bc8f11f737c79d7fb092a81c028655600e85f38d7603273b66e76`.
The exact prompt and reference are retained in
[`light-generation-prompt.txt`](light-generation-prompt.txt). The referenced
Original AppIcon has SHA256
`a9e237d4fdaf622b578659cff0c238f07c08e3f0e3d3aee529f8c9f77acbbc33`.

Generation brief retained with the approved master:

> Preserve the centered teal-to-copper ring, two closed-eye cyan marks, and
> orange diamond/central circle. Use a near-white full-edge opaque background,
> a very light cool-gray inner field, and slightly deeper teal eyes. No outer
> rounded tile, frame, shadow or text; iOS supplies the mask.

Reproduce or validate only Light, without rewriting existing icons:

```sh
swift scripts/export-app-icons.swift --ios-light-only
python3 scripts/verify-app-icons.py --ios-light-only
python3 scripts/test-app-icons.py
```

Use a Python interpreter with Pillow installed. The exporter performs a single
full-canvas resample to 1024×1024, tags sRGB, writes an opaque iOS AppIcon, and
copies those exact bytes into its picker preview. It does not apply the legacy
824-pixel desktop normalization, extract edges, add an inset or change the desktop
Light icon. The default export/verify commands include both legacy icons and
Light; use `--ios-light-only` to reproduce Light independently from the six
existing alternate icons.


## Desktop Light geometry

Light is available alongside the same seven existing desktop choices. Rebuild only
its desktop asset with `swift scripts/export-app-icons.swift --desktop-light-only`
and verify with `python3 scripts/verify-app-icons.py --desktop-light-only`.
The default export command now includes it too.

The approved opaque master is resampled as a whole into a centered 824×824 tile
on a transparent 1024×1024 sRGB canvas. A 184px corner radius supplies the desktop
mask; iOS still receives the unchanged full-bleed opaque artwork and its system
mask. No face, ring, color, internal layout or source artwork is redesigned.
The independent verifier checks the footprint, margins, rounded corners, all four
mid-edges, and opaque artwork against a full-master resample. Mutation tests reject
iOS geometry, square corners and recolored artwork. Existing six desktop exports,
all iOS assets, and primary bundle artwork are preserved byte-for-byte.
