const { loadHTML, loadApp } = require('../helpers/loadApp');
const RealPanzoom = require('@panzoom/panzoom');
const MockPanzoom = require('../mocks/panzoom');

let observers;
let viewportWidth;
let viewportHeight;
let previousResizeObserver;
let wrapper;
const fullscreen = () => document.getElementById('fullscreen-overlay');
const zoom = () => fullscreen().panzoomInstance;
function centered(instance = zoom(), width = 1000, height = 500) {
  const s = instance.getScale();
  const pan = instance.getPan();
  expect(s * (pan.x + width / 2)).toBeCloseTo(viewportWidth / 2, 6);
  expect(s * (pan.y + height / 2)).toBeCloseTo(viewportHeight / 2, 6);
}
function resize(width, height) {
  viewportWidth = width;
  viewportHeight = height;
  observers.at(-1).notify();
  jest.advanceTimersByTime(20);
}
function open() {
  openFullscreen('qa');
  jest.advanceTimersByTime(50);
  return zoom();
}

beforeEach(() => {
  jest.useFakeTimers();
  previousResizeObserver = global.ResizeObserver;
  observers = [];
  global.ResizeObserver = class {
    constructor(callback) {
      this.notify = callback;
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      observers.push(this);
    }
  };
  global.Panzoom = MockPanzoom;
  window.iosNative = true; // Avoid irrelevant canvas/minimap work.
  window.webkit = { messageHandlers: { specdown: { postMessage: jest.fn() } } };
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  document.getElementById('markdown-content').innerHTML =
    '<div id="wrapper-qa"><svg viewBox="100 -20 1000 500"></svg></div>';
  wrapper = fullscreen().querySelector('.fullscreen-diagram-wrapper');
  viewportWidth = 800;
  viewportHeight = 600;
  Object.defineProperty(wrapper, 'clientWidth', {
    configurable: true,
    get: () => viewportWidth,
  });
  Object.defineProperty(wrapper, 'clientHeight', {
    configurable: true,
    get: () => viewportHeight,
  });
});
afterEach(() => {
  closeFullscreen();
  jest.clearAllTimers();
  jest.useRealTimers();
  global.ResizeObserver = previousResizeObserver;
  global.Panzoom = MockPanzoom;
  delete window.iosNative;
  delete window.webkit;
});

test.each(['.zoom-in', '.zoom-out'])(
  '%s recenters after deliberate pan',
  (selector) => {
    const instance = open();
    instance.pan(400, -700);
    fullscreen().querySelector(selector).click();
    centered(instance);
  }
);

test('slider centers the whole SVG at its requested scale, including unchanged scale', () => {
  const instance = open();
  const slider = fullscreen().querySelector('.zoom-range');
  for (const percent of [200, 200, 25]) {
    instance.pan(400, -700);
    slider.value = String(percent);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(instance.getScale()).toBe(percent / 100);
    centered(instance);
  }
});

test('actual detail ResizeObserver preserves zoom and recenters after fold/sidebar changes', () => {
  const instance = open();
  instance.zoom(1.3);
  instance.pan(400, -700);
  resize(350, 900);
  expect(instance.getScale()).toBe(1.3);
  centered(instance);
  resize(1100, 400);
  expect(instance.getScale()).toBe(1.3);
  centered(instance);
});

test('unchanged layout notifications preserve intentional pan', () => {
  const instance = open();
  instance.pan(400, -700);
  resize(800, 600);
  expect(instance.getPan()).toEqual({ x: 400, y: -700 });
});

test.each(['button', 'double-click'])(
  '%s Reset calculates fit for the current viewport',
  (action) => {
    const instance = open();
    resize(400, 700);
    instance.zoom(2);
    instance.pan(300, 500);
    if (action === 'button') fullscreen().querySelector('.reset').click();
    else wrapper.dispatchEvent(new Event('dblclick', { bubbles: true }));
    expect(instance.getScale()).toBeCloseTo(0.36);
    expect(fullscreen().fullscreenState.homeState.scale).toBeCloseTo(0.36);
    centered(instance);
  }
);

test('zero-sized resize is ignored; restored dimensions use the current scale', () => {
  const instance = open();
  instance.zoom(1.5);
  const original = instance.getPan();
  resize(0, 0);
  expect(instance.getPan()).toEqual(original);
  resize(500, 700);
  expect(instance.getScale()).toBe(1.5);
  centered(instance);
});

test('window resize fallback recenters when ResizeObserver is unavailable', () => {
  global.ResizeObserver = undefined;
  const instance = open();
  viewportWidth = 350;
  window.dispatchEvent(new Event('resize'));
  jest.advanceTimersByTime(20);
  centered(instance);
});

