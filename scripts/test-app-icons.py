#!/usr/bin/env python3
"""Exercise Light asset validation against genuine output and rejected regressions."""
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


if __name__ == '__main__':
    unittest.main()
