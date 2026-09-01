/**
 * Session 00 staging-rail tests: compile-time HTML-documents flag and
 * the flag-off product surface (gates, CSP source, DOM). Do not invert
 * the existing .html rejection tests — those stay the product.
 */

const fs = require('fs');
const path = require('path');

const { loadHTML, loadApp } = require('../helpers/loadApp');

const repoRoot = path.join(__dirname, '../..');
const viewerRoot = path.join(repoRoot, 'markdown-viewer');

describe('htmlDocumentsEnabled', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    delete global.__HTML_DOCUMENTS_ENABLED__;
    delete process.env.VITE_HTML_DOCUMENTS;
  });

  it('is off by default', () => {
    expect(htmlDocumentsEnabled()).toBe(false);
  });

  it('is on when the compiled flag is stubbed', () => {
    global.__HTML_DOCUMENTS_ENABLED__ = true;
    expect(htmlDocumentsEnabled()).toBe(true);
  });

  it('is on when VITE_HTML_DOCUMENTS is the string true', () => {
    process.env.VITE_HTML_DOCUMENTS = 'true';
    expect(htmlDocumentsEnabled()).toBe(true);
  });

  it('stays off for any other env value', () => {
    process.env.VITE_HTML_DOCUMENTS = '1';
    expect(htmlDocumentsEnabled()).toBe(false);
    process.env.VITE_HTML_DOCUMENTS = 'false';
    expect(htmlDocumentsEnabled()).toBe(false);
  });
});

describe('html-flag.js source', () => {
  it('does not read import.meta in executable code', () => {
    const src = fs.readFileSync(
      path.join(viewerRoot, 'src/core/html-flag.js'),
      'utf8'
    );
    const executable = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(executable).not.toMatch(/import\.meta/);
  });
});

describe('flag-off product surface', () => {
  const indexHtml = fs.readFileSync(
    path.join(viewerRoot, 'index.html'),
    'utf8'
  );

  it('file-input accept has no html', () => {
    const inputMatch = indexHtml.match(
      /<input[^>]*id="file-input"[^>]*>|<input[^>]*accept="[^"]*"[^>]*id="file-input"[^>]*>/
    );
    expect(inputMatch).not.toBeNull();
    const acceptMatch = inputMatch[0].match(/accept="([^"]*)"/);
    expect(acceptMatch).not.toBeNull();
    expect(acceptMatch[1].toLowerCase()).not.toMatch(/html/);
    expect(acceptMatch[1]).toBe('.md,.markdown');
  });

  it('source CSP has no frame-src', () => {
    const cspMatch = indexHtml.match(
      /http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/
    );
    expect(cspMatch).not.toBeNull();
    expect(cspMatch[1]).not.toMatch(/frame-src/i);
    // The meta tag is the source of truth (not the loadApp DOM).
    expect(indexHtml).toMatch(/Content-Security-Policy/);
  });

  it('index.html has no html-frame or document-stage', () => {
    expect(indexHtml).not.toMatch(/html-frame/);
    expect(indexHtml).not.toMatch(/document-stage/);
  });

  it('loaded document body has no html-frame or document-stage', () => {
    loadHTML(document);
    expect(document.getElementById('html-frame')).toBeNull();
    expect(document.getElementById('document-stage')).toBeNull();
    expect(document.querySelector('#html-frame, #document-stage')).toBeNull();
  });

  it('file-loading still rejects .html and .htm', () => {
    loadHTML(document);
    loadApp(document);

    const htmlFile = new File(['<p>no</p>'], 'note.html', {
      type: 'text/html',
    });
    handleFile(htmlFile);
    const htmlToast = document.querySelector('.toast');
    expect(htmlToast).not.toBeNull();
    expect(htmlToast.textContent).toBe(
      'Please select a valid Markdown file (.md or .markdown)'
    );

    htmlToast.remove();
    const htmFile = new File(['<p>no</p>'], 'note.htm', { type: 'text/html' });
    handleFile(htmFile);
    const htmToast = document.querySelector('.toast');
    expect(htmToast).not.toBeNull();
    expect(htmToast.textContent).toBe(
      'Please select a valid Markdown file (.md or .markdown)'
    );
  });
});

describe('default scripts stay flag-off', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );

  it('dev / build / desktop do not set VITE_HTML_DOCUMENTS', () => {
    expect(pkg.scripts.dev).toBe('vite');
    expect(pkg.scripts.build).toBe('vite build && node scripts/copy-static.js');
    expect(pkg.scripts.desktop).toBe('npm run build && electron .');
    expect(pkg.scripts.dev).not.toMatch(/html|VITE_HTML/);
    expect(pkg.scripts.build).not.toMatch(/html|VITE_HTML/);
    expect(pkg.scripts.desktop).not.toMatch(/html|VITE_HTML/);
  });

  it('desktop:html sets the env via a Node wrapper', () => {
    expect(pkg.scripts['desktop:html']).toBe(
      'npm run build:html && node scripts/desktop-html.js'
    );
    const wrapper = fs.readFileSync(
      path.join(repoRoot, 'scripts/desktop-html.js'),
      'utf8'
    );
    expect(wrapper).toMatch(/VITE_HTML_DOCUMENTS = 'true'/);
    expect(wrapper).toMatch(/require\('electron'\)/);
  });

  it('fileAssociations stay markdown-only', () => {
    const exts = pkg.build.fileAssociations.flatMap((a) => a.ext);
    expect(exts).toEqual(['md', 'markdown']);
    expect(exts.join(',')).not.toMatch(/html/i);
  });
});

describe('production ship workflows stay off the html branch', () => {
  function workflowOnBlock(relPath) {
    const src = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
    const match = src.match(/^on:[\s\S]*?\njobs:/m);
    return match ? match[0] : src;
  }

  it('version-bump.yml only targets main', () => {
    const onBlock = workflowOnBlock('.github/workflows/version-bump.yml');
    expect(onBlock).toMatch(/branches:\s*\[main\]/);
    expect(onBlock).not.toMatch(/\bhtml\b/);
  });

  it('static.yml does not ship Pages from html', () => {
    const onBlock = workflowOnBlock('.github/workflows/static.yml');
    expect(onBlock).toMatch(/workflow_dispatch/);
    expect(onBlock).not.toMatch(/\bhtml\b/);
  });

  it('desktop.yml only ships from v* tags or dispatch', () => {
    const onBlock = workflowOnBlock('.github/workflows/desktop.yml');
    expect(onBlock).toMatch(/workflow_dispatch/);
    expect(onBlock).toMatch(/'v\*'/);
    expect(onBlock).not.toMatch(/\bhtml\b/);
  });
});
