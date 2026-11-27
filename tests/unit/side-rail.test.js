const { loadHTML, loadApp } = require('../helpers/loadApp');
const {
  installAnnotationAuthority,
} = require('../helpers/annotationAuthority');
const {
  waitForAnnotationContext,
  waitForAnnotationState,
} = require('../helpers/annotationReadiness');

const element = (id) => document.getElementById(id);
const railNode = () => element('side-rail');
const key = (el, value, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', {
    key: value,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
};
const pointer = (el, type, x) => {
  const event = new MouseEvent(type, { clientX: x, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  el.dispatchEvent(event);
};

const originalMatchMedia = window.matchMedia;
let narrow;
beforeEach(() => {
  narrow = false;
  window.matchMedia = (query) => ({
    matches: narrow && query.includes('max-width'),
    addEventListener() {},
    removeEventListener() {},
  });
  loadHTML(document);
  loadApp(document);
  installAnnotationAuthority();
});
afterEach(() => {
  closeSideRail(false);
  window.matchMedia = originalMatchMedia;
});

test('Notes inside the shared rail preserves note CRUD and the other tab across switches', async () => {
  createTab('notes.md', '<p>First paragraph</p>', null, {
    url: 'https://example.test/notes.md',
  });
  await waitForAnnotationContext();
  const opener = element('overflow-toggle');
  opener.focus();
  const paragraph = element('markdown-content').querySelector('p');
  await commitAnnotation({ element: paragraph }, 'First note');
  openAnnotationPanel();
  expect(
    railNode().querySelector('#annotation-list .annotation-list-note')
      .textContent
  ).toBe('First note');
  expect(element('rail-note-count').textContent).toBe('1');
  expect(element('annotation-list-toggle').getAttribute('aria-expanded')).toBe(
    'true'
  );
  key(element('rail-notes-tab'), 'ArrowLeft');
  expect(activeSideRailTab()).toBe('explain');
  const panel = getSideRailPanel('explain');
  const draft = document.createElement('textarea');
  panel.append(draft);
  draft.value = 'Saved draft';
  key(element('rail-explain-tab'), 'End');
  expect(draft.isConnected).toBe(true);
  expect(draft.value).toBe('Saved draft');
  expect(panel.hidden).toBe(true);
  railNode().querySelector('.annotation-list-edit').focus();
  railNode().querySelector('.annotation-list-edit').click();
  const editor = element('annotation-editor-backdrop');
  editor.querySelector('textarea').value = 'Updated note';
  editor.querySelector('.annotation-editor-save').click();
  await waitForAnnotationState(
    () =>
      railNode().querySelector('.annotation-list-note')?.textContent ===
      'Updated note'
  );
  await waitForAnnotationState(
    () =>
      document.activeElement ===
      railNode().querySelector('.annotation-list-edit')
  );
  railNode().querySelector('.annotation-list-delete').focus();
  railNode().querySelector('.annotation-list-delete').click();
  await waitForAnnotationState(
    () => element('rail-note-count').textContent === '0'
  );
  expect(element('rail-notes-empty').hidden).toBe(false);
  expect(document.activeElement).toBe(element('rail-notes-tab'));
  expect(activeSideRailTab()).toBe('notes');
  key(element('rail-notes-tab'), 'Escape');
  expect(railNode().hidden).toBe(true);
  expect(document.activeElement).toBe(opener);
});

test('separator adjusts, persists, caps for the document pane and resets its width', () => {
  localStorage.setItem('specdown.railWidth', '416');
  const rail = railNode();
  jest
    .spyOn(rail.parentElement, 'getBoundingClientRect')
    .mockReturnValue({ width: 1200 });
  jest.spyOn(rail, 'getBoundingClientRect').mockReturnValue({ right: 1200 });
  const handle = rail.querySelector('[role=separator]');
  handle.setPointerCapture = jest.fn();
  openSideRail('notes');
  expect(handle.getAttribute('aria-valuenow')).toBe('416');
  key(handle, 'ArrowLeft');
  expect(localStorage.getItem('specdown.railWidth')).toBe('432');
  key(handle, 'Home');
  expect(handle.getAttribute('aria-valuenow')).toBe('320');
  key(handle, 'End');
  expect(handle.getAttribute('aria-valuenow')).toBe('480');
  pointer(handle, 'pointerdown', 720);
  pointer(handle, 'pointermove', 800);
  pointer(handle, 'pointerup', 800);
  expect(handle.getAttribute('aria-valuenow')).toBe('400');
  expect(localStorage.getItem('specdown.railWidth')).toBe('400');
  handle.dispatchEvent(new MouseEvent('dblclick'));
  expect(localStorage.getItem('specdown.railWidth')).toBe('360');
  rail.parentElement.getBoundingClientRect.mockReturnValue({ width: 730 });
  window.dispatchEvent(new Event('resize'));
  expect(handle.getAttribute('aria-valuenow')).toBe('250');
  expect(localStorage.getItem('specdown.railWidth')).toBe('360');
});

test('compact trap excludes hidden panels and restores focus, selection and scroll on close', async () => {
  narrow = true;
  createTab('compact.md', '<p>Selected source</p>', null, {
    url: 'https://example.test/compact.md',
  });
  await waitForAnnotationContext();
  const opener = element('overflow-toggle');
  const reader = element('markdown-content');
  reader.textContent = 'Selected source';
  reader.scrollTop = 64;
  const range = document.createRange();
  range.setStart(reader.firstChild, 2);
  range.setEnd(reader.firstChild, 6);
  openSideRail('notes', { opener, selection: range });
  expect(railNode().getAttribute('aria-modal')).toBe('true');
  expect(reader.closest('[inert]')).not.toBeNull();
  expect(document.activeElement).toBe(element('rail-notes-tab'));
  const close = railNode().querySelector('.sd-rail-close');
  close.focus();
  expect(key(close, 'Tab').defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(element('rail-notes-tab'));
  expect(key(document.activeElement, 'Tab', true).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(close);
  reader.scrollTop = 128;
  key(close, 'Escape');
  expect(document.activeElement).toBe(opener);
  expect(reader.closest('[inert]')).toBeNull();
  expect(window.getSelection().toString()).toBe('lect');
  expect(reader.scrollTop).toBe(64);
});
