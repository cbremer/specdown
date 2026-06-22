/**
 * Unit tests for the PWA service-worker registration guards, plus a static
 * check that the manifest is wired into index.html.
 */

const fs = require('fs');
const path = require('path');
const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('PWA service worker', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    // Remove any serviceWorker mock so other suites see jsdom's default.
    if (Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')) {
      try {
        delete navigator.serviceWorker;
      } catch (e) {
        // ignore
      }
    }
  });

  it('does not register when serviceWorker is unsupported (jsdom default)', () => {
    expect('serviceWorker' in navigator).toBe(false);
    expect(shouldRegisterServiceWorker()).toBe(false);
    // And calling register is a harmless no-op.
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('registers ./sw.js when supported on http(s)', () => {
    const register = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    });

    expect(shouldRegisterServiceWorker()).toBe(true);

    registerServiceWorker();
    window.dispatchEvent(new Event('load')); // in case readyState wasn't 'complete'

    expect(register).toHaveBeenCalledWith('./sw.js');
  });
});

describe('PWA file handler (launchQueue)', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    try {
      delete window.launchQueue;
    } catch (e) {
      // ignore
    }
  });

  it('is a harmless no-op when launchQueue is unavailable', () => {
    expect('launchQueue' in window).toBe(false);
    expect(() => registerFileHandlerLaunchConsumer(jest.fn())).not.toThrow();
  });

  it('registers a consumer and forwards launched files to the callback', async () => {
    let consumer;
    window.launchQueue = { setConsumer: (fn) => { consumer = fn; } };

    const onFile = jest.fn();
    registerFileHandlerLaunchConsumer(onFile);
    expect(typeof consumer).toBe('function');

    const file = { name: 'doc.md' };
    const handle = { getFile: jest.fn(() => Promise.resolve(file)) };
    await consumer({ files: [handle] });

    expect(handle.getFile).toHaveBeenCalled();
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('ignores an empty launch with no files', async () => {
    let consumer;
    window.launchQueue = { setConsumer: (fn) => { consumer = fn; } };
    const onFile = jest.fn();
    registerFileHandlerLaunchConsumer(onFile);

    await consumer({ files: [] });
    await consumer({});

    expect(onFile).not.toHaveBeenCalled();
  });
});

describe('PWA static assets', () => {
  const root = path.join(__dirname, '../../markdown-viewer');

  it('links the manifest and a theme-color in index.html', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toMatch(/<link[^>]+rel="manifest"[^>]+href="manifest\.webmanifest"/);
    expect(html).toMatch(/<meta[^>]+name="theme-color"/);
  });

  it('ships a valid manifest with name, start_url, and icons', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8')
    );
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it('declares a file handler for .md/.markdown', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8')
    );
    expect(Array.isArray(manifest.file_handlers)).toBe(true);
    const handler = manifest.file_handlers[0];
    expect(handler.action).toBe('./');
    const exts = handler.accept['text/markdown'];
    expect(exts).toEqual(expect.arrayContaining(['.md', '.markdown']));
  });

  it('ships the service worker and icon assets', () => {
    expect(fs.existsSync(path.join(root, 'public/sw.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'public/icons/icon-512.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'public/icons/icon.svg'))).toBe(true);
  });
});
