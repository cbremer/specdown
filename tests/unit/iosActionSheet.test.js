/**
 * The iOS "Viewer Actions" sheet: Find entry and scrollable action list.
 */

const fs = require('fs');
const path = require('path');
const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('iOS action sheet', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('offers Find in Document, which opens the search bar', () => {
    const find = document.getElementById('ios-find-button');
    expect(find).not.toBeNull();
    expect(find.textContent).toBe('Find in Document');

    find.click();

    expect(document.getElementById('search-bar').style.display).toBe('flex');
  });

  it('lets the action list scroll inside a capped sheet', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '../../markdown-viewer/styles.css'),
      'utf8'
    );
    const actions = css.match(/\.ios-sheet-actions\s*\{[^}]*\}/)[0];
    expect(actions).toMatch(/overflow-y:\s*auto/);
    expect(actions).toMatch(/min-height:\s*0/);
    const sheet = css.match(/\.ios-sheet\s*\{[^}]*\}/)[0];
    expect(sheet).toMatch(/100dvh/);
  });
});

describe('iOS 1.0 hides features planned for 1.1', () => {
  beforeEach(() => {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadHTML(document);
    loadApp(document);
  });
  afterEach(() => {
    delete window.iosNative;
    delete window.webkit;
  });

  it('keeps annotations disabled and routes Recent Files to native bookmarks', () => {
    for (const id of [
      'annotation-toggle',
      'annotation-list-toggle',
      'ios-annotations-button',
    ]) {
      expect(document.getElementById(id)).toBeNull();
    }
    expect(document.getElementById('open-recent-button').hidden).toBe(false);
    document.getElementById('open-recent-button').click();
    expect(window.webkit.messageHandlers.specdown.postMessage).toHaveBeenCalledWith({action: 'showRecentFiles'});

    document.getElementById('header-more-toggle').click();
    expect(document.activeElement.id).toBe('open-recent-button');
  });
});

describe('web keeps annotations and recents', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('leaves the controls in place', () => {
    expect(document.getElementById('annotation-toggle')).not.toBeNull();
    expect(document.getElementById('open-recent-button').hidden).toBe(false);
  });
});

describe('iOS 1.0 reviewer-facing fixes', () => {
  beforeEach(() => {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadHTML(document);
    loadApp(document);
  });
  afterEach(() => {
    delete window.iosNative;
    delete window.webkit;
  });

  it('uses touch wording on the start screen', () => {
    expect(document.querySelector('.drop-zone-content h2').textContent).toBe(
      'Open a Markdown File'
    );
    expect(
      document.querySelector('.drop-zone-content > p').textContent
    ).toMatch(/^Tap Open File/);
  });

  it('shows native file errors as a toast', () => {
    window.specdownShowError('notes.md couldn’t be opened.');
    const toast = document.querySelector('#toast-region .toast');
    expect(toast.textContent).toContain('couldn’t be opened');
  });

  it('keeps diagram download controls hidden on iOS', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '../../markdown-viewer/styles.css'),
      'utf8'
    );
    expect(css).toMatch(
      /\.ios-native \.fullscreen-controls \.export-svg,\s*\.ios-native \.fullscreen-controls \.export-png\s*\{\s*display: none;/
    );
  });
});

describe('document styles', () => {
  it('forbids <style> blocks when sanitizing rendered Markdown', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '../../markdown-viewer/src/core/document-sanitizer.js'
      ),
      'utf8'
    );
    expect(src).toMatch(/FORBID_TAGS:\s*\[\s*'style'/);
  });
});

describe('iOS text fields', () => {
  it('are at least 16px so focusing them never auto-zooms the page', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '../../markdown-viewer/styles.css'),
      'utf8'
    );
    const rule = css.match(
      /\.ios-native input:not\(\[type="checkbox"\]\)[^{]*\.ios-native textarea,\s*\.ios-native select\s*\{([^}]*)\}/
    );
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/font-size:\s*16px/);
  });
});
