/** Channel and rendering checks for the C+ design preview. */
const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const DIAGRAM = 'graph TD\n%% specdown:brand\n  A --> B';

describe('C+ brand preview gate', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-brand-preview');
    delete window.specdownAppChannel;
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    delete window.specdownAppChannel;
    document.documentElement.removeAttribute('data-brand-preview');
  });

  it.each([undefined, 'unknown'])(
    'stays off for channel %p: no attribute, no brand bar, diagrams unchanged',
    (channel) => {
      if (channel) window.specdownAppChannel = channel;
      expect(brandPreviewEnabled()).toBe(false);
      expect(setupBrandPreview()).toBe(false);
      expect(document.documentElement.hasAttribute('data-brand-preview')).toBe(
        false
      );
      expect(document.getElementById('brand-bar')).toBeNull();
      expect(brandDiagramSource(DIAGRAM, false)).toBe(DIAGRAM);
    }
  );

  it.each(['development', 'beta', 'production'])(
    'turns on for %s and adds one brand bar',
    (channel) => {
      window.specdownAppChannel = channel;
      expect(setupBrandPreview()).toBe(true);
      setupBrandPreview();
      expect(document.documentElement.getAttribute('data-brand-preview')).toBe(
        'cplus'
      );
      const bars = document.querySelectorAll('#brand-bar');
      expect(bars).toHaveLength(1);
      expect(bars[0].getAttribute('aria-hidden')).toBe('true');
      expect(
        document.querySelector('.app-container').firstElementChild.id
      ).toBe('brand-bar');
    }
  );

  it('gives only marked diagrams the SpecDown diagram style', () => {
    window.specdownAppChannel = 'development';
    const branded = brandDiagramSource(DIAGRAM, false);
    expect(branded.startsWith('%%{init: ')).toBe(true);
    expect(branded).toContain('"theme":"base"');
    expect(branded).toContain('#007a90');
    expect(branded.endsWith(DIAGRAM)).toBe(true);

    const dark = brandDiagramSource(DIAGRAM, true);
    expect(dark).toContain('#00a3bf');
    expect(dark).toContain('"darkMode":true');

    // A user's diagram without the marker is never restyled.
    const plain = 'graph TD\n  A --> B';
    expect(brandDiagramSource(plain, false)).toBe(plain);
  });

  it("never overrides a diagram's own init directive", () => {
    window.specdownAppChannel = 'development';
    const own =
      '%%{init: {"theme":"forest"}}%%\ngraph TD\n%% specdown:brand\n  A --> B';
    expect(brandDiagramSource(own, false)).toBe(own);
  });

  it('marks contents links for sections scrolled past as read', () => {
    const content = document.getElementById('markdown-content');
    content.innerHTML =
      '<h1 id="intro">Intro</h1><h2 id="setup">Setup</h2><h2 id="usage">Usage</h2><h2 id="faq">FAQ</h2>';
    const tops = { intro: 0, setup: 100, usage: 200, faq: 300 };
    for (const heading of content.querySelectorAll('h1, h2')) {
      Object.defineProperty(heading, 'offsetTop', { value: tops[heading.id] });
    }
    state.tocVisible = true;
    buildToc();
    // Scroll-spy counts a heading 60px early: at 180, Usage (200) is current
    // and FAQ (300) is not reached yet.
    content.scrollTop = 180;
    updateTocActiveHeading();

    const link = (id) =>
      document.querySelector(`#toc-nav .toc-link[href="#${id}"]`);
    expect(link('intro').classList.contains('toc-link-read')).toBe(true);
    expect(link('setup').classList.contains('toc-link-read')).toBe(true);
    expect(link('usage').classList.contains('toc-link-active')).toBe(true);
    expect(link('usage').classList.contains('toc-link-read')).toBe(false);
    expect(link('faq').classList.contains('toc-link-read')).toBe(false);
  });

  it('adds the app icon to About only when the preview is on', () => {
    openAboutDialog();
    expect(document.querySelector('.about-mark')).toBeNull();
    closeAboutDialog();

    window.specdownAppChannel = 'development';
    openAboutDialog();
    const mark = document.querySelector('.about-sheet .about-mark');
    expect(mark).not.toBeNull();
    expect(mark.getAttribute('alt')).toBe('');
    closeAboutDialog();
  });
});
