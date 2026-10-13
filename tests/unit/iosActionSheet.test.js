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

  it('removes annotation controls and hides Open Recent, keeping About reachable', () => {
    for (const id of [
      'annotation-toggle',
      'annotation-list-toggle',
      'ios-annotations-button',
    ]) {
      expect(document.getElementById(id)).toBeNull();
    }
    expect(document.getElementById('open-recent-button').hidden).toBe(true);

    document.getElementById('header-more-toggle').click();
    expect(document.activeElement.id).toBe('about-button');
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
