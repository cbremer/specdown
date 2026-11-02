#!/usr/bin/env python3
"""Verify the retained release assets; optionally reproduce into a new directory."""

import argparse
import hashlib
import importlib.util
import io
import json
import sys

import PIL
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
    if args.output_dir:
        require(not args.output_dir.is_symlink(), "Output directory must not be a symbolic link")
    output = args.output_dir.resolve() if args.output_dir else None
    if output:
        require(not output.exists(), "Output directory must not already exist")
        require(output != PACKET and PACKET not in output.parents, "Output must be outside the retained packet")

    manifest = json.loads((PACKET / "manifest.json").read_text())
    composition = manifest["composition"]
    require(PIL.__version__ == composition["pillow_version"], "Use the recorded Pillow version for exact PNG reproduction")
    require(digest((REPO / manifest["caption_packet"]).read_bytes()) == manifest["caption_packet_sha256"], "Approved caption packet changed")
    require(digest((PACKET / manifest["provenance"]["file"]).read_bytes()) == manifest["provenance"]["sha256"], "Provenance changed")
    captions = json.loads((REPO / manifest["caption_packet"]).read_text())["sets"]["iphone_duo"]["images"]
    require([scene["order"] for scene in manifest["images"]] == list(range(1, 6)), "Five ordered scenes required")
    require(len(captions) == len(manifest["images"]), "Caption count must match all five retained scenes")
    contact = manifest["contact_sheet"]
    require(digest((PACKET / contact["file"]).read_bytes()) == contact["sha256"], "Review contact sheet changed")
    with Image.open(PACKET / contact["file"]) as image:
        require(list(image.size) == contact["size"] and image.mode == contact["mode"], "Review contact sheet format changed")
    composer = REPO / composition["composer"]
    require(digest(composer.read_bytes()) == composition["composer_sha256"], "Composer changed from the approved recipe")
    require(digest(args.font.read_bytes()) == composition["font_sha256"], "The matching SFNS font is required for exact reproduction")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("retained_store_composer", composer)
    require(spec is not None and spec.loader is not None, "Could not load the retained compositor")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.FONT = str(args.font)
    module.PLATFORMS["duo-inner"] = composition["profile"]

    reproduced = []
    for scene, caption in zip(manifest["images"], captions):
        require(scene["title"] == caption["title"] and scene["subtitle"] == caption["subtitle"] and scene["demo_source"] == caption["demo_document"], "Caption or demo differs from approved copy")
        raw, final = PACKET / scene["raw"], PACKET / scene["file"]
        require(digest(raw.read_bytes()) == scene["raw_sha256"], f"Raw hash changed: {raw.name}")
        require(digest(final.read_bytes()) == scene["sha256"], f"Final hash changed: {final.name}")
        require(digest((REPO / scene["demo_source"]).read_bytes()) == scene["demo_sha256"], f"Demo changed: {scene['demo_source']}")
        with Image.open(raw) as image:
            require(list(image.size) == scene["raw_size"], f"Raw dimensions changed: {raw.name}")
        result = module.compose("duo-inner", str(raw), scene["title"], scene["subtitle"])
        with Image.open(final) as image:
            require(list(image.size) == scene["size"] and image.mode == scene["mode"], f"Final format changed: {final.name}")
            require(not image.info, f"Unexpected final metadata: {final.name}")
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
