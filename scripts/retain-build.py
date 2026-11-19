#!/usr/bin/env python3
"""Keep verified local Apple build products outside disposable worktrees."""
import argparse
import errno
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import stat
import subprocess
import tempfile
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parents[1]
ROOT = Path.home() / "Builds" / "SpecDown"
CHANNELS = {"": "prod", ".dev": "dev", ".beta": "beta"}


def digest_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checksum(path):
    """Hash files verbatim; hash bundles by sorted path, mode, contents and links."""
    if path.is_file() and not path.is_symlink():
        return digest_file(path)
    digest = hashlib.sha256()
    for item in [path, *sorted(path.rglob("*"))]:
        mode = item.lstat().st_mode
        if stat.S_ISLNK(mode):
            value = os.readlink(item)
        elif stat.S_ISDIR(mode):
            value = ""
        elif stat.S_ISREG(mode):
            value = digest_file(item)
        else:
            raise ValueError(f"Unsupported file in build: {item}")
        # Preserve resource fork data in the fingerprint when present.
        fork = None
        if stat.S_ISREG(mode):
            resource = item / "..namedfork/rsrc"
            if resource.is_file():
                fork = digest_file(resource)
        digest.update(json.dumps([str(item.relative_to(path)), mode, value, fork]).encode() + b"\n")
    return digest.hexdigest()


def identify(product):
    app = product
    if product.suffix == ".xcarchive":
        archive = plistlib.loads((product / "Info.plist").read_bytes())
        app = (product / "Products" / archive["ApplicationProperties"]["ApplicationPath"]).resolve()
        app.relative_to(product)
    if app.suffix != ".app":
        raise ValueError("Choose a SpecDown .app or .xcarchive")
    mac = (app / "Contents/Info.plist").is_file()
    contents = app / "Contents" if mac else app
    info = plistlib.loads((contents / "Info.plist").read_bytes())
    bundle = info["CFBundleIdentifier"]
    if mac and bundle in ("com.specdown.desktop", "com.specdown.desktop.dev"):
        platforms = ["mac-direct"]
        base = "com.specdown.desktop"
    else:
        base = "com.mosaicpando.specdown"
        platforms = ["mac-store"] if mac else [
            name for family, name in [(1, "ios"), (2, "ipados")] if family in info["UIDeviceFamily"]
        ]
    if not platforms or not bundle.startswith(base) or bundle[len(base):] not in CHANNELS:
        raise ValueError(f"Unknown SpecDown product: {bundle}")
    version, build = info["CFBundleShortVersionString"], info["CFBundleVersion"]
    if not all(re.fullmatch(r"[0-9A-Za-z][0-9A-Za-z.+-]{0,79}", v) for v in [version, build]):
        raise ValueError("Invalid version or build in bundle")
    kind = "mac"
    if not mac:
        kind = {("iPhoneOS",): "device", ("iPhoneSimulator",): "simulator"}[
            tuple(info["CFBundleSupportedPlatforms"])]
    if product.suffix == ".xcarchive":
        kind += "-archive"
    binary = contents / "MacOS" / info["CFBundleExecutable"] if mac else app / info["CFBundleExecutable"]
    arches = sorted(subprocess.check_output(["lipo", "-archs", binary], text=True).split())
    return dict(platforms=platforms, channel=CHANNELS[bundle[len(base):]], bundle_id=bundle,
                version=version, build=build, kind=kind, architectures=arches)


def verify(record, files):
    actual = json.loads((record / "manifest.json").read_text())["products"]
    if actual != files or any(checksum(record / name) != value for name, value in files.items()):
        raise ValueError(f"Retained build failed verification: {record}")


def retain(product, extras, revision, dirty, root):
    info = identify(product)
    sources = [product, *extras]
    files = {src.name: checksum(src) for src in sources}
    if len(files) != len(sources) or "manifest.json" in files:
        raise ValueError("Retained products must have distinct names")
    fingerprint = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
    source = revision[:12] + ("-dirty" if dirty else "")
    key = f"{info['version']}-{info['build']}-{source}-{info['kind']}-{'-'.join(info['architectures'])}-{fingerprint[:12]}"
    parent = root / info["platforms"][0] / info["channel"]
    parent.mkdir(parents=True, exist_ok=True)
    record = parent / key
    if not record.exists():
        with tempfile.TemporaryDirectory(dir=parent, prefix=".retaining-") as work:
            pending = Path(work) / "record"
            pending.mkdir()
            for src in sources:
                subprocess.run(["ditto", src, pending / src.name], check=True)
            manifest = dict(info, source_revision=revision, source_dirty=dirty, products=files,
                            retained_at=datetime.now(timezone.utc).isoformat())
            (pending / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
            verify(pending, files)
            try:
                pending.rename(record)
            except OSError as exc:
                if exc.errno not in (errno.EEXIST, errno.ENOTEMPTY):
                    raise
                verify(record, files)  # Another worktree published identical bytes.
    else:
        verify(record, files)
    print(record)
    for platform in info["platforms"][1:]:
        alias = root / platform / info["channel"] / key
        alias.parent.mkdir(parents=True, exist_ok=True)
        try:
            alias.symlink_to(os.path.relpath(record, alias.parent))
        except FileExistsError:
            if not alias.is_symlink() or alias.resolve() != record.resolve():
                raise ValueError(f"Conflicting retained build: {alias}")
        print(alias)
    return record


def main(root=ROOT):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("product", type=Path)
    parser.add_argument("--extra", action="append", type=Path, default=[],
                        help="matching installer, symbols or other output from this build")
    parser.add_argument("--revision", help="revision of an existing build, or unknown")
    args = parser.parse_args()
    revision = args.revision or "HEAD"
    dirty = None
    if revision != "unknown":
        lookup = subprocess.run(
            ["git", "rev-parse", "--verify", "--end-of-options", revision + "^{commit}"],
            cwd=REPO, capture_output=True, text=True)
        if args.revision:
            lookup.check_returncode()
        revision = lookup.stdout.strip() if lookup.returncode == 0 else "unknown"
    if not args.revision and revision != "unknown":
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO))
    # Create private directories; ditto preserves the permissions within signed bundles.
    os.umask(0o077)
    retain(args.product.resolve(strict=True), [p.resolve(strict=True) for p in args.extra], revision, dirty, root)


if __name__ == "__main__":
    main()
