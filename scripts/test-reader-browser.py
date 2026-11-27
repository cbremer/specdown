"""Exercise a built viewer in Chromium using Python Playwright.

Run npm run build, then python scripts/test-reader-browser.py. Set
SPECDOWN_CHROMIUM to use a system Chromium executable. Pass --installed on
a graphical host to exercise a disposable installed PWA, including offline.
Use --screenshots-dir to save the synthetic model/voice scenario for review.
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
    page.get_by_role("menuitem", name=re.compile("^" + re.escape(action))).click()


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


def load_fixture(page):
    page.locator("#file-input").set_input_files(DOCUMENT)
    page.locator("#markdown-content .diagram-wrapper svg").wait_for()


def close_rail(page):
    page.locator(".sd-rail-close").click()


def check_sources(page):
    load_fixture(page)
    select_retry_requirement(page)
    choose(page, "Explain…")
    rail = page.locator(".sd-rail")
    expect(rail.get_by_text(re.compile("Explanations (aren.t|are not) available"))).to_be_visible()
    expect(rail.locator(".sd-scope-preview")).to_contain_text(SELECTION)
    expect(rail.get_by_role("tab", name="Explain")).to_have_attribute("aria-selected", "true")
    close_rail(page)
    assert page.evaluate("String(getSelection())") == SELECTION

    page.evaluate("getSelection().removeAllRanges()")
    page.locator("#markdown-content .diagram-expand").focus()
    choose(page, "Explain…")
    for message in ("Cancel job", "Timeout response"):
        expect(rail.get_by_role("button", name=re.compile(message))).to_be_visible()
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
    close_rail(page)


def check_keyboard(page):
    page.set_viewport_size({"width": 390, "height": 640})
    page.emulate_media(color_scheme="dark", reduced_motion="reduce")
    select_retry_requirement(page)
    more = page.get_by_role("button", name="More actions", exact=True)
    more.focus()
    page.keyboard.press("Enter")
    explain = page.get_by_role("menuitem", name=re.compile("^Explain…"))
    for _ in range(12):
        if explain.evaluate("button => document.activeElement === button"):
            break
        page.keyboard.press("Tab")
    expect(explain).to_be_focused()
    page.keyboard.press("Enter")
    dialog = page.locator(".sd-rail")
    expect(dialog).to_have_attribute("aria-modal", "true")
    bounds = dialog.bounding_box()
    assert bounds["x"] == 0 and bounds["width"] == 390 and bounds["height"] == 640, bounds
    for _ in range(12):
        page.keyboard.press("Tab")
        assert dialog.evaluate("panel => panel.contains(document.activeElement)")
    page.keyboard.press("Escape")
    expect(more).to_be_focused()
    assert page.evaluate("String(getSelection())") == SELECTION


# Stub only the external services. Menus, tabs, clipboard, DOM ranges, local
# storage, the notes database, renderers and all reader controllers are real.
MODEL_AND_VOICE = """
window.readerProbe = { requests: [], spoken: [] };
window.specdown = {
    explainAvailable: async () => ({ available: true }),
    askExplain: async request => {
        readerProbe.requests.push(request);
        const retry = request.excerpts.find(e => e.text.includes('retries twice'));
        if (/permission/.test(request.question)) {
            const denial = request.excerpts.find(e => e.text.includes('denied'));
            return denial
                ? { text: 'A permission error ends the request immediately.', sourceIds: [denial.id] }
                : { text: 'The passage does not cover permission errors.', sourceIds: [] };
        }
        return {
            text: 'After a timeout, the client makes two more attempts.',
            sourceIds: [(retry ?? request.excerpts[0]).id]
        };
    }
};
window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
Object.defineProperty(window, 'speechSynthesis', { value: Object.assign(new EventTarget(), {
    getVoices: () => [{ name: 'Test voice', localService: true, lang: 'en-US', default: true }],
    speak(utterance) { readerProbe.spoken.push(utterance); queueMicrotask(() => utterance.onstart?.()); },
    cancel() {}
}) });
"""


def assert_width(rail, expected):
    rail.page.wait_for_function(
        "width => Math.abs(document.querySelector('.sd-rail').getBoundingClientRect().width - width) <= 1",
        arg=expected, timeout=5000,
    )


def check_resize(page, rail):
    handle = rail.get_by_role("separator")
    assert_width(rail, 360)
    handle.focus()
    handle.press("End")
    assert_width(rail, 480)
    handle.press("Home")
    assert_width(rail, 320)
    handle.press("ArrowLeft")
    assert_width(rail, 336)
    box = handle.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + 35
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 64, y, steps=4)
    page.mouse.up()
    assert_width(rail, 400)
    assert abs(float(page.evaluate("localStorage.getItem('specdown.railWidth')")) - 400) <= 1
    close_rail(page)
    choose(page, "Explain…")
    assert_width(rail, 400)
    handle.dblclick()
    assert_width(rail, 360)


def save_note(page):
    page.locator("#annotation-toggle[data-annotation-identity]").click()
    # Attach the note to a different paragraph so the retry selection crosses
    # the same original text nodes before and after creating the annotation.
    page.locator("#markdown-content p").nth(1).dblclick()
    editor = page.locator("#annotation-editor-backdrop")
    editor.locator("textarea").fill("Confirm the permission error response.")
    editor.get_by_role("button", name="Save", exact=True).click()
    expect(editor).to_be_hidden()
    page.locator("#annotation-toggle").click()


def ask(page, question):
    composer = page.get_by_role("textbox", name=re.compile("Ask a follow-up"))
    composer.fill(question)
    page.get_by_role("button", name="Send", exact=True).click()
    expect(composer).to_be_focused()


def capture(page, folder, name):
    if folder:
        folder.mkdir(parents=True, exist_ok=True)
        expect(page.locator(".toast:visible")).to_have_count(0, timeout=15000)
        page.screenshot(path=folder / name, animations="disabled")


def check_model_and_voice(browser, url, screenshots):
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        permissions=["clipboard-read", "clipboard-write"],
        reduced_motion="reduce",
    )
    try:
        context.add_init_script(MODEL_AND_VOICE)
        page = context.new_page()
        page.goto(url)
        load_fixture(page)
        save_note(page)
        select_retry_requirement(page)
        page.keyboard.press("Control+Alt+r")
        transport = page.locator(".sd-transport")
        expect(transport).to_be_visible()
        assert page.evaluate("readerProbe.spoken.at(-1).text") == SELECTION
        page.keyboard.press("Control+Alt+e")
        rail = page.locator(".sd-rail")
        answer = "After a timeout, the client makes two more attempts."
        expect(rail.locator(".sd-cite").first).to_be_visible()
        check_resize(page, rail)
        doc = page.locator("#markdown-content").bounding_box()
        pane = rail.bounding_box()
        bar = transport.bounding_box()
        assert doc["x"] + doc["width"] <= pane["x"] + 1
        assert doc["width"] >= 480
        assert abs((bar["x"] + bar["width"] / 2) - (doc["x"] + doc["width"] / 2)) <= 2
        assert doc["y"] + doc["height"] / 2 < bar["y"] < doc["y"] + doc["height"]
        assert page.evaluate("String([...CSS.highlights.get('explain-scope')][0])") == SELECTION
        assert page.evaluate("String([...CSS.highlights.get('read-aloud-sentence')][0])") == SELECTION
        editor = rail.get_by_role("textbox", name=re.compile("Ask a follow-up"))
        editor.fill("Does that also apply to a permission error?")
        tabs = rail.get_by_role("tablist")
        explain = tabs.get_by_role("tab", name="Explain")
        notes = tabs.get_by_role("tab", name=re.compile("^Notes"))
        explain.focus()
        explain.press("ArrowRight")
        expect(notes).to_have_attribute("aria-selected", "true")
        expect(rail.get_by_text("Confirm the permission error response.", exact=True)).to_be_visible()
        expect(notes).to_contain_text("1")
        notes.press("ArrowLeft")
        expect(editor).to_have_value("Does that also apply to a permission error?")
        expect(rail.locator(".sd-cite")).to_have_count(1)
        rail.get_by_role("button", name="Copy", exact=True).click()
        assert page.evaluate("navigator.clipboard.readText()") == answer
        rail.get_by_role("button", name=re.compile("^Sources")).click()
        expect(rail.locator(".sd-source").first).to_contain_text(SELECTION)
        rail.locator(".sd-source").first.click()
        assert page.evaluate("String(getSelection())") == SELECTION
        expect(page.locator(".citation-reveal").first).to_be_visible()
        rail.get_by_role("button", name=re.compile("^Sources")).click()

        ask(page, "Does that also apply to a permission error?")
        section = rail.get_by_role("button", name=re.compile("^Use section"))
        expect(section).to_be_visible()
        assert len(page.evaluate("readerProbe.requests")) == 2
        # The unresolved question must not silently broaden the model request.
        assert page.evaluate("readerProbe.requests.at(-1).excerpts.map(e => e.text)") == [SELECTION]
        capture(page, screenshots, "desktop-explain-simulated.png")

        page.set_viewport_size({"width": 700, "height": 844})
        expect(rail.get_by_role("separator")).to_be_visible()
        assert page.locator("#markdown-content").bounding_box()["width"] >= 479
        page.set_viewport_size({"width": 390, "height": 844})
        assert_width(rail, 390)
        expect(rail.get_by_role("separator")).to_be_hidden()
        expect(transport).to_be_hidden()
        chip = rail.locator(".sd-rail-playback-chip")
        expect(chip).to_contain_text("Reading")
        chip.click()
        expect(chip).to_contain_text("Paused")
        chip.click()
        expect(chip).to_contain_text("Reading")
        capture(page, screenshots, "compact-explain-simulated.png")
        rail.locator(".sd-cite").first.click()
        expect(rail).to_be_hidden()
        assert page.evaluate("String(getSelection())") == SELECTION
        page.get_by_role("button", name=re.compile("Back to answer")).click()
        expect(chip).to_be_visible()
        rail.get_by_role("button", name="Listen", exact=True).first.click()
        page.evaluate("readerProbe.spoken.at(-1).onend()")
        expect(chip).to_contain_text("Resume document")
        chip.click()
        expect(chip).to_contain_text("Reading")

        section.click()
        expect(rail.locator(".sd-thread-divider").last).to_contain_text("Section")
        ask(page, "What about a permission error?")
        whole = rail.get_by_role("button", name=re.compile("^Use whole document", re.I))
        whole.click()
        expect(rail.locator(".sd-thread-divider").last).to_contain_text(re.compile("document", re.I))
        assert any("denied" in text for text in page.evaluate(
            "readerProbe.requests.at(-1).excerpts.map(e => e.text)"
        ))
        close_rail(page)
        expect(transport).to_be_visible()
        assert not page.evaluate("CSS.highlights.has('explain-scope')")
        transport.get_by_role("button", name="Stop", exact=True).focus()
        page.keyboard.press("Escape")
        expect(transport).to_be_hidden()
    finally:
        context.close()


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
    parser.add_argument("--screenshots-dir", type=Path)
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
                    check_model_and_voice(browser, url, options.screenshots_dir)
        finally:
            server.shutdown()
    print("Reader browser checks passed")


if __name__ == "__main__":
    main()