test('close disconnects the observer and cancels pending fit/resize work', () => {
  openFullscreen('qa');
  const instance = zoom();
  const oldObserver = observers.at(-1);
  viewportWidth = 400;
  oldObserver.notify();
  const panSpy = jest.spyOn(instance, 'pan');
  const zoomSpy = jest.spyOn(instance, 'zoom');
  closeFullscreen();
  oldObserver.notify();
  jest.advanceTimersByTime(100);
  expect(oldObserver.disconnect).toHaveBeenCalledTimes(1);
  expect(panSpy).not.toHaveBeenCalled();
  expect(zoomSpy).not.toHaveBeenCalled();
});

test('reopening destroys the old instance; stale callbacks cannot change the new view', () => {
  openFullscreen('qa');
  const old = zoom();
  const observer = observers.at(-1);
  const oldPan = jest.spyOn(old, 'pan');
  openFullscreen('qa');
  const current = zoom();
  observer.notify();
  jest.advanceTimersByTime(50);
  expect(old.destroyed).toBe(true);
  expect(oldPan).not.toHaveBeenCalled();
  expect(current).not.toBe(old);
  centered(current);
});

test('late initial fit does not overwrite explicit control zoom', () => {
  openFullscreen('qa');
  jest.advanceTimersByTime(0);
  const instance = zoom();
  fullscreen().querySelector('.zoom-in').click();
  const scale = instance.getScale();
  jest.advanceTimersByTime(50);
  expect(instance.getScale()).toBe(scale);
  centered(instance);
});

test.each(['.zoom-in', '.zoom-out', '.zoom-range'])(
  'real Panzoom immediate %s survives its constructor pan reset',
  (selector) => {
    global.Panzoom = jest.fn((svg, options) => RealPanzoom(svg, options));
    openFullscreen('qa');
    const instance = zoom();
    const control = fullscreen().querySelector(selector);
    if (selector === '.zoom-range') {
      control.value = '175';
      control.dispatchEvent(new Event('input', { bubbles: true }));
    } else control.click();
    const scale = instance.getScale();
    // No timers ran before the control action: the library's pan(0,0) is pending.
    jest.advanceTimersByTime(0);
    expect(instance.getScale()).toBe(scale);
    centered(instance);
    // A deliberate pan after initialization must survive the trailing fit frame.
    instance.pan(123, -77, { animate: false });
    jest.advanceTimersByTime(50);
    expect(instance.getScale()).toBe(scale);
    expect(instance.getPan()).toEqual({ x: 123, y: -77 });
    expect(wrapper.querySelector('svg').style.transform).toContain(
      'translate(123px, -77px)'
    );
  }
);

test('wheel remains pointer-directed instead of forcibly centering', () => {
  const instance = open();
  const wheel = jest.spyOn(instance, 'zoomWithWheel');
  instance.pan(400, -700);
  wrapper.dispatchEvent(
    new WheelEvent('wheel', {
      deltaY: 10,
      clientX: 30,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    })
  );
  expect(wheel).toHaveBeenCalledTimes(1);
  expect(instance.getPan()).toEqual({ x: 400, y: -700 });
});

test.each([
  [1, 1, 20],
  [100000, 50000, 0.05],
  [1000, 500, 0.72],
])(
  'real Panzoom clamps fit for %s×%s before centering',
  (width, height, expectedScale) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    wrapper.appendChild(svg);
    const instance = RealPanzoom(svg, { minScale: 0.05, maxScale: 20 });
    jest.advanceTimersByTime(20);
    const home = fitDiagramToContainer(wrapper, svg, instance);
    jest.advanceTimersByTime(20);
    expect(home.scale).toBeCloseTo(expectedScale);
    centered(instance, width, height);
    expect(svg.style.left).toBe('0px');
    expect(svg.style.top).toBe('0px');
    expect(svg.style.transformOrigin).toBe('0 0');
    expect(svg.style.transform).toContain(
      `scale(${instance.getScale()}) translate(`
    );
    instance.destroy();
  }
);

test('invalid natural dimensions never produce a non-finite transform', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 Infinity 100');
  wrapper.appendChild(svg);
  const instance = MockPanzoom(svg, {});
  const pan = jest.spyOn(instance, 'pan');
  const scale = jest.spyOn(instance, 'zoom');
  expect(fitDiagramToContainer(wrapper, svg, instance)).toEqual({
    scale: 1,
    x: 0,
    y: 0,
  });
  expect(pan).not.toHaveBeenCalled();
  expect(scale).not.toHaveBeenCalled();
});
