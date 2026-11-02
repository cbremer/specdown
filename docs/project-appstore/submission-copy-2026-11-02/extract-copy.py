#!/usr/bin/env python3
"""Extract the approved HTML's literal copy; --check never writes files."""

import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).resolve().parent
SOURCE = "e8dd3cb95a41c19ad10c14e6f1efba3287866625"
HTML_PATH = "docs/project-appstore/copy-proposal.html"
OLD_COPY = "docs/project-appstore/release-proof-2026-11-01/copy"
# Rebase merging can replace SOURCE's commit ID. Checked-in snapshots are a
# safe fallback only when they match these exact, independently reviewed bytes.
SOURCE_HASHES = {
    HTML_PATH: "a56a892d8a1968f54d858a8053689932a8888d45a07b87ab56cbd9f2f386bafd",
    OLD_COPY + "/selected/ios-en-US.json": "267d8eb00095b09b70fcdea6577f9333c87351e41f94885885cd4e5833edde82",
    OLD_COPY + "/selected/mac-en-US.json": "755188e8cba36f849339cb09a2bb6e7383b822dab66df3887c5eec520d0cd9c2",
    OLD_COPY + "/selection.json": "ef9f056b337eb135f9134fe38106b849eed7b3aef89a54e41c1a8a3bb2677862",
    OLD_COPY + "/selected/screenshot-captions.json": "efa630a2075b92c429394667e1f502a56cbc8b50c3535b0c6251eded339c3ddf",
}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def nodes(self):
        return [item for item in self.children if isinstance(item, Node)]

    def find(self, predicate):
        result = []
        for child in self.nodes():
            if predicate(child):
                result.append(child)
            result.extend(child.find(predicate))
        return result

    def text(self):
        return "".join(item.text() if isinstance(item, Node) else item for item in self.children)


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        assert self.stack[-1].tag == tag, (tag, self.stack[-1].tag)
        self.stack.pop()

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def text(node):
    return re.sub(r"\s+", " ", node.text()).strip()


def one(nodes):
    assert len(nodes) == 1, len(nodes)
    return nodes[0]


def has_class(node, name):
    return name in node.attrs.get("class", "").split()


def blocks(nodes):
    """Keep words, punctuation and heading case; serialize only HTML layout."""
    result = []
    for node in nodes:
        if node.tag in {"p", "h5"}:
            result.append(text(node))
        elif node.tag in {"ul", "ol"}:
            items = [child for child in node.nodes() if child.tag == "li"]
            result.append("\n".join(
                (f"{i}. " if node.tag == "ol" else "• ") + text(item)
                for i, item in enumerate(items, 1)
            ))
        else:
            raise AssertionError("Unexpected copy block: " + node.tag)
    return "\n\n".join(result)


