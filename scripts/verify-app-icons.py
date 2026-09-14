#!/usr/bin/env python3
"""Validate exported artwork, not just PNG headers. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
VARIANTS = ('flat', 'glass', 'ceramic', 'metallic', 'layered', 'minimal')

for variant in VARIANTS:
    with Image.open(ROOT / f'desktop/icons/{variant}.png') as source:
        image = source.copy()
    assert image.size == (1024, 1024) and image.mode == 'RGBA', variant
    assert image.info.get('srgb') == 0, f'{variant}: desktop must declare sRGB'
    alpha = image.getchannel('A')
    bounds = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
    assert bounds is not None, f'{variant}: no visible artwork (alpha >= 128)'
    left, top, right, bottom = bounds
    assert abs((left + right) / 2 - 512) <= 1, (variant, bounds)
    assert abs((top + bottom) / 2 - 512) <= 1, (variant, bounds)
    assert abs(max(right - left, bottom - top) - 824) <= 1, (variant, bounds)
    assert min(right - left, bottom - top) >= 780, (variant, bounds)
    # Low-opacity extraction dirt must not expand the canvas footprint.
    outer = alpha.getbbox()
    assert outer is not None, f'{variant}: fully transparent export'
    assert all(abs(a - b) <= 3 for a, b in zip(outer, bounds)), (variant, outer)
    ios_path = ROOT / f'ios/SpecDown/Assets.xcassets/AppIcon-{variant}.appiconset/AppIcon-1024.png'
    preview_path = ROOT / f'ios/SpecDown/Assets.xcassets/IconPreview-{variant}.imageset/icon.png'
    with Image.open(ios_path) as source:
        ios = source.copy()
    assert ios.info.get('srgb') == 0, f'{variant}: iOS must declare sRGB'
    assert ios.mode == 'RGB' and ios.size == (1024, 1024), variant
    assert ios_path.read_bytes() == preview_path.read_bytes(), variant
    # The preview and Home Screen artwork must match the desktop geometry.
    composite = Image.new('RGB', image.size, (11, 17, 29))
    composite.paste(image, mask=alpha)
    difference = ImageChops.difference(composite, ios)
    assert max(high for low, high in difference.getextrema()) <= 3, variant
    print(f'{variant}: centered {right-left}×{bottom-top}; clean margins; iOS RGB/preview match')

print('All six alternate icons passed.')
