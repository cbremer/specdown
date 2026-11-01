const { loadHTML, loadApp } = require('../helpers/loadApp');

const presentationRoot = () => document.querySelector('.presentation-overlay');
const presentationContent = () => document.getElementById('markdown-content');
const presentationSearch = () => document.getElementById('search-input');
const presentationKey = (target, key, options = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
};
const presentationFixture = (count = 3) => {
  presentationContent().innerHTML = Array.from(
    { length: count },
    (_, i) =>
      `<div class="diagram-container"><div class="diagram-wrapper"><svg viewBox="0 0 100 50"><text>Diagram ${i}</text></svg></div></div>`
  ).join('');
};

beforeEach(() => {
  jest.useFakeTimers();
  window.specdown = { isDesktop: true, onTriggerSearch: jest.fn() };
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  document.getElementById('content-area').style.display = 'flex';
  document.getElementById('present-button').style.display = '';
  state.currentRawMarkdown = 'Synthetic diagrams';
  presentationFixture();
});

afterEach(() => {
  closeCommandPalette();
  closeShortcutsSheet();
  exitPresentation();
  jest.clearAllTimers();
  jest.useRealTimers();
  delete window.specdown;
});

test('opening presentation transfers Find focus without scrolling', () => {
  openSearch();
  const focus = jest.spyOn(HTMLElement.prototype, 'focus');
  startPresentation();
  expect(document.activeElement).toBe(presentationRoot());
  expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
  focus.mockRestore();
});

test.each(['direct', 'meta', 'ctrl', 'toolbar', 'palette', 'native'])(
  'Find cannot acquire background focus through %s while presenting',
  (route) => {
    startPresentation();
    presentationSearch().value = 'Retained query';
    if (route === 'direct') openSearch();
    else if (route === 'toolbar')
      document.getElementById('search-button').click();
    else if (route === 'native')
      window.specdown.onTriggerSearch.mock.calls[0][0]();
    else if (route === 'palette') {
      openCommandPalette();
      const input = document.querySelector('.command-palette-input');
      input.value = 'Find in document';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      presentationKey(input, 'Enter');
    } else
      presentationKey(document.activeElement, 'f', { [route + 'Key']: true });
    expect(document.activeElement).toBe(presentationRoot());
    expect(document.getElementById('search-bar').style.display).toBe('none');
    expect(presentationSearch().value).toBe('Retained query');
  }
);

test.each(['find', 'textarea', 'contenteditable'])(
  'closing does not restore a %s text keyboard',
  (kind) => {
    let editor;
    if (kind === 'find') {
      openSearch();
      editor = presentationSearch();
    } else {
      editor = document.createElement(kind === 'textarea' ? 'textarea' : 'div');
      if (kind === 'contenteditable') {
        editor.setAttribute('contenteditable', 'true');
        editor.tabIndex = 0;
      }
      document.body.appendChild(editor);
      editor.focus();
    }
    startPresentation();
    const focus = jest.spyOn(editor, 'focus');
    exitPresentation();
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(presentationContent());
  }
);

test('an available noneditable opener regains focus without scrolling', () => {
  const button = document.getElementById('present-button');
  button.focus();
  startPresentation();
  const focus = jest.spyOn(button, 'focus');
  exitPresentation();
  expect(document.activeElement).toBe(button);
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

test.each(['removed', 'hidden', 'disabled'])(
  'an unavailable %s opener falls back to document content',
  (kind) => {
    const button = document.getElementById('present-button');
    button.focus();
    startPresentation();
    if (kind === 'removed') button.remove();
    else if (kind === 'disabled') button.disabled = true;
    else button.closest('.content-header').style.display = 'none';
    exitPresentation();
    expect(document.activeElement).toBe(presentationContent());
  }
);

test.each([false, true])(
  'Tab from the presentation container enters enabled controls (shift=%s)',
  (shiftKey) => {
    startPresentation();
    const event = presentationKey(presentationRoot(), 'Tab', { shiftKey });
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      presentationRoot().querySelector(
        shiftKey ? '.presentation-close' : '.presentation-next'
      )
    );
  }
);

test('single-slide Tab entry skips both disabled navigation controls', () => {
  presentationFixture(1);
  startPresentation();
  const event = presentationKey(presentationRoot(), 'Tab');
  expect(event.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(
    presentationRoot().querySelector('.presentation-zoom-out')
  );
});

test('Tab wrapping follows enabled navigation as slides change', () => {
  startPresentation();
  const overlay = presentationRoot();
  const close = overlay.querySelector('.presentation-close');
  const next = overlay.querySelector('.presentation-next');
  const previous = overlay.querySelector('.presentation-prev');
  close.focus();
  presentationKey(close, 'Tab');
  expect(document.activeElement).toBe(next);
  presentNext();
  close.focus();
  presentationKey(close, 'Tab');
  expect(document.activeElement).toBe(previous);
  presentationKey(previous, 'Tab', { shiftKey: true });
  expect(document.activeElement).toBe(close);
});

test('Space on the focused Exit button keeps its native activation behavior', () => {
  startPresentation();
  const close = presentationRoot().querySelector('.presentation-close');
  close.focus();
  const event = presentationKey(close, ' ');
  expect(event.defaultPrevented).toBe(false);
  expect(document.querySelector('.presentation-counter').textContent).toBe(
    '1 / 3'
  );
});

test('a newer palette retains focus when presentation is closed or closed again', () => {
  document.getElementById('present-button').focus();
  startPresentation();
  openCommandPalette();
  const input = document.querySelector('.command-palette-input');
  exitPresentation();
  exitPresentation();
  expect(document.activeElement).toBe(input);
  expect(presentationKey(input, 'Tab').defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(input);
});

test('nested palette keeps Tab, typing and Escape ownership', () => {
  startPresentation();
  const instance = Panzoom.mock.results.at(-1).value;
  const zoom = jest.spyOn(instance, 'zoomIn');
  openCommandPalette();
  const input = document.querySelector('.command-palette-input');
  presentationKey(input, 'Tab');
  expect(document.activeElement).toBe(input);
  for (const key of ['+', '-', '0']) presentationKey(input, key);
  expect(zoom).not.toHaveBeenCalled();
  presentationKey(input, 'Escape');
  expect(isPresentationOpen()).toBe(true);
  expect(document.activeElement).toBe(presentationRoot());
  presentationKey(document.activeElement, 'Escape');
  expect(isPresentationOpen()).toBe(false);
});

test('close releases old listeners and a reopened presentation owns a fresh Tab cycle', () => {
  startPresentation();
  const oldOverlay = presentationRoot();
  const oldClose = oldOverlay.querySelector('.presentation-close');
  exitPresentation();
  startPresentation();
  expect(presentationRoot()).not.toBe(oldOverlay);
  expect(presentationKey(oldClose, 'Tab').defaultPrevented).toBe(false);
  presentationKey(presentationRoot(), 'Tab', { shiftKey: true });
  expect(document.activeElement).toBe(
    presentationRoot().querySelector('.presentation-close')
  );
});

test('ordinary Find works again after presentation exit', () => {
  startPresentation();
  exitPresentation();
  openSearch();
  expect(document.activeElement).toBe(presentationSearch());
  expect(document.getElementById('search-bar').style.display).toBe('flex');
});
