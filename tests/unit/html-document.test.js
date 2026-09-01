/**
 * Session 01: HTML rewrite, preview host, stage iframe, and HTML-on open.
 */

const fs = require('fs');
const path = require('path');
const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const repoRoot = path.join(__dirname, '../..');
const viewerRoot = path.join(repoRoot, 'markdown-viewer');

function loadHtmlOn() {
  global.__HTML_DOCUMENTS_ENABLED__ = true;
  process.env.VITE_HTML_DOCUMENTS = 'true';
  loadHTML(document);
  loadApp(document);
}

describe('htmlRewriteDocument', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('injects a CSP meta and re-emits doctype', () => {
    const out = htmlRewriteDocument('<p>hi</p>');
    expect(out).toMatch(/^<!DOCTYPE html>/i);
    expect(out).toMatch(/http-equiv="Content-Security-Policy"/i);
    expect(out).toContain(htmlPreviewDocumentCsp);
  });

  it('strips nested frames, refresh, author CSP, and base', () => {
    const raw = `
      <html>
        <head>
          <meta http-equiv="content-security-policy" content="script-src *">
          <meta http-equiv="refresh" content="0;url=https://evil.example">
          <meta http-equiv="set-cookie" content="a=b">
          <base href="https://evil.example/" target="_blank">
        </head>
        <body>
          <iframe src="https://evil.example"></iframe>
          <object data="x"></object>
          <embed src="x">
        </body>
      </html>`;
    const out = htmlRewriteDocument(raw);
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/<object/i);
    expect(out).not.toMatch(/<embed/i);
    expect(out).not.toMatch(/http-equiv="refresh"/i);
    expect(out).not.toMatch(/set-cookie/i);
    expect(out).not.toMatch(/<base/i);
    expect(out).not.toMatch(/script-src \*/);
  });

  it('neutralizes javascript, data, and protocol-relative hrefs', () => {
    const out = htmlRewriteDocument(
      '<a href="javascript:alert(1)">x</a>' +
        '<a href="data:text/html,hi">y</a>' +
        '<a href="//evil.example">z</a>' +
        '<a href="#keep">k</a>'
    );
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/data:text\/html/i);
    expect(out).not.toMatch(/href="\/\//);
    expect(out).toMatch(/href="#keep"/);
  });

  it('rewrites relative URLs to # unless a baseHref is injected', () => {
    const out = htmlRewriteDocument(
      '<a href="./page.html">a</a>' +
        '<a href="../up.html">b</a>' +
        '<img src="/abs.png">' +
        '<a href="style.css">s</a>' +
        '<a href="https://example.com/ok">c</a>' +
        '<a href="#keep">k</a>'
    );
    expect(out).not.toMatch(/\.\//);
    expect(out).not.toMatch(/\.\.\//);
    expect(out).not.toMatch(/src="\/abs\.png"/);
    expect(out).not.toMatch(/href="style\.css"/);
    expect(out).toMatch(/href="https:\/\/example.com\/ok"/);
    expect(out).toMatch(/href="#keep"/);

    const withBase = htmlRewriteDocument(
      '<a href="./page.html">a</a>' +
        '<img src="../x.png">' +
        '<a href="javascript:alert(1)">x</a>',
      { baseHref: 'https://cdn.example/docs/' }
    );
    expect(withBase).toMatch(/<base /i);
    expect(withBase).toMatch(/href="\.\/page\.html"/);
    expect(withBase).toMatch(/src="\.\.\/x\.png"/);
    expect(withBase).not.toMatch(/javascript:/i);
  });
});

describe('preview host + stage iframe', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('stage iframe allows scripts but not same-origin', () => {
    const frame = document.getElementById('html-frame');
    expect(frame).not.toBeNull();
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toMatch(/allow-same-origin/);
    expect(frame.getAttribute('allow')).toBe('');
    const md = document.getElementById('markdown-content');
    expect(frame.parentElement).toBe(md.parentElement);
    expect(md.contains(frame)).toBe(false);
  });

  it('preview host is a real page with its own CSP, not blob/srcdoc', () => {
    const host = fs.readFileSync(
      path.join(viewerRoot, 'html-preview-host.html'),
      'utf8'
    );
    expect(host).toMatch(/Content-Security-Policy/);
    expect(host).toMatch(/script-src 'self'/);
    expect(host).toMatch(/html-preview-host\.js/);
    expect(host).not.toMatch(/content="[^"]*blob:/);
    expect(htmlPreviewHostHref()).toMatch(/html-preview-host\.html/);
    expect(htmlHostInlineSource).toContain('specdown-load');
    expect(htmlHostInlineSource).toContain('event.source !== window.parent');
    const boot = fs.readFileSync(
      path.join(viewerRoot, 'html-preview-host.js'),
      'utf8'
    );
    expect(boot.replace(/\s+/g, '')).toBe(
      htmlHostInlineSource.replace(/\s+/g, '')
    );
  });
});

