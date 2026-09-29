/**
 * Unit tests for the header version label.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Header version label', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('shows a plain version with no release-stage suffix', () => {
    setupVersionInfo('1.2.3');
    expect(document.getElementById('version-label').textContent).toBe('v1.2.3');
  });

  it('never labels the app as alpha or beta', () => {
    setupVersionInfo('0.0.193');
    expect(document.getElementById('version-label').textContent).not.toMatch(
      /alpha|beta/i
    );
  });
});
