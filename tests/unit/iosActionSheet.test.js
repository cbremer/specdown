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
