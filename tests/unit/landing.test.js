/**
 * Unit tests for the web-only empty-state showcase (landing.js).
 */

const fs = require('fs');
const path = require('path');
const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const root = path.join(__dirname, '../../markdown-viewer');

describe('Web landing showcase', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('keeps hero, diagram, and pillars outside the dashed drop card', () => {
    const card = document.querySelector('.drop-zone-content');
    expect(card.querySelector('#landing-hero')).toBeNull();
    expect(card.querySelector('#landing-diagram-host')).toBeNull();
    expect(card.querySelector('#landing-pillars')).toBeNull();
    expect(card.querySelector('#landing-desktop')).toBeNull();
    expect(document.querySelector('#drop-zone > #landing-hero').hidden).toBe(
      false
    );
  });

  it('enables the showcase empty state on the web surface', () => {
    const dropZone = document.getElementById('drop-zone');
    expect(dropZone.classList.contains('web-showcase')).toBe(true);
    expect(document.getElementById('landing-hero').hidden).toBe(false);
    expect(document.getElementById('web-sample-section').hidden).toBe(false);
    expect(document.getElementById('landing-diagram-host').hidden).toBe(false);
    expect(document.getElementById('landing-pillars').hidden).toBe(false);
    expect(document.getElementById('landing-desktop').hidden).toBe(false);
    expect(isWebLandingSurface()).toBe(true);
  });

  it('mounts a decorative space canvas on the web showcase', () => {
    const canvas = document.getElementById('landing-space-canvas');
    const cursor = document.getElementById('landing-cursor-core');
    expect(canvas).not.toBeNull();
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(cursor).not.toBeNull();
    expect(cursor.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps browse, URL, and drop-zone controls available', () => {
    expect(document.getElementById('browse-button')).not.toBeNull();
    expect(document.getElementById('url-input')).not.toBeNull();
    expect(document.getElementById('file-input')).not.toBeNull();
    expect(
      document
        .getElementById('landing-desktop')
        .querySelector('a.landing-download').href
    ).toContain('github.com/cbremer/specdown/releases');
  });

  it('does not pull in Mermaid on init when the host has no layout box', () => {
    mermaid.render.mockClear();
    document.body.innerHTML = '';
    loadHTML(document);
    loadApp(document);
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(
      document.querySelector('#landing-diagram .diagram-container')
    ).toBeNull();
  });

  it('renders a standalone landing diagram when forced', async () => {
    mermaid.render.mockClear();
    await renderLandingMermaidDiagram(true);
    expect(mermaid.render).toHaveBeenCalled();
    expect(
      document.querySelector('#landing-diagram .diagram-container')
    ).not.toBeNull();
  });

  it('opens the bundled diagram showcase via fetch on web', async () => {
    const markdown = '# Diagram showcase\n';
    global.fetch.mockImplementation((url) => {
      if (String(url).includes('diagram-showcase.md')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(markdown),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const button = document.getElementById('open-web-showcase');
    button.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('samples/diagram-showcase.md'),
      expect.objectContaining({ credentials: 'omit' })
    );
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].filename).toBe('diagram-showcase.md');
    expect(state.tabs[0].rawMarkdown).toBe(markdown);
  });

  it('rejects unknown sample names', async () => {
    global.fetch.mockClear();
    await openLandingBundledSample('../secret.md');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('toasts when the sample fetch fails', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });
    await openLandingBundledSample('diagram-showcase.md');
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Could not load the sample document.');
  });
});

