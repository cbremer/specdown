"""Apply the approved 1.0.3 gallery template to captures of the new candidate."""
import argparse
import base64
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image

SCENES = {
    "01-home": None,
    "02-presentation": None,
    "03-word": ("Open a Word document", "Bring headings and text into Markdown"),
    "04-edit": ("Make a quick edit", "Preview your changes and save as Markdown"),
    "05-mindmap": None,
    "06-plan": None,
    "07-pdf": ("Read text from a scan", "Recognize PDF text on your device"),
    "08-light": None,
}

def render(raw, output, device, chrome):
    style = json.loads(Path(__file__).with_name("gallery-style.json").read_text())
    folder = output / device
    folder.mkdir(parents=True, exist_ok=True)
    entries = []
    for name, caption in SCENES.items():
        order = int(name[:2])
        capture = raw / f"{device}-{name}.png"
        key = style["templateFor"][device][str(order)]
        css = style["templates"][key]
        headline, subtitle = caption or style["captions"][str(order)]
        with Image.open(capture) as frame:
            width, height = frame.size
            assert len(frame.convert("RGB").resize((80, 80)).getcolors(6400)) > 25, f"Blank {capture.name}"
        encoded = base64.b64encode(capture.read_bytes()).decode()
        page = ('<!doctype html><meta charset="utf-8"><style>' + css
                + '</style><div class="scene"><header><h1>' + escape(headline)
                + '</h1><p>' + escape(subtitle) + '</p></header><div class="capture">'
                + '<img src="data:image/png;base64,' + encoded + '"></div></div>')
        final = folder / f"{name}.png"
        with tempfile.TemporaryDirectory() as tmp:
            temp = Path(tmp)
            html = temp / "artwork.html"
            html.write_text(page)
            rendered = temp / "export.png"
            result = subprocess.run([str(chrome), "--headless", "--disable-gpu", "--disable-extensions",
                            "--disable-background-networking", "--hide-scrollbars", "--no-first-run",
                            "--user-data-dir=" + str(temp / "profile"), "--force-device-scale-factor=1",
                            f"--window-size={width},{height}", "--screenshot=" + str(rendered.resolve()),
                            html.as_uri()], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if not rendered.exists():
                result.check_returncode()
            with Image.open(rendered) as image:
                image.load()
                assert image.size == (width, height)
                assert image.getpixel((0, 0))[:3] == (14, 23, 42)
                image.convert("RGB").save(final, optimize=True)
        entries.append(dict(file=f"{device}/{final.name}", size=[width, height], headline=headline,
                            subtitle=subtitle, sha256=sha256(final.read_bytes()).hexdigest(),
                            captureSha256=sha256(capture.read_bytes()).hexdigest()))
    (folder / "manifest.json").write_text(json.dumps(entries, indent=2) + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("devices", nargs="+", choices=("mac", "iphone", "ipad", "duo"))
    parser.add_argument("--chrome", type=Path, default=Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"))
    args = parser.parse_args()
    for device in args.devices:
        render(args.raw, args.output, device, args.chrome)
