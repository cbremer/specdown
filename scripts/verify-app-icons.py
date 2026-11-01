#!/usr/bin/env python3
"""Validate exported artwork, not just PNG headers. Requires Pillow."""
from pathlib import Path
import argparse
import json
import re
from PIL import Image, ImageChops, ImageStat

parser = argparse.ArgumentParser(description=__doc__)
scope = parser.add_mutually_exclusive_group()
scope.add_argument('--ios-light-only', action='store_true', help='Check only the separate full-bleed iOS Light choice')
scope.add_argument('--ios-legacy-only', action='store_true', help='Check the six legacy iOS choices and unchanged desktop geometry')
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
args = parser.parse_args()
ROOT = args.root.resolve()
VARIANTS = ('flat', 'glass', 'ceramic', 'metallic', 'layered', 'minimal')

for variant in (() if args.ios_light_only else VARIANTS):
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
    print(f'{variant}: desktop centered {right-left}×{bottom-top}; clean 824px geometry', flush=True)
    ios_path = ROOT / f'ios/SpecDown/Assets.xcassets/AppIcon-{variant}.appiconset/AppIcon-1024.png'
    preview_path = ROOT / f'ios/SpecDown/Assets.xcassets/IconPreview-{variant}.imageset/icon.png'
    with Image.open(ios_path) as source:
        ios = source.copy()
    assert ios.info.get('srgb') == 0, f'{variant}: iOS must declare sRGB'
    assert ios.mode == 'RGB' and ios.size == (1024, 1024), variant
    assert ios_path.read_bytes() == preview_path.read_bytes(), variant
    # Independent top-down reference: the iOS geometry comes from the original
    # master, not the desktop export. Fit the shorter opaque tile dimension to
    # the frame, with a two-source-pixel inward edge guard and no stretching.
    with Image.open(ROOT / f'build/app-icon-sources/{variant}.png') as source:
        master = source.convert('RGBA')
    tile = master.getchannel('A').point(lambda value: 255 if value >= 250 else 0).getbbox()
    assert tile is not None, f'{variant}: no opaque master tile'
    left, top, right, bottom = tile
    side = min(right - left, bottom - top) - 4
    assert side > 0, f'{variant}: master tile too small'
    center_x, center_y = (left + right) / 2, (top + bottom) / 2
    crop = (center_x - side / 2, center_y - side / 2, center_x + side / 2, center_y + side / 2)
    resized = master.transform((1024, 1024), Image.Transform.EXTENT, crop, Image.Resampling.BICUBIC)
    reference = Image.new('RGB', (1024, 1024), (11, 17, 29))
    reference.paste(resized, mask=resized.getchannel('A'))
    difference = ImageChops.difference(reference, ios)
    assert max(ImageStat.Stat(difference).mean) <= 2, f'{variant}: iOS must aspect-fill from the master, without desktop inset or stretching'
    for point in ((0, 512), (1023, 512), (512, 0), (512, 1023)):
        assert resized.getpixel(point)[3] >= 240, f'{variant}: opaque tile must reach all four mid-edges'
        assert max(abs(a - b) for a, b in zip(ios.getpixel(point), reference.getpixel(point))) <= 8, f'{variant}: iOS mid-edge differs from full-frame reference'
    print(f'{variant}: iOS full-edge crop {crop}; RGB/preview match')

if not args.ios_legacy_only:
    with Image.open(ROOT / 'build/app-icon-sources/light.png') as source:
        master = source.copy()
    assert master.mode == 'RGB' and master.size == (1254, 1254), 'light: expected approved opaque 1254px master'
    light_path = ROOT / 'ios/SpecDown/Assets.xcassets/AppIcon-light.appiconset/AppIcon-1024.png'
    preview_path = ROOT / 'ios/SpecDown/Assets.xcassets/IconPreview-light.imageset/icon.png'
    with Image.open(light_path) as source:
        light = source.copy()
    assert light.mode == 'RGB' and light.size == (1024, 1024), 'light: expected opaque 1024px RGB'
    assert light.info.get('srgb') == 0, 'light: iOS must declare sRGB'
    assert light_path.read_bytes() == preview_path.read_bytes(), 'light: preview must match app icon'
    # Compare the complete frame against an independent resize, allowing the small
    # difference between Core Graphics and Pillow reconstruction filters. This
    # rejects the legacy 824px inset/crop/composite path without dictating its pixels.
    reference = master.resize((1024, 1024), Image.Resampling.LANCZOS)
    difference = ImageChops.difference(reference, light)
    assert max(ImageStat.Stat(difference).mean) <= 2, 'light: export must resample the full master without an inset'
    for point in ((0, 0), (1023, 0), (0, 1023), (1023, 1023)):
        assert max(abs(a - b) for a, b in zip(light.getpixel(point), reference.getpixel(point))) <= 3, 'light: edge background changed'

    icon_catalog = json.loads((light_path.parent / 'Contents.json').read_text())
    assert icon_catalog['images'] == [{'filename': 'AppIcon-1024.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}], 'light: invalid app icon catalog'
    preview_catalog = json.loads((preview_path.parent / 'Contents.json').read_text())
    assert preview_catalog['images'] == [{'filename': 'icon.png', 'idiom': 'universal'}], 'light: invalid preview catalog'
    project = (ROOT / 'ios/project.yml').read_text()
    registration = re.search(r'ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES:\s*"([^"]+)"', project)
    assert registration and 'AppIcon-light' in registration.group(1).split(), 'light: alternate icon is not registered'
    choices = (ROOT / 'ios/SpecDown/AppIconPicker.swift').read_text()
    case_line = re.search(r'^\s*case\s+(.+)$', choices, re.MULTILINE)
    assert case_line and 'light' in [item.strip() for item in case_line.group(1).split(',')], 'light: manual picker choice missing'
    assert not (ROOT / 'desktop/icons/light.png').exists(), 'light: this choice is iOS only'
    print('light: full-bleed master resize; iOS RGB/preview match; catalog and manual choice registered')
    print('Light passed.' if args.ios_light_only else 'All six legacy alternates and iOS Light passed.')