describe('HTML-on open and render', () => {
  afterEach(() => {
    delete global.__HTML_DOCUMENTS_ENABLED__;
    delete process.env.VITE_HTML_DOCUMENTS;
  });

  beforeEach(() => {
    loadHtmlOn();
  });

  it('creates kind: html and does not call marked.parse', () => {
    const spy = jest.spyOn(marked, 'parse');
    createTab('page.html', '<h1>Hello HTML</h1>');
    const tab = state.tabs[state.tabs.length - 1];
    expect(tab.kind).toBe('html');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    const frame = document.getElementById('html-frame');
    expect(frame.hidden).toBe(false);
    expect(frame.getAttribute('src')).toMatch(/html-preview-host\.html/);
    expect(frame.getAttribute('src')).toMatch(/specdown-host=/);
    expect(frame.getAttribute('src')).not.toMatch(/^blob:/);
    expect(frame.getAttribute('src')).not.toBe('about:blank');
    expect(frame.getAttribute('title')).toBe('page.html');
    expect(document.getElementById('markdown-content').innerHTML).toBe('');
  });

  it('handleFile accepts HTML and rejects oversize HTML only', () => {
    const ok = new File(['<p>ok</p>'], 'note.html', { type: 'text/html' });
    handleFile(ok);
    expect(document.querySelector('.toast')).toBeNull();

    const big = new File([new Uint8Array(htmlMaxBytes + 1)], 'big.html', {
      type: 'text/html',
    });
    Object.defineProperty(big, 'size', { value: htmlMaxBytes + 1 });
    handleFile(big);
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toMatch(/8 MB/);

    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const md = new File(['# hi'], 'big.md', { type: 'text/markdown' });
    Object.defineProperty(md, 'size', { value: htmlMaxBytes + 1 });
    handleFile(md);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('handleUrl on an extensionless URL stays markdown', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => '# from url',
    });
    await handleUrl('https://example.com/');
    const tab = state.tabs[state.tabs.length - 1];
    expect(tab.kind).toBe('markdown');
    expect(tab.filename).toBe('untitled.md');
  });

  it('hides Print/Find/TOC on an HTML tab', () => {
    createTab('page.html', '<p>x</p>');
    expect(document.getElementById('print-button').style.display).toBe('none');
    expect(document.getElementById('search-button').style.display).toBe('none');
    expect(document.getElementById('toc-toggle').style.display).toBe('none');
    expect(htmlActiveCapabilities().print).toBe(false);
  });

  it('does not postMessage specdown-load into about:blank', () => {
    createTab('page.html', '<p>payload</p>');
    const frame = document.getElementById('html-frame');
    frame.removeAttribute('src');
    const blankWindow = frame.contentWindow;
    const blankSpy = blankWindow
      ? jest.spyOn(blankWindow, 'postMessage')
      : null;
    frame.dispatchEvent(new Event('load'));
    if (blankSpy) expect(blankSpy).not.toHaveBeenCalled();
    if (blankSpy) blankSpy.mockRestore();

    frame.setAttribute('src', htmlPreviewHostHref() + '?specdown-host=1');
    const hostSpy = jest.spyOn(frame.contentWindow, 'postMessage');
    frame.dispatchEvent(new Event('load'));
    expect(hostSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'specdown-load',
        html: expect.stringContaining('payload'),
      }),
      '*'
    );
    hostSpy.mockRestore();
  });
});

describe('HTML-on parent CSP transform', () => {
  const {
    htmlInjectParentFrameSrc,
    htmlInjectFileAccept,
  } = require('../../scripts/html-build-transform.js');

  const source = fs.readFileSync(path.join(viewerRoot, 'index.html'), 'utf8');

  it('adds frame-src self/file/specdown and does not loosen script-src', () => {
    const out = htmlInjectParentFrameSrc(source);
    const csp = out.match(
      /http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/
    )[1];
    expect(csp).toMatch(/frame-src 'self' file: specdown:/);
    expect(csp).not.toMatch(/frame-src[^;]*blob:/);
    expect(csp).not.toMatch(/script-src[^;]*blob:/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(source).not.toMatch(/frame-src/i);
  });

  it('widens accept on HTML-on builds only', () => {
    expect(source).toMatch(/accept="\.md,\.markdown"/);
    const out = htmlInjectFileAccept(source);
    expect(out).toMatch(/accept="\.md,\.markdown,\.html,\.htm"/);
  });
});
