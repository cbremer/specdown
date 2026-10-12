/**
 * Unit tests for the About dialog, which replaced the header version label.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('About SpecDown', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    closeAboutDialog();
  });

  it('keeps the version out of the header', () => {
    expect(document.getElementById('version-label')).toBeNull();
    expect(document.querySelector('.app-header').textContent).not.toMatch(
      /v\d+\.\d+\.\d+/
    );
  });

  it('opens from the header ⋮ menu and closes the menu', () => {
    const menu = document.getElementById('header-more-menu');
    document.getElementById('header-more-toggle').click();
    expect(menu.hidden).toBe(false);

    document.getElementById('about-button').click();

    expect(menu.hidden).toBe(true);
    expect(isAboutDialogOpen()).toBe(true);
    expect(
      document.querySelector('[role="dialog"][aria-labelledby="about-title"]')
    ).not.toBeNull();
  });

  it('shows the plain version and support, privacy and source links', () => {
    setupVersionInfo('1.2.3');
    openAboutDialog();

    expect(document.getElementById('about-version').textContent).toBe(
      'Version 1.2.3'
    );
    const hrefs = [...document.querySelectorAll('.about-links a')].map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toEqual([
      'https://specdown.mosaicpando.com/support.html',
      'https://specdown.mosaicpando.com/privacy.html',
      'https://github.com/cbremer/specdown',
    ]);
    expect(document.querySelector('.about-sheet').textContent).not.toMatch(
      /alpha|beta/i
    );
  });

  it('closes on Escape and on Done', () => {
    openAboutDialog();
    document
      .querySelector('.about-sheet')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    expect(isAboutDialogOpen()).toBe(false);

    openAboutDialog();
    document.querySelector('.about-done').click();
    expect(isAboutDialogOpen()).toBe(false);
  });

  it('moves between ⋮ menu items with the arrow keys', () => {
    const picker = document.querySelector('.header-more-picker');
    const press = (key) =>
      picker.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true })
      );

    press('ArrowDown');
    expect(document.activeElement.id).toBe('open-recent-button');
    press('ArrowDown');
    expect(document.activeElement.id).toBe('about-button');
    press('ArrowDown');
    expect(document.activeElement.id).toBe('open-recent-button');
    press('ArrowUp');
    expect(document.activeElement.id).toBe('about-button');
  });
});
