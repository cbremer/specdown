/**
 * Unit tests for diagram presentation mode.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

function addDiagrams(n) {
  const content = document.getElementById('markdown-content');
  content.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const container = document.createElement('div');
    container.className = 'diagram-container';
    container.setAttribute('data-diagram-id', 'd' + i);

    // Faithful to production DOM: the expand button comes FIRST and contains
    // an SVG icon. This is the regression fixture for the bug where
    // presentation mode cloned a button icon (a bare 'svg' query matched the
    // chrome) instead of the diagram in the wrapper.
    const iconSvgEl = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    iconSvgEl.setAttribute('data-icon-not-a-diagram', 'true');
    const expandBtn = document.createElement('button');
    expandBtn.className = 'diagram-expand';
    expandBtn.appendChild(iconSvgEl);
    container.appendChild(expandBtn);

    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-wrapper';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-i', String(i));
    wrapper.appendChild(svg);
    container.appendChild(wrapper);

    content.appendChild(container);
  }
}

function counterText() {
  const c = document.querySelector('.presentation-counter');
  return c ? c.textContent : null;
}

describe('Diagram presentation mode', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    if (isPresentationOpen()) exitPresentation();
  });

  it('reports whether the document has presentable diagrams', () => {
    expect(hasPresentableDiagrams()).toBe(false);
    addDiagrams(2);
    expect(hasPresentableDiagrams()).toBe(true);
  });

  it('launches presentation from the iPhone action-sheet button', () => {
    addDiagrams(2);
    const btn = document.getElementById('ios-present-button');
    expect(btn).not.toBeNull();
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(isPresentationOpen()).toBe(true);
    expect(document.querySelector('.presentation-overlay')).not.toBeNull();
  });

  it('opens a modal stage on the first diagram with a counter', () => {
    addDiagrams(3);
    startPresentation();

    expect(isPresentationOpen()).toBe(true);
    const overlay = document.querySelector('.presentation-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');

    // The first diagram's SVG is cloned into the stage — the DIAGRAM from
    // the wrapper, never a control-button icon (the loop-arrow bug).
    const staged = document.querySelector('.presentation-stage svg');
    expect(staged).not.toBeNull();
    expect(staged.getAttribute('data-i')).toBe('0');
    expect(staged.hasAttribute('data-icon-not-a-diagram')).toBe(false);
    expect(counterText()).toBe('1 / 3');
  });

  it('does nothing (and toasts) when there are no diagrams', () => {
    startPresentation();
    expect(isPresentationOpen()).toBe(false);
    expect(document.querySelector('.presentation-overlay')).toBeNull();
    expect(document.querySelector('.toast')).not.toBeNull();
  });

  it('steps forward and back, clamped at the ends', () => {
    addDiagrams(3);
    startPresentation();

    const prev = document.querySelector('.presentation-prev');
    const next = document.querySelector('.presentation-next');

    // At first slide: prev disabled.
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    presentNext();
    expect(counterText()).toBe('2 / 3');
    expect(
      document.querySelector('.presentation-stage svg').getAttribute('data-i')
    ).toBe('1');

    presentNext();
    expect(counterText()).toBe('3 / 3');
    // At last slide: next disabled.
    expect(document.querySelector('.presentation-next').disabled).toBe(true);

    // Clamp: another next stays at the end.
    presentNext();
    expect(counterText()).toBe('3 / 3');

    presentPrev();
    expect(counterText()).toBe('2 / 3');
  });

  it('navigates with the keyboard', () => {
    addDiagrams(2);
    startPresentation();
    const overlay = document.querySelector('.presentation-overlay');

    overlay.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(counterText()).toBe('2 / 2');

    overlay.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    expect(counterText()).toBe('1 / 2');

    overlay.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(isPresentationOpen()).toBe(false);
  });

  it('exits and removes the overlay', () => {
    addDiagrams(1);
    startPresentation();
    exitPresentation();

    expect(isPresentationOpen()).toBe(false);
    expect(document.querySelector('.presentation-overlay')).toBeNull();
  });

  describe('zoom', () => {
    function currentPanzoom() {
      const results = Panzoom.mock.results;
      return results[results.length - 1].value;
    }

    it('drives the slide panzoom from the zoom buttons', () => {
      Panzoom.mockClear();
      addDiagrams(1);
      startPresentation();
      const pz = currentPanzoom();
      expect(pz.getScale()).toBe(1);

      document
        .querySelector('.presentation-zoom-in')
        .dispatchEvent(new Event('click', { bubbles: true }));
      expect(pz.getScale()).toBeGreaterThan(1);

      document
        .querySelector('.presentation-zoom-fit')
        .dispatchEvent(new Event('click', { bubbles: true }));
      expect(pz.getScale()).toBe(1);
    });

    it('zooms with the keyboard (+ / - / 0)', () => {
      Panzoom.mockClear();
      addDiagrams(1);
      startPresentation();
      const pz = currentPanzoom();
      const overlay = document.querySelector('.presentation-overlay');

      overlay.dispatchEvent(
        new KeyboardEvent('keydown', { key: '+', bubbles: true })
      );
      expect(pz.getScale()).toBeGreaterThan(1);
      overlay.dispatchEvent(
        new KeyboardEvent('keydown', { key: '0', bubbles: true })
      );
      expect(pz.getScale()).toBe(1);
    });

    it('destroys the panzoom instance on exit', () => {
      Panzoom.mockClear();
      addDiagrams(1);
      startPresentation();
      const pz = currentPanzoom();
      exitPresentation();
      expect(pz.destroyed).toBe(true);
    });
  });
});
