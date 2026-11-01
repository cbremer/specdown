#!/usr/bin/env python3
"""Exercise iOS icon validation against genuine output and rejected regressions."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from PIL import Image, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
ICON = 'ios/SpecDown/Assets.xcassets/AppIcon-light.appiconset/AppIcon-1024.png'
PREVIEW = 'ios/SpecDown/Assets.xcassets/IconPreview-light.imageset/icon.png'


class LightIconValidationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        paths = [ICON, PREVIEW, str(Path(ICON).parent / 'Contents.json'),
                 str(Path(PREVIEW).parent / 'Contents.json'), 'build/app-icon-sources/light.png',
                 'ios/project.yml', 'ios/SpecDown/AppIconPicker.swift']
        for relative in paths:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)

    def verify(self):
        return subprocess.run([sys.executable, str(ROOT / 'scripts/verify-app-icons.py'),
                               '--ios-light-only', '--root', str(self.root)],
                              capture_output=True, text=True)

    def replace_icon(self, image):
        metadata = PngImagePlugin.PngInfo()
        metadata.add(b'sRGB', b'\x00')
        image.save(self.root / ICON, pnginfo=metadata)
        shutil.copyfile(self.root / ICON, self.root / PREVIEW)

    def test_actual_export_passes(self):
        result = self.verify()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_desktop_inset_even_with_matching_preview(self):
        with Image.open(self.root / 'build/app-icon-sources/light.png') as source:
            image = Image.new('RGB', (1024, 1024), 'white')
            image.paste(source.resize((824, 824)), (100, 100))
        self.replace_icon(image)
        result = self.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('without an inset', result.stderr)

    def test_rejects_alpha_channel(self):
        with Image.open(self.root / ICON) as source:
            self.replace_icon(source.convert('RGBA'))
        result = self.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('opaque 1024px RGB', result.stderr)

    def test_rejects_mismatched_preview(self):
        (self.root / PREVIEW).write_bytes(b'not the exported icon')
        result = self.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('preview must match', result.stderr)

    def test_rejects_missing_registration(self):
        path = self.root / 'ios/project.yml'
        path.write_text(path.read_text().replace(' AppIcon-light', ''))
        result = self.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('not registered', result.stderr)

    def test_rejects_missing_manual_choice(self):
        path = self.root / 'ios/SpecDown/AppIconPicker.swift'
        path.write_text(path.read_text().replace(', light', ''))
        result = self.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('manual picker choice missing', result.stderr)


class LegacyIOSIconValidationTests(unittest.TestCase):
    variants = ('flat', 'glass', 'ceramic', 'metallic', 'layered', 'minimal')

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for variant in self.variants:
            for relative in [f'build/app-icon-sources/{variant}.png', f'desktop/icons/{variant}.png',
                             f'ios/SpecDown/Assets.xcassets/AppIcon-{variant}.appiconset/AppIcon-1024.png',
                             f'ios/SpecDown/Assets.xcassets/IconPreview-{variant}.imageset/icon.png']:
                target = self.root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)

    def verify(self):
        return subprocess.run([sys.executable, str(ROOT / 'scripts/verify-app-icons.py'),
                               '--ios-legacy-only', '--root', str(self.root)],
                              capture_output=True, text=True)

    def replace_icon(self, variant, image):
        icon = self.root / f'ios/SpecDown/Assets.xcassets/AppIcon-{variant}.appiconset/AppIcon-1024.png'
        metadata = PngImagePlugin.PngInfo()
        metadata.add(b'sRGB', b'\x00')
        image.save(icon, pnginfo=metadata)
        shutil.copyfile(icon, self.root / f'ios/SpecDown/Assets.xcassets/IconPreview-{variant}.imageset/icon.png')

    def test_actual_ios_and_unchanged_desktop_exports_pass(self):
        result = self.verify()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_old_desktop_composite_for_each_ios_choice(self):
        for variant in self.variants:
            with self.subTest(variant=variant):
                with Image.open(self.root / f'desktop/icons/{variant}.png') as desktop:
                    image = Image.new('RGB', (1024, 1024), (11, 17, 29))
                    image.paste(desktop, mask=desktop.getchannel('A'))
                self.replace_icon(variant, image)
                result = self.verify()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f'{variant}: desktop centered', result.stdout)
                self.assertIn(f'{variant}: iOS must aspect-fill', result.stderr)
                for relative in [f'ios/SpecDown/Assets.xcassets/AppIcon-{variant}.appiconset/AppIcon-1024.png',
                                 f'ios/SpecDown/Assets.xcassets/IconPreview-{variant}.imageset/icon.png']:
                    shutil.copyfile(ROOT / relative, self.root / relative)

    def test_rejects_fit_leaving_short_axis_padding(self):
        with Image.open(self.root / 'build/app-icon-sources/minimal.png') as master:
            bounds = master.getchannel('A').point(lambda p: 255 if p >= 250 else 0).getbbox()
            side = max(bounds[2] - bounds[0], bounds[3] - bounds[1]) - 4
            cx, cy = (bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2
            crop = master.transform((1024, 1024), Image.Transform.EXTENT,
                                    (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2),
                                    Image.Resampling.BICUBIC)
            image = Image.new('RGB', (1024, 1024), (11, 17, 29))
            image.paste(crop, mask=crop.getchannel('A'))
        self.replace_icon('minimal', image)
        result = self.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('minimal: iOS must aspect-fill', result.stderr)

    def test_rejects_stretched_rectangular_tile(self):
        with Image.open(self.root / 'build/app-icon-sources/minimal.png') as master:
            bounds = master.getchannel('A').point(lambda p: 255 if p >= 250 else 0).getbbox()
            crop = master.crop(bounds).resize((1024, 1024))
            image = Image.new('RGB', (1024, 1024), (11, 17, 29))
            image.paste(crop, mask=crop.getchannel('A'))
        self.replace_icon('minimal', image)
        result = self.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('minimal: iOS must aspect-fill', result.stderr)


if __name__ == '__main__':
    unittest.main()
