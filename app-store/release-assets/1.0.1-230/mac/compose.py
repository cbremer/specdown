#!/usr/bin/env python3
"""Verify the retained release assets; optionally reproduce into a new directory."""

import argparse
import hashlib
import importlib.util
import io
import json
import sys
from pathlib import Path

from PIL import Image

PACKET = Path(__file__).resolve().parent
REPO = PACKET.parents[3]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path, default=Path("/System/Library/Fonts/SFNS.ttf"))
    parser.add_argument("--output-dir", type=Path, help="New directory outside this packet; never overwrite retained assets")
    args = parser.parse_args()
    output = args.output_dir.resolve() if args.output_dir else None
    if output:
        require(not output.exists(), "Output directory must not already exist")
        require(output != PACKET and PACKET not in output.parents, "Output must be outside the retained packet")

    manifest = json.loads((PACKET / "manifest.json").read_text())
    composition = manifest["composition"]
    composer = REPO / composition["composer"]
    require(digest(composer.read_bytes()) == composition["composer_sha256"], "Composer changed from the approved recipe")
    require(digest(args.font.read_bytes()) == composition["font_sha256"], "The matching SFNS font is required for exact reproduction")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("retained_store_composer", composer)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.FONT = str(args.font)

    reproduced = []
    for scene in manifest["images"]:
        raw, final = PACKET / scene["raw"], PACKET / scene["file"]
        require(digest(raw.read_bytes()) == scene["raw_sha256"], f"Raw hash changed: {raw.name}")
        require(digest(final.read_bytes()) == scene["sha256"], f"Final hash changed: {final.name}")
        require(digest((REPO / scene["demo_source"]).read_bytes()) == scene["demo_sha256"], f"Demo changed: {scene['demo']}")
        with Image.open(raw) as image:
            require(list(image.size) == scene["raw_size"], f"Raw dimensions changed: {raw.name}")
        result = module.compose("mac", str(raw), scene["title"], scene["subtitle"])
        with Image.open(final) as image:
            require(list(image.size) == scene["size"] and image.mode == scene["mode"], f"Final format changed: {final.name}")
            require(result.tobytes() == image.tobytes(), f"Recomposed pixels differ: {final.name}")
        encoded = io.BytesIO()
        result.save(encoded, format="PNG", optimize=True)
        require(digest(encoded.getvalue()) == scene["sha256"], f"PNG encoding differs: {final.name}; use the documented Pillow version")
        reproduced.append((final.name, encoded.getvalue()))

    if output:
        output.mkdir(parents=True)
        for name, data in reproduced:
            (output / name).write_bytes(data)
    print(json.dumps({"status": "passed", "images": len(reproduced), "output_directory": str(output) if output else None}))


if __name__ == "__main__":
    main()
