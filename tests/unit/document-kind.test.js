/**
 * Session 01: document kind detection and capability table.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('htmlDetectKind', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('maps markdown extensions (case-insensitive)', () => {
    expect(htmlDetectKind('spec.md')).toBe('markdown');
    expect(htmlDetectKind('SPEC.MD')).toBe('markdown');
    expect(htmlDetectKind('notes.markdown')).toBe('markdown');
    expect(htmlDetectKind('Notes.MARKDOWN')).toBe('markdown');
  });

  it('maps html extensions (case-insensitive)', () => {
    expect(htmlDetectKind('page.html')).toBe('html');
    expect(htmlDetectKind('PAGE.HTML')).toBe('html');
    expect(htmlDetectKind('index.htm')).toBe('html');
    expect(htmlDetectKind('Index.HTM')).toBe('html');
  });

  it('returns null for unknown extensions and does not sniff content', () => {
    expect(htmlDetectKind('notes.txt')).toBeNull();
    expect(htmlDetectKind('README')).toBeNull();
    expect(htmlDetectKind('file.md.bak')).toBeNull();
    expect(htmlDetectKind('<!DOCTYPE html>')).toBeNull();
  });
});

describe('htmlDocumentCapabilities', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('hides Session 02+ chrome on HTML', () => {
    const html = htmlDocumentCapabilities('html');
    expect(html.preview).toBe(true);
    expect(html.raw).toBe(true);
    expect(html.split).toBe(true);
    expect(html.liveReload).toBe(true);
    expect(html.fileInfo).toBe(true);
    expect(html.toc).toBe(false);
    expect(html.find).toBe(false);
    expect(html.print).toBe(false);
    expect(html.present).toBe(false);
    expect(html.annotate).toBe(false);
    expect(html.authoredComments).toBe(false);
  });

  it('keeps markdown capabilities on', () => {
    const md = htmlDocumentCapabilities('markdown');
    expect(md.toc).toBe(true);
    expect(md.find).toBe(true);
    expect(md.print).toBe(true);
    expect(md.present).toBe(true);
    expect(md.annotate).toBe(true);
  });
});

describe('htmlIsOpenableFilename flag gate', () => {
  afterEach(() => {
    delete global.__HTML_DOCUMENTS_ENABLED__;
    delete process.env.VITE_HTML_DOCUMENTS;
  });

  it('rejects .html when the flag is off', () => {
    loadHTML(document);
    loadApp(document);
    expect(htmlIsOpenableFilename('page.html')).toBe(false);
    expect(htmlIsOpenableFilename('notes.md')).toBe(true);
  });

  it('accepts .html when the flag is on', () => {
    global.__HTML_DOCUMENTS_ENABLED__ = true;
    loadHTML(document);
    loadApp(document);
    expect(htmlIsOpenableFilename('page.html')).toBe(true);
    expect(htmlIsOpenableFilename('page.htm')).toBe(true);
    expect(htmlIsOpenableFilename('notes.txt')).toBe(false);
  });
});