def blob(path):
    expected = SOURCE_HASHES[path]
    try:
        data = subprocess.check_output(
            ["git", "show", SOURCE + ":" + path], cwd=ROOT,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        data = (ROOT / path).read_bytes()
    assert sha(data) == expected, "Approved source snapshot mismatch: " + path
    return data


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_text(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write deterministic packet outputs")
    parser.add_argument("--check", action="store_true", help="check existing outputs (default)")
    args = parser.parse_args()
    assert not (args.write and args.check)

    html = blob(HTML_PATH)
    document = Document(html.decode()).root
    section = lambda identifier: one(document.find(lambda n: n.attrs.get("id") == identifier))
    listing_nodes = section("app-store").find(lambda n: n.tag == "article" and has_class(n, "listing"))
    assert len(listing_nodes) == 2
    labels = {"Name": "name", "Subtitle": "subtitle", "Promotional text": "promotional_text", "Description": "description", "Keywords": "keywords", "What’s New": "whats_new"}
    listings = {}
    for platform, node in zip(("ios", "mac"), listing_nodes):
        fields = {}
        for field in node.nodes():
            if not has_class(field, "field"):
                continue
            heading = one([n for n in field.nodes() if n.tag == "h4"])
            fields[labels[text(heading)]] = blocks([n for n in field.nodes() if n is not heading])
        listings[platform] = fields
    assert "whats_new" in listings["ios"] and "whats_new" not in listings["mac"]

    meta = {}
    for dl in section("metadata").find(lambda n: n.tag == "dl"):
        children = dl.nodes()
        for i, node in enumerate(children):
            if node.tag == "dt":
                assert children[i + 1].tag == "dd"
                meta[text(node)] = text(children[i + 1])
    assert meta["App Store record"] == "6822086808"
    assert meta["Production bundle ID"] == "com.mosaicpando.specdown"
    assert meta["Version"] == "1.0.1 — iOS and Mac" and meta["Build"].startswith("230 —")
    shared = {
        "name": listings["ios"]["name"],
        "subtitle": listings["ios"]["subtitle"],
        "support_url": meta["Support URL"],
        "marketing_url": meta["Marketing URL"],
        "privacy_policy_url": meta["Privacy policy URL"],
        "copyright": meta["Copyright"],
    }
    for key in ("name", "subtitle"):
        assert shared[key] == listings["mac"][key]
    assert meta["Sign-in required"] == "No. No demo account or password is required."

    review = section("review").nodes()
    after = lambda label: review[next(i for i, n in enumerate(review) if n.tag == "h3" and text(n) == label) + 1]
    reviews = after("App Review notes").nodes()
    tests = after("What to Test").nodes()
    beta_description = blocks(after("TestFlight description").nodes())
    for i, platform in enumerate(("ios", "mac")):
        listings[platform].update({key: value for key, value in shared.items() if key not in {"name", "subtitle"}})
        listings[platform]["app_review_notes"] = blocks([n for n in reviews[i].nodes() if n.tag != "h3"])
        listings[platform]["testflight_description"] = beta_description
        listings[platform]["what_to_test"] = blocks([n for n in tests[i].nodes() if n.tag != "h3"])

    previous_captions = json.loads(blob(OLD_COPY + "/selected/screenshot-captions.json"))
    captions = {"locale": "en-US", "scope": "Approved caption text and retained capture references only; no screenshot pixel, asset upload or placement change.", "sets": {}}
    platform_names = {"iPhone": "iphone", "iPad": "ipad", "iPhone Duo": "iphone_duo", "Mac": "mac"}
    for article in section("screenshots").find(lambda n: n.tag == "article"):
        platform = platform_names[text(one([n for n in article.nodes() if n.tag == "h3"]))]
        previous = previous_captions["sets"][platform]
        images = []
        for i, item in enumerate(article.find(lambda n: n.tag == "li")):
            images.append({**previous["images"][i], "order": i + 1,
                           "title": text(one(item.find(lambda n: n.tag == "strong"))),
                           "subtitle": text(one(item.find(lambda n: n.tag == "p")))})
        assert len(images) == 5
        captions["sets"][platform] = {"slots": previous["slots"], "images": images}

    character_limits = {"name": 30, "subtitle": 30, "promotional_text": 170, "description": 4000, "whats_new": 4000}
    byte_limits = {"keywords": 100, "app_review_notes": 4000}
    validation = {"status": "pass", "scope": "Exact approved-source extraction and local field limits; no live portal readback or submission result.", "platforms": {}}
    for platform, values in listings.items():
        counts = {}
        for key, value in values.items():
            assert value and value == value.strip()
            assert not any(ord(c) < 32 and c != "\n" for c in value)
            count = {"characters": len(value), "utf8_bytes": len(value.encode())}
            if key in character_limits:
                count["character_limit"] = character_limits[key]
                assert len(value) <= character_limits[key], (platform, key)
            if key in byte_limits:
                count["byte_limit"] = byte_limits[key]
                assert len(value.encode()) <= byte_limits[key], (platform, key)
            if key in {"testflight_description", "what_to_test"}:
                count["local_conservative_byte_budget"] = 4000
                assert len(value.encode()) <= 4000
            counts[key] = count
        keywords = values["keywords"].split(",")
        assert len(keywords) == len(set(keywords)) and all(len(word) > 2 for word in keywords)
        assert all(word in keywords for word in ("ai workflows", "si workflows", "markdown"))
        validation["platforms"][platform] = counts

    acceptance = {
        "version": "1.0.1", "build": "230", "platforms": ["ios", "mac"],
        "status": "pending_exact_build_acceptance", "evidence_type": "owner_clarification", "reported_on": "2026-11-02",
        "superseded_report": "The earlier owner statement that both platforms passed was mistakenly attributed to 230. Chris clarified: My checks were on 228; update to 230.",
        "ios": "Exact production 230 acceptance is not reconfirmed; do not infer it from the earlier statement.",
        "mac": "Production 230 acceptance remains pending after the TestFlight update from installed 228.",
        "scope": "Copy remains approved, but App Review submission is gated on exact-build 230 acceptance. No device matrix or screenshot acceptance is inferred.",
    }
    packet = {
        "schema_version": 1,
        "status": "Approved copy prepared for App Store Connect synchronization; no portal fields changed by this packet task.",
        "target": {"app_store_id": "6822086808", "bundle_id": "com.mosaicpando.specdown", "version": "1.0.1", "build": "230", "locale": "en-US", "platforms": ["ios", "mac"]},
        "source": {"commit": SOURCE, "html_path": HTML_PATH, "html_sha256": sha(html), "normalization": "HTML whitespace collapsed inside text; paragraph boundaries become blank lines, headings retain case, unordered lists use bullet characters, ordered lists use numbers. No wording edits."},
        "supersedes": {"selection_path": OLD_COPY + "/selection.json", "selected_copy_directory": OLD_COPY + "/selected", "reason": "Owner approved final e8dd3cb wording for this production 230 submission. Retained Session51 files remain historical evidence and are not the upload source for this update."},
        "owner_testflight_acceptance": acceptance,
        "shared": shared,
        "app_review_sign_in_required": False,
        "platforms": listings,
        "mac_whats_new": {"include_field": False, "reason": "First Mac release: no What’s New field in approved HTML; retained historical reference text is excluded, not uploaded or blanked."},
        "screenshot_caption_references": "screenshot-captions.json",
        "excluded": ["account settings", "private contact fields", "age-rating answers", "privacy-label answers", "pricing/availability changes", "website copy publication", "signing", "build changes", "new screenshot uploads", "public release"],
    }

    changes = {"baseline_commit": SOURCE, "baseline_kind": "Retained selected field files; not a current live portal readback.", "platforms": {}, "screenshot_caption_changes": []}
    preserved = {}
    for platform, values in listings.items():
        old_path = OLD_COPY + "/selected/" + platform + "-en-US.json"
        old_bytes = blob(old_path)
        previous = json.loads(old_bytes)
        preserved[old_path] = sha(old_bytes)
        field_changes = {}
        for key in sorted(set(previous) | set(values)):
            if key in {"version", "sign_in_required"}:
                continue
            before, after_value = previous.get(key), values.get(key)
            field_changes[key] = {"changed": before != after_value, "before": before, "after": after_value}
            if platform == "mac" and key == "whats_new":
                field_changes[key]["disposition"] = "Exclude historical reference text; no first-release field to apply."
        changes["platforms"][platform] = field_changes
    for platform, group in captions["sets"].items():
        for i, item in enumerate(group["images"]):
            old_item = previous_captions["sets"][platform]["images"][i]
            for key in ("title", "subtitle"):
                if item[key] != old_item[key]:
                    changes["screenshot_caption_changes"].append({"platform": platform, "order": i + 1, "field": key, "before": old_item[key], "after": item[key], "scope": "Caption reference only; screenshot pixels unchanged."})
    for path in (OLD_COPY + "/selection.json", OLD_COPY + "/selected/screenshot-captions.json"):
        preserved[path] = sha(blob(path))

    outputs = {"packet.json": json_text(packet), "shared-en-US.json": json_text(shared), "screenshot-captions.json": json_text(captions), "field-diff.json": json_text(changes), "validation.json": json_text(validation)}
    for key, value in shared.items():
        outputs["fields/shared/" + key + ".txt"] = value
    for platform, values in listings.items():
        outputs[platform + "-en-US.json"] = json_text(values)
        for key, value in values.items():
            outputs["fields/" + platform + "/" + key + ".txt"] = value
    proof = ["# SpecDown production 1.0.1 (230): approved submission copy", "Prepared from the approved e8dd3cb HTML. This is the current copy source for the production Apple update; it supersedes the retained Session51 selection. Portal synchronization/readback and submission are parent-owned operations, not results of this extraction.", "Chris clarified on November 2 that the earlier passing checks were on build 228, not 230. Mac 230 acceptance is pending after updating; iOS 230 exact-build acceptance is unconfirmed. Do not use the superseded statement to clear the submission gate."]
    for platform, values in listings.items():
        proof.append("## " + ("iPhone and iPad" if platform == "ios" else "Mac App Store"))
        for key, value in values.items():
            proof.extend(["### " + key.replace("_", " ").title(), value])
        if platform == "mac":
            proof.append("Mac What’s New is intentionally absent for the first release; do not paste the retained historical reference text.")
    outputs["PROOF.md"] = "\n\n".join(proof) + "\n"
    delta = ["# Exact changes from retained selected copy", "The comparison is against Git-tracked retained selected files, not a fresh Apple readback. `field-diff.json` contains every exact before/after value.", "| Platform | Changed field |", "| --- | --- |"]
    for platform, field_changes in changes["platforms"].items():
        delta.extend("| " + platform + " | " + key + " |" for key, value in field_changes.items() if value["changed"])
    delta.extend(["", "Name, subtitle, URLs and copyright remain unchanged. New TestFlight text has no retained selected-file baseline; confirm it through the actual portal before saving. Mac What’s New is excluded because this is its first release.", "", "## Caption reference differences", ""])
    for item in changes["screenshot_caption_changes"]:
        delta.append(f'- {item["platform"]} image {item["order"]} {item["field"]}: “{item["before"]}” → “{item["after"]}”.')
    delta.append("\nThese are textual caption references. No image pixels, uploads, placements or new screenshot approval changed.")
    outputs["DIFF.md"] = "\n".join(delta) + "\n"
    manifest = {"schema_version": 1, "source_commit": SOURCE, "source_html_sha256": sha(html), "extractor_sha256": sha(Path(__file__).read_bytes()), "files": {path: {"sha256": sha(value.encode()), "bytes": len(value.encode())} for path, value in sorted(outputs.items())}, "historical_baseline_files_preserved": preserved, "text_file_contract": "Per-field .txt files contain the exact field value with no trailing newline. JSON represents the same values with escaped line breaks."}
    outputs["manifest.json"] = json_text(manifest)

    for relative, content in outputs.items():
        target = OUTPUT / relative
        if args.write:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content.encode())
        else:
            assert target.read_bytes() == content.encode(), relative
    for relative, expected in preserved.items():
        assert sha((ROOT / relative).read_bytes()) == expected, "Historical file changed: " + relative
    print(json_text({"status": "pass", "mode": "write" if args.write else "check", "output_files": len(outputs), "manifest_sha256": sha(outputs["manifest.json"].encode()), "source_html_sha256": sha(html), "field_counts": validation["platforms"], "caption_reference_changes": changes["screenshot_caption_changes"]}))


if __name__ == "__main__":
    main()
