#!/usr/bin/env python3
"""Validate this proof packet without changing source, assets or portal fields."""

import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
CHARACTER_LIMITS = {
    "name": 30,
    "subtitle": 30,
    "promotional_text": 170,
    "description": 4000,
    "whats_new": 4000,
}
BYTE_LIMITS = {"keywords": 100, "app_review_notes": 4000}
PLACEHOLDERS = re.compile(r"\[(?:VERIFY|TODO|PLACEHOLDER)|pending D\d|being purchased|Pages not yet published", re.I)


def main():
    report = {"status": "pass", "scope": "Local copy limits and consistency only; no portal or runtime validation", "files": {}}
    proof = (ROOT / "proof.md").read_text()
    for platform in ("ios", "mac"):
        path = ROOT / (platform + "-en-US.json")
        data = json.loads(path.read_text())
        assert data["version"] == "1.0.1"
        assert data["sign_in_required"] is False
        assert data["copyright"] == "2026 SpecDown"
        fields = {}
        for field, value in data.items():
            if not isinstance(value, str):
                continue
            assert value.strip(), (path.name, field, "empty")
            assert not PLACEHOLDERS.search(value), (path.name, field, "placeholder")
            assert not any(ord(ch) < 32 and ch != "\n" for ch in value), (field, "control character")
            chars, size = len(value), len(value.encode("utf-8"))
            fields[field] = {"characters": chars, "utf8_bytes": size}
            if field in CHARACTER_LIMITS:
                limit = CHARACTER_LIMITS[field]
                assert chars <= limit, (path.name, field, chars, limit)
                # This packet also fits a conservative byte interpretation.
                assert size <= limit, (path.name, field, size, limit)
                fields[field]["character_limit"] = limit
            if field in BYTE_LIMITS:
                limit = BYTE_LIMITS[field]
                assert size <= limit, (path.name, field, size, limit)
                fields[field]["byte_limit"] = limit
            if field.endswith("_url"):
                assert value.startswith("https://specdown.mosaicpando.com/"), (field, "unexpected URL")
        assert data["keywords"].isascii()
        assert len(data["keywords"]) <= 100
        assert len(data["keywords"].split(",")) == len(set(data["keywords"].split(",")))
        assert (ROOT / (platform + "-review-notes.txt")).read_text() == data["app_review_notes"] + "\n"
        for field in ("name", "subtitle", "promotional_text", "description", "keywords", "whats_new", "app_review_notes", "copyright"):
            assert data[field] in proof, (platform, field, "readable proof differs")
        public_text = "\n".join(data[key] for key in ("subtitle", "promotional_text", "description", "whats_new"))
        assert "annotation" not in public_text.lower()
        if platform == "mac":
            for forbidden in ("iphone", "ipad", "share sheet", "icloud drive", "nsallowsarbitraryloads", "automatically refresh", "custom css"):
                assert forbidden not in (public_text + data["app_review_notes"]).lower(), forbidden
        report["files"][path.name] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "fields": fields}
    captions_path = ROOT / "screenshot-captions.json"
    captions = json.loads(captions_path.read_text())
    caption_counts = {}
    for platform, group in captions["sets"].items():
        assert [item["order"] for item in group["images"]] == [1, 2, 3, 4, 5]
        caption_counts[platform] = []
        for item in group["images"]:
            # Editorial readability budgets, not Apple metadata limits.
            assert len(item["title"]) <= 42
            assert len(item["subtitle"]) <= 72
            assert (ROOT.parents[3] / item["demo_document"]).is_file(), item["demo_document"]
            caption_counts[platform].append({"order": item["order"], "title_characters": len(item["title"]), "subtitle_characters": len(item["subtitle"])})
    report["files"][captions_path.name] = {"sha256": hashlib.sha256(captions_path.read_bytes()).hexdigest(), "editorial_title_limit": 42, "editorial_subtitle_limit": 72, "sets": caption_counts}
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
