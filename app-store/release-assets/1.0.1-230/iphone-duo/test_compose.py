"""Failure checks for the retained Duo packet verifier; no image writes."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import compose


class RetainedPacketFailures(unittest.TestCase):
    def run_with_args(self, *args):
        with patch("sys.argv", [str(compose.PACKET / "compose.py"), *args]):
            compose.main()

    def assert_caption_count_rejected(self, count):
        loads = json.loads

        def changed_caption_count(value):
            result = loads(value)
            if "sets" in result and "iphone_duo" in result["sets"]:
                images = result["sets"]["iphone_duo"]["images"]
                result["sets"]["iphone_duo"]["images"] = (
                    images[:count] if count < len(images) else images + [images[-1]]
                )
            return result

        with patch.object(compose.json, "loads", side_effect=changed_caption_count):
            with self.assertRaisesRegex(ValueError, "Caption count must match"):
                self.run_with_args()

    def test_missing_caption_is_rejected(self):
        self.assert_caption_count_rejected(4)

    def test_extra_caption_is_rejected(self):
        self.assert_caption_count_rejected(6)

    def test_missing_compositor_spec_is_rejected(self):
        with patch.object(compose.importlib.util, "spec_from_file_location", return_value=None):
            with self.assertRaisesRegex(ValueError, "Could not load the retained compositor"):
                self.run_with_args()

    def test_missing_compositor_loader_is_rejected(self):
        with patch.object(
            compose.importlib.util, "spec_from_file_location", return_value=SimpleNamespace(loader=None)
        ):
            with self.assertRaisesRegex(ValueError, "Could not load the retained compositor"):
                self.run_with_args()

    def test_existing_output_is_rejected(self):
        with TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(ValueError, "must not already exist"):
                self.run_with_args("--output-dir", temporary)
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_output_inside_packet_is_rejected(self):
        output = compose.PACKET / "forbidden-test-output"
        self.assertFalse(output.exists())
        with self.assertRaisesRegex(ValueError, "outside the retained packet"):
            self.run_with_args("--output-dir", str(output))
        self.assertFalse(output.exists())

    def test_existing_output_symlink_is_rejected(self):
        with TemporaryDirectory() as temporary:
            target = Path(temporary) / "target"
            target.mkdir()
            output = Path(temporary) / "output"
            output.symlink_to(target, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "must not be a symbolic link"):
                self.run_with_args("--output-dir", str(output))
            self.assertTrue(output.is_symlink())
            self.assertEqual(list(target.iterdir()), [])

    def test_dangling_output_symlink_is_rejected(self):
        with TemporaryDirectory() as temporary:
            target = Path(temporary) / "missing-target"
            output = Path(temporary) / "output"
            output.symlink_to(target, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "must not be a symbolic link"):
                self.run_with_args("--output-dir", str(output))
            self.assertTrue(output.is_symlink())
            self.assertFalse(target.exists())


if __name__ == "__main__":
    unittest.main()
