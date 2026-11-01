const { loadHTML, loadApp } = require('../helpers/loadApp');

const focusOverlay = () => document.getElementById('fullscreen-overlay');
const focusInput = () => document.getElementById('search-input');
const focusContent = () => document.getElementById('markdown-content');
const focusExpand = () => document.getElementById('focus-expand');
const focusKey = (target, key, options = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
};
const openFocusDiagram = () => openFullscreen('focus');

beforeEach(() => {
  jest.useFakeTimers();
  window.iosNative = true;
  window.webkit = { messageHandlers: { specdown: { postMessage: jest.fn() } } };
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  document.getElementById('content-area').style.display = 'flex';
  focusContent().innerHTML =
    '<div class="diagram-container"><button class="diagram-expand" id="focus-expand">Expand</button>' +
    '<div id="wrapper-focus"><svg viewBox="0 0 100 50"></svg></div></div>';
  state.currentRawMarkdown = 'Synthetic diagram';
});

afterEach(() => {
  closeCommandPalette();
  closeShortcutsSheet();
  closeFullscreen();
  jest.clearAllTimers();
  jest.useRealTimers();
  delete window.iosNative;
  delete window.webkit;
});

test('opening fullscreen takes focus away from Find without scrolling', () => {
  openSearch();
  const focus = jest.spyOn(focusOverlay(), 'focus');
  openFocusDiagram();
  expect(document.activeElement).toBe(focusOverlay());
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(focusOverlay().getAttribute('role')).toBe('dialog');
  expect(focusOverlay().getAttribute('aria-modal')).toBe('true');
});

test.each(['textarea', 'contenteditable'])(
  'closing does not refocus a %s editor',
  (kind) => {
    const editor = document.createElement(
      kind === 'textarea' ? 'textarea' : 'div'
    );
    if (kind === 'contenteditable') {
      editor.setAttribute('contenteditable', 'true');
      editor.tabIndex = 0;
    }
    document.body.appendChild(editor);
    editor.focus();
    openFocusDiagram();
    closeFullscreen();
    expect(document.activeElement).toBe(focusExpand());
  }
);

test('closing after Find restores the diagram affordance, not its text input', () => {
  openSearch();
  focusInput().value = 'Keep this query';
  openFocusDiagram();
  closeFullscreen();
  expect(document.activeElement).toBe(focusExpand());
  expect(focusInput().value).toBe('Keep this query');
  expect(focusOverlay().hasAttribute('role')).toBe(false);
});

test('closing restores an available non-text opener without scrolling', () => {
  focusExpand().focus();
  openFocusDiagram();
  const focus = jest.spyOn(focusExpand(), 'focus');
  closeFullscreen();
  expect(document.activeElement).toBe(focusExpand());
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

test.each(['removed', 'hidden'])(
  'closing uses content when the opener is %s',
  (kind) => {
    focusExpand().focus();
    openFocusDiagram();
    if (kind === 'removed')
      focusContent().innerHTML = '<p>Replacement document</p>';
    else focusExpand().closest('.diagram-container').style.display = 'none';
    closeFullscreen();
    expect(document.activeElement).toBe(focusContent());
  }
);

test.each([false, true])(
  'Tab entry and wrapping stay inside fullscreen (shift=%s)',
  (shiftKey) => {
    openFocusDiagram();
    const first = focusOverlay().querySelector('.zoom-in');
    const last = focusOverlay().querySelector('.close-fullscreen');
    const entry = focusKey(focusOverlay(), 'Tab', { shiftKey });
    expect(entry.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(shiftKey ? last : first);
    (shiftKey ? first : last).focus();
    const wrap = focusKey(document.activeElement, 'Tab', { shiftKey });
    expect(wrap.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(shiftKey ? last : first);
  }
);

test.each(['direct', 'meta', 'ctrl', 'palette'])(
  'Find cannot focus the obscured input via %s',
  (route) => {
    openFocusDiagram();
    focusInput().value = 'Unchanged';
    if (route === 'direct') openSearch();
    else if (route === 'palette') {
      openCommandPalette();
      const input = document.querySelector('.command-palette-input');
      input.value = 'Find in document';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      focusKey(input, 'Enter');
    } else focusKey(document.activeElement, 'f', { [route + 'Key']: true });
    expect(document.activeElement).toBe(focusOverlay());
    expect(document.getElementById('search-bar').style.display).toBe('none');
    expect(focusInput().value).toBe('Unchanged');
  }
);

test('ordinary Find still works after fullscreen closes', () => {
  openFocusDiagram();
  closeFullscreen();
  openSearch();
  expect(document.activeElement).toBe(focusInput());
  expect(document.getElementById('search-bar').style.display).toBe('flex');
});

test('nested palette retains Tab ownership and its Escape leaves fullscreen open', () => {
  openFocusDiagram();
  openCommandPalette();
  const input = document.querySelector('.command-palette-input');
  const tab = focusKey(input, 'Tab');
  expect(tab.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(input);
  focusKey(input, 'Escape');
  expect(isCommandPaletteOpen()).toBe(false);
  expect(focusOverlay().style.display).toBe('flex');
  expect(document.activeElement).toBe(focusOverlay());
  focusKey(document.activeElement, 'Escape');
  expect(focusOverlay().style.display).toBe('none');
  expect(document.activeElement).toBe(focusExpand());
});

test('typing zoom keys in a newer palette does not zoom its background diagram', () => {
  openFocusDiagram();
  openCommandPalette();
  const input = document.querySelector('.command-palette-input');
  const instance = focusOverlay().panzoomInstance;
  jest.spyOn(instance, 'zoomIn');
  jest.spyOn(instance, 'zoomOut');
  jest.spyOn(instance, 'zoom');
  for (const key of ['+', '-', '0']) focusKey(input, key);
  expect(instance.zoomIn).not.toHaveBeenCalled();
  expect(instance.zoomOut).not.toHaveBeenCalled();
  expect(instance.zoom).not.toHaveBeenCalled();
});

test('teardown and repeated close never steal a newer dialog focus', () => {
  openFocusDiagram();
  openCommandPalette();
  const input = document.querySelector('.command-palette-input');
  closeFullscreen();
  closeFullscreen();
  expect(document.activeElement).toBe(input);
});

test('reopening releases the old trap and never transiently focuses Find', () => {
  openSearch();
  openFocusDiagram();
  const focus = jest.spyOn(focusInput(), 'focus');
  openFocusDiagram();
  expect(focus).not.toHaveBeenCalled();
  const last = focusOverlay().querySelector('.close-fullscreen');
  last.focus();
  const first = focusOverlay().querySelector('.zoom-in');
  const firstFocus = jest.spyOn(first, 'focus');
  focusKey(last, 'Tab');
  expect(firstFocus).toHaveBeenCalledTimes(1);
  closeFullscreen();
  const afterClose = focusKey(focusOverlay(), 'Tab');
  expect(afterClose.defaultPrevented).toBe(false);
});
