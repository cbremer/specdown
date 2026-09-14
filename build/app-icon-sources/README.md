# Alternate icon masters

These 1254×1254 PNGs are the source of truth for the six alternate icons.
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
