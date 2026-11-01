# Alternate icon masters

These 1254×1254 PNGs are the source of truth for the six legacy alternate icons
and the separate iOS Light choice.
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
It removes a one-source-pixel extraction fringe, antialiases the silhouette,
and scales directly from the master to a centered 824-pixel maximum visible
dimension on a 1024-pixel canvas. Aspect ratio and internal detail are preserved.
Desktop exports use transparent sRGB; iOS exports and picker previews use the
same geometry composited on RGB (11, 17, 29), with no alpha channel.
Original and the signed app's primary bundle icon are unchanged.

## Separate iOS Light choice

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
824-pixel desktop normalization, extract edges, add an inset or create a desktop
Light icon. The default export/verify commands include both legacy icons and
Light; use `--ios-light-only` to keep this work separate from the pending
existing-alternate border task (WK-27).
