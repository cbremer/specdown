"""Exercise a built viewer in Chromium using Python Playwright.

Run npm run build, then python scripts/test-reader-browser.py. Set
SPECDOWN_CHROMIUM to use a system Chromium executable. Pass --installed on
a graphical host to exercise a disposable installed PWA, including offline.
"""

import argparse
import os
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
DOCUMENT = ROOT / "tests/fixtures/reader-retry-policy.md"
SELECTION = "client retries twice after a timeout."


class ViewerFiles(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def choose(page, action):
    page.get_by_role("button", name="More actions", exact=True).click()
    page.get_by_role("menuitem", name=action, exact=True).click()


def select_retry_requirement(page):
    paragraph = page.locator("#markdown-content p").first
    paragraph.evaluate(
        """p => {
            const range = document.createRange();
            range.setStart(p.firstChild, 4);
            range.setEnd(p.lastChild, p.lastChild.textContent.indexOf('.') + 1);
            const selection = getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }"""
    )
    assert page.evaluate("String(getSelection())") == SELECTION


def check_sources(page):
    page.locator("#file-input").set_input_files(DOCUMENT)
    page.locator("#markdown-content .diagram-wrapper svg").wait_for()
    select_retry_requirement(page)
    choose(page, "Explain…")
    rail = page.locator("#explain-rail")
    expect(rail.get_by_text(re.compile("On-device explanations are unavailable"))).to_be_visible()
    expect(rail.locator("blockquote")).to_have_text(SELECTION)
    rail.get_by_role("button", name="Close explanation").click()
    assert page.evaluate("String(getSelection())") == SELECTION

    page.evaluate("getSelection().removeAllRanges()")
    page.locator("#markdown-content .diagram-expand").focus()
    choose(page, "Explain…")
    expect(rail.get_by_role("button", name=re.compile("Worker times out.*API → Worker: Cancel job"))).to_be_visible()
    expect(rail.get_by_role("button", name=re.compile("Worker times out.*API → Client: Timeout response"))).to_be_visible()
    repeated = rail.get_by_role("button", name=re.compile("Record outcome"))
    expect(repeated).to_have_count(2)
    occurrences = []
    for button in repeated.all():
        button.click()
        assert page.evaluate("String(getSelection())") == "Record outcome"
        occurrences.append(page.evaluate(
            """() => {
                const node = getSelection().anchorNode;
                const label = (node.nodeType === 1 ? node : node.parentElement).closest('.messageText');
                return [...document.querySelectorAll('#markdown-content .messageText')].indexOf(label);
            }"""
        ))
    assert occurrences == [4, 7], occurrences
    rail.get_by_role("button", name="Close explanation").click()


def check_keyboard(page):
    page.set_viewport_size({"width": 390, "height": 640})
    page.emulate_media(color_scheme="dark", reduced_motion="reduce")
    select_retry_requirement(page)
    more = page.get_by_role("button", name="More actions", exact=True)
    more.focus()
    page.keyboard.press("Enter")
    explain = page.get_by_role("menuitem", name="Explain…")
    for _ in range(12):
        if explain.evaluate("button => document.activeElement === button"):
            break
        page.keyboard.press("Tab")
    expect(explain).to_be_focused()
    page.keyboard.press("Enter")
    dialog = page.get_by_role("dialog", name=re.compile("Explain"))
    expect(dialog).to_have_attribute("aria-modal", "true")
    bounds = dialog.bounding_box()
    assert bounds["x"] == 0 and bounds["width"] == 390 and bounds["height"] == 640, bounds
    for _ in range(12):
        page.keyboard.press("Tab")
        assert dialog.evaluate("panel => panel.contains(document.activeElement)")
    page.keyboard.press("Escape")
    expect(more).to_be_focused()
    assert page.evaluate("String(getSelection())") == SELECTION


def check_installed(playwright, url, executable, profile):
    env = dict(os.environ)
    for key in ("XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME"):
        env[key] = str(profile / key)
    context = playwright.chromium.launch_persistent_context(
        str(profile / "profile"), executable_path=executable, headless=False,
        ignore_default_args=True, args=["--remote-debugging-pipe", "--no-sandbox"], env=env,
    )
    try:
        tab = context.new_page()
        tab.goto(url)
        tab.evaluate("navigator.serviceWorker.ready.then(() => true)")
        client = context.new_cdp_session(tab)
        app = {"manifestId": url}
        client.send("PWA.install", {**app, "installUrlOrBundleUrl": url})
        client.send("PWA.changeAppUserSettings", {**app, "displayMode": "standalone"})
        with context.expect_page() as launched:
            client.send("PWA.launch", app)
        page = launched.value
        page.wait_for_function("matchMedia('(display-mode: standalone)').matches")
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        check_sources(page)
        context.set_offline(True)
        page.reload(wait_until="domcontentloaded")
        check_sources(page)
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installed", action="store_true")
    options = parser.parse_args()
    built = ROOT / "markdown-viewer/dist"
    if not (built / "index.html").is_file():
        parser.error("Run npm run build first.")
    files = partial(ViewerFiles, directory=built)
    with ThreadingHTTPServer(("127.0.0.1", 0), files) as server, sync_playwright() as playwright:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}/"
        executable = os.environ.get("SPECDOWN_CHROMIUM")
        try:
            if options.installed:
                with TemporaryDirectory(prefix="specdown-reader-pwa-") as directory:
                    check_installed(playwright, url, executable, Path(directory))
            else:
                with playwright.chromium.launch(executable_path=executable) as browser:
                    page = browser.new_page(viewport={"width": 1280, "height": 850})
                    page.goto(url)
                    check_sources(page)
                    check_keyboard(page)
        finally:
            server.shutdown()
    print("Reader browser checks passed")


if __name__ == "__main__":
    main()