describe('Web landing click-to-browse', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('still opens the file picker from the drop card heading', () => {
    const fileInput = document.getElementById('file-input');
    fileInput.click = jest.fn();
    const heading = document.querySelector('.drop-zone-content h2');
    heading.dispatchEvent(new Event('click', { bubbles: true }));
    expect(fileInput.click).toHaveBeenCalledTimes(1);
  });

  it('does not open the file picker from the hero, pillars, or download link', () => {
    const fileInput = document.getElementById('file-input');
    fileInput.click = jest.fn();

    document
      .querySelector('.landing-title')
      .dispatchEvent(new Event('click', { bubbles: true }));
    document
      .querySelector('.landing-pillar')
      .dispatchEvent(new Event('click', { bubbles: true }));
    document
      .querySelector('.landing-download')
      .dispatchEvent(new Event('click', { bubbles: true }));
    document
      .getElementById('open-web-showcase')
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(fileInput.click).not.toHaveBeenCalled();
  });

  it('does not open the file picker from a rendered landing diagram', async () => {
    const fileInput = document.getElementById('file-input');
    fileInput.click = jest.fn();
    await renderLandingMermaidDiagram(true);
    const diagram = document.querySelector(
      '#landing-diagram .diagram-container'
    );
    expect(diagram).not.toBeNull();
    diagram.dispatchEvent(new Event('click', { bubbles: true }));
    expect(fileInput.click).not.toHaveBeenCalled();
  });
});

describe('Landing gating on native shells', () => {
  afterEach(() => {
    delete window.specdown;
    delete window.iosNative;
    delete window.webkit;
  });

  it('does not enable the showcase on desktop', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    loadHTML(document);
    loadApp(document);

    expect(isWebLandingSurface()).toBe(false);
    expect(
      document.getElementById('drop-zone').classList.contains('web-showcase')
    ).toBe(false);
    expect(document.getElementById('landing-hero').hidden).toBe(true);
    expect(document.getElementById('web-sample-section').hidden).toBe(true);
    expect(document.getElementById('landing-space-canvas')).toBeNull();
    expect(document.getElementById('landing-cursor-core')).toBeNull();
  });

  it('keeps showcase chrome outside the dashed card so native empty state stays compact', () => {
    window.specdown = { isDesktop: true, requestFileOpen: jest.fn() };
    loadHTML(document);
    loadApp(document);

    const card = document.querySelector('.drop-zone-content');
    expect(card.querySelector('#landing-hero')).toBeNull();
    expect(card.querySelector('#landing-pillars')).toBeNull();
    expect(card.querySelector('#landing-diagram-host')).toBeNull();
    expect(card.querySelector('#landing-desktop')).toBeNull();
    expect(card.querySelector('h2').textContent).toBe(
      'Drop Markdown File Here'
    );
    expect(document.querySelector('#drop-zone > #landing-hero')).not.toBeNull();
  });

  it('does not enable the showcase on iOS and still uses the native sample bridge', () => {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: {
        specdown: { postMessage: jest.fn() },
      },
    };
    loadHTML(document);
    loadApp(document);

    expect(isWebLandingSurface()).toBe(false);
    expect(
      document.getElementById('drop-zone').classList.contains('web-showcase')
    ).toBe(false);
    expect(document.getElementById('landing-hero').hidden).toBe(true);

    document
      .getElementById('open-sample-mermaid')
      .dispatchEvent(new Event('click', { bubbles: true }));
    expect(
      window.webkit.messageHandlers.specdown.postMessage
    ).toHaveBeenCalledWith({
      action: 'openBundledSample',
      data: { name: 'diagram-showcase.md' },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('Web showcase CSS isolation', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

  it('scopes landing cosmetics to .web-showcase so native empty states stay compact', () => {
    const unscoped = css.match(/(?:^|\n)\.landing-[a-z-]+ \{/g) || [];
    expect(unscoped).toEqual([]);
    expect(css).toContain('.drop-zone.web-showcase .landing-title');
    expect(css).toContain('align-items: stretch');
    expect(css).not.toContain('landing-drop-core');
  });
});

describe('Open Graph social card', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  it('declares Open Graph and Twitter tags with absolute GitHub Pages URLs', () => {
    expect(html).toContain('property="og:image"');
    expect(html).toContain('https://cbremer.github.io/specdown/og-image.png');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('summary_large_image');
    expect(html).toContain('https://cbremer.github.io/specdown/');
  });

  it('ships a 1200x630 PNG social card in public/', () => {
    const pngPath = path.join(root, 'public/og-image.png');
    expect(fs.existsSync(pngPath)).toBe(true);
    const buf = fs.readFileSync(pngPath);
    expect(buf.slice(1, 4).toString('ascii')).toBe('PNG');
    // IHDR width/height are 4-byte big-endian integers at offsets 16 and 20.
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
  });
});
