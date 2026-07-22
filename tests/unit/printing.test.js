/**
 * Unit tests for the hardened print / PDF pipeline.
 *
 * Every surface prints the standalone document from buildPrintableDocument()
 * rather than the live viewport-fixed app layout (the root cause of "I only
 * get the screen I'm on" prints). These tests cover the builder (full content,
 * chrome stripping, dark-theme diagram re-render, title escaping), the web
 * hidden-iframe print path, and the desktop bridge print/export routing.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
const mermaidMock = require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

// Simulate an open document: visible content area, a filename, and rendered
// markdown spanning several "screens" including a diagram (controls + wrapper,
// faithful to the production DOM), a code block with copy button, and
// annotation chrome — everything the printable document must keep or strip.
function loadPrintFixture() {
  const contentArea = document.getElementById('content-area');
  contentArea.style.display = 'flex';
  state.currentRawMarkdown = '# Print me';
  const fileNameEl = document.getElementById('file-name');
  fileNameEl.textContent = 'spec.md';

  const content = document.getElementById('markdown-content');
  content.innerHTML = `
    <h1>First section</h1>
    <p>Intro paragraph well above the fold.</p>
    <div class="diagram-container" data-diagram-id="d0">
      <button class="diagram-expand"><svg data-icon="true"></svg></button>
      <div class="diagram-wrapper">
        <svg data-mermaid-source="graph TD; A--&gt;B" viewBox="0 0 800 600"
             style="position: absolute; width: 800px; transform: scale(2);"></svg>
      </div>
    </div>
    <pre><button class="code-copy-btn">Copy</button><code>const x = 1;</code></pre>
    <p class="has-annotation">Annotated paragraph<span class="annotation-badge">1</span></p>
    <h2>Last section far below the viewport</h2>
    <p>Tail paragraph that a viewport-clipped print would lose.</p>
  `;
}

describe('Printable document builder', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
    loadPrintFixture();
    state.currentTheme = 'light';
  });

  it('builds a standalone document containing the ENTIRE content, not one screen', async () => {
    const html = await buildPrintableDocument();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page');
    expect(html).toContain('First section');
    expect(html).toContain('Intro paragraph well above the fold.');
    expect(html).toContain('Last section far below the viewport');
    expect(html).toContain(
      'Tail paragraph that a viewport-clipped print would lose.'
    );
    expect(html).toContain('spec.md');
  });

  it('strips UI chrome: diagram expand button, copy buttons, annotation badges', async () => {
    const html = await buildPrintableDocument();
    expect(html).not.toContain('diagram-expand');
    expect(html).not.toContain('code-copy-btn');
    expect(html).not.toContain('annotation-badge');
    expect(html).not.toContain('has-annotation');
    // The code itself survives — only the button goes.
    expect(html).toContain('const x = 1;');
  });

  it('clears panzoom sizing/positioning from diagram SVGs so they fit the page', async () => {
    const html = await buildPrintableDocument();
    expect(html).not.toContain('position: absolute');
    expect(html).not.toContain('scale(2)');
    expect(html).toContain('max-width: 100%');
  });

  it('escapes the document title', async () => {
    document.getElementById('file-name').textContent =
      '<script>alert(1)</script>.md';
    const html = await buildPrintableDocument();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('re-renders diagrams with the light mermaid theme when the app is dark', async () => {
    state.currentTheme = 'dark';
    mermaidMock.render.mockClear();
    mermaidMock.initialize.mockClear();

    const html = await buildPrintableDocument();

    expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    expect(mermaidMock.render.mock.calls[0][0]).toMatch(/^print-diagram-/);
    expect(mermaidMock.render.mock.calls[0][1]).toBe('graph TD; A-->B');
    // The freshly rendered (light) SVG replaced the dark on-screen clone.
    expect(html).toContain('print-diagram-');
    // The app theme is restored and the engine re-initialized afterwards.
    expect(state.currentTheme).toBe('dark');
    expect(mermaidMock.initialize.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not touch mermaid at all for light-theme prints', async () => {
    mermaidMock.render.mockClear();
    await buildPrintableDocument();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });
});

describe('Web print path (hidden iframe)', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
    loadPrintFixture();
    state.currentTheme = 'light';
    window.print = jest.fn();
  });

  afterEach(() => {
    removeActivePrintFrame();
  });

  it('prints via a hidden iframe hosting the printable document', async () => {
    await performPrint();

    const frame = document.querySelector('iframe[aria-hidden="true"]');
    expect(frame).not.toBeNull();
    expect(frame.contentDocument.body.innerHTML).toContain('print-content');
    expect(frame.contentDocument.body.textContent).toContain(
      'Tail paragraph that a viewport-clipped print would lose.'
    );
    // The live window is never printed on the primary path.
    expect(window.print).not.toHaveBeenCalled();
  });

  it('replaces a stale frame instead of stacking one per print', async () => {
    await performPrint();
    await performPrint();
    expect(document.querySelectorAll('iframe[aria-hidden="true"]').length).toBe(
      1
    );
  });

  it('falls back to window.print() when no document is loaded', async () => {
    document.getElementById('content-area').style.display = 'none';
    state.currentRawMarkdown = '';
    await performPrint();
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(document.querySelector('iframe[aria-hidden="true"]')).toBeNull();
  });
});

describe('Desktop print + PDF export routing', () => {
  beforeEach(() => {
    localStorage.clear();
    window.specdown = {
      isDesktop: true,
      requestFileOpen: jest.fn(),
      watchFile: jest.fn(),
      unwatchFile: jest.fn(),
      onFileOpened: jest.fn(),
      onCloseTab: jest.fn(),
      onFileChanged: jest.fn(),
      onTriggerPrint: jest.fn(),
      onTriggerExportPdf: jest.fn(),
      onTriggerSearch: jest.fn(),
      onApplyCustomCss: jest.fn(),
      saveSession: jest.fn(),
      requestRefreshFile: jest.fn(),
      exportPdf: jest.fn(),
    };
    window.print = jest.fn();

    loadHTML(document);
    loadApp(document);
    loadPrintFixture();
    state.currentTheme = 'light';
  });

  afterEach(() => {
    delete window.specdown;
  });

  it('prints via the in-window hidden iframe, never an offscreen shell window', async () => {
    // Regression: printing used to be routed to a hidden BrowserWindow in the
    // main process, but on macOS the print dialog is a sheet attached to its
    // window — a hidden window shows NO dialog, so Cmd+P silently did nothing.
    // Desktop must print the printable document from inside the visible
    // window (hidden iframe), where the dialog can attach.
    await performPrint();

    const frame = document.querySelector('iframe[aria-hidden="true"]');
    expect(frame).not.toBeNull();
    expect(frame.contentDocument.body.innerHTML).toContain('print-content');
    expect(frame.contentDocument.body.textContent).toContain(
      'Tail paragraph that a viewport-clipped print would lose.'
    );
    expect(window.print).not.toHaveBeenCalled();
    removeActivePrintFrame();
  });

  it('exports the printable document as PDF over the bridge', async () => {
    await exportActivePdf();

    expect(window.specdown.exportPdf).toHaveBeenCalledTimes(1);
    const payload = window.specdown.exportPdf.mock.calls[0][0];
    expect(payload.title).toBe('spec.md');
    expect(payload.html).toContain('<!DOCTYPE html>');
    expect(payload.html).toContain('print-content');
  });

  it('does nothing on export when no document is loaded', async () => {
    document.getElementById('content-area').style.display = 'none';
    state.currentRawMarkdown = '';
    await exportActivePdf();
    expect(window.specdown.exportPdf).not.toHaveBeenCalled();
  });

  it('wires the native File > Export as PDF menu event during init', () => {
    expect(window.specdown.onTriggerExportPdf).toHaveBeenCalledTimes(1);
    expect(typeof window.specdown.onTriggerExportPdf.mock.calls[0][0]).toBe(
      'function'
    );
  });
});
