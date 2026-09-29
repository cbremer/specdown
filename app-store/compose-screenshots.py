#!/usr/bin/env python3
"""Compose App Store screenshot sets from raw app captures.

Reads raw captures (real running-app UI, see asset-index.json for provenance),
adds a short headline above each, and writes exact-size RGB PNGs (no alpha)
to app-store/screenshots/<platform>/en-US/. Validates dimensions and mode.

usage: python3 app-store/compose-screenshots.py <raw-capture-dir>
"""
import hashlib
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT = '/System/Library/Fonts/SFNS.ttf'

PLATFORMS = {
    # slot: App Store Connect display type; size: required pixel dimensions
    'iphone': {'slot': 'iPhone 6.9"', 'size': (1320, 2868), 'head': 560, 'title': 104, 'sub': 58, 'radius': 64},
    'ipad': {'slot': 'iPad 13"', 'size': (2064, 2752), 'head': 440, 'title': 110, 'sub': 60, 'radius': 40},
    'mac': {'slot': 'Mac 16:10', 'size': (2880, 1800), 'head': 330, 'title': 104, 'sub': 56, 'radius': 28},
}

SCENES = {
    'iphone': [
        ('iphone-light-system-architecture', 'Mermaid diagrams, rendered live', 'Flowcharts straight from your Markdown'),
        ('iphone-light-sign-in-flow', 'Sequence diagrams on the go', 'Tap any diagram to zoom and pan'),
        ('iphone-light-api-reference', 'Tables and highlighted code', 'Clean typography for technical docs'),
        ('iphone-light-order-lifecycle', 'State diagrams and more', 'Flowchart, sequence, state, Gantt'),
        ('iphone-dark-system-architecture', 'Beautiful in Dark Mode', 'Follows your system appearance'),
    ],
    'ipad': [
        ('ipad-light-system-architecture', 'Mermaid diagrams, rendered live', 'Flowcharts straight from your Markdown'),
        ('ipad-light-release-plan', 'Gantt charts in your notes', 'Plan the work right beside the docs'),
        ('ipad-light-api-reference', 'Tables and highlighted code', 'Clean typography for technical docs'),
        ('ipad-light-sign-in-flow', 'Sequence diagrams, crystal clear', 'Tap any diagram to zoom and pan'),
        ('ipad-dark-order-lifecycle', 'Beautiful in Dark Mode', 'Follows your system appearance'),
    ],
    'mac': [
        ('mac-light-split-system-architecture', 'Source and preview, side by side', 'Split view for your Markdown files'),
        ('mac-light-system-architecture', 'Mermaid diagrams, rendered live', 'Flowcharts straight from your Markdown'),
        ('mac-light-release-plan', 'Gantt charts in your notes', 'Plan the work right beside the docs'),
        ('mac-light-api-reference', 'Tables and highlighted code', 'Clean typography for technical docs'),
        ('mac-dark-order-lifecycle', 'Beautiful in Dark Mode', 'Follows your system appearance'),
    ],
}

BG_TOP = (14, 23, 42)
BG_BOTTOM = (30, 41, 70)
TITLE = (255, 255, 255)
SUB = (170, 184, 208)


def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


def gradient(size):
    w, h = size
    img = Image.new('RGB', size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    return img


def compose(platform, raw_path, title, sub):
    cfg = PLATFORMS[platform]
    W, H = cfg['size']
    canvas = gradient((W, H))
    d = ImageDraw.Draw(canvas)
    size = cfg['title']
    ft = font(size, 'Bold')
    while d.textlength(title, font=ft) > W * 0.88:
        size -= 2
        ft = font(size, 'Bold')
    fs = font(cfg['sub'], 'Regular')
    head = cfg['head']
    ty = head * 0.30
    d.text((W / 2, ty), title, font=ft, fill=TITLE, anchor='mt')
    d.text((W / 2, ty + cfg['title'] * 1.35), sub, font=fs, fill=SUB, anchor='mt')

    shot = Image.open(raw_path).convert('RGB')
    avail_w, avail_h = W * 0.90, H - head - H * 0.03
    scale = min(avail_w / shot.width, avail_h / shot.height)
    sw, sh = round(shot.width * scale), round(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    x, y = (W - sw) // 2, head
    r = cfg['radius']
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], r, fill=255)
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([x, y + 12, x + sw, y + sh + 12], r, fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas = Image.composite(Image.new('RGB', (W, H), (0, 0, 0)), canvas, shadow)
    canvas.paste(shot, (x, y), mask)
    return canvas


def main():
    raw_dir = sys.argv[1]
    sha = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    index = {'schema': 1, 'source_sha': sha, 'status': 'DRAFT (pre-freeze; not AS-035 candidate)', 'sets': {}}
    for platform, scenes in SCENES.items():
        out_dir = os.path.join(ROOT, 'screenshots', platform, 'en-US')
        os.makedirs(out_dir, exist_ok=True)
        entries = []
        for n, (raw, title, sub) in enumerate(scenes, 1):
            img = compose(platform, os.path.join(raw_dir, raw + '.png'), title, sub)
            assert img.size == PLATFORMS[platform]['size'] and img.mode == 'RGB'
            out = os.path.join(out_dir, f'{n:02d}-{raw.split("-", 2)[2]}.png')
            img.save(out, optimize=True)
            digest = hashlib.sha256(open(out, 'rb').read()).hexdigest()
            entries.append({'file': os.path.relpath(out, ROOT), 'raw': raw + '.png', 'title': title,
                            'subtitle': sub, 'size': list(img.size), 'sha256': digest})
            print(platform, n, os.path.basename(out))
        index['sets'][platform] = {'slot': PLATFORMS[platform]['slot'], 'count': len(entries), 'images': entries}
    with open(os.path.join(ROOT, 'screenshots', 'asset-index.json'), 'w') as fh:
        json.dump(index, fh, indent=2)
        fh.write('\n')


if __name__ == '__main__':
    main()
