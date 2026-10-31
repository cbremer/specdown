const { loadHTML, loadApp } = require('../helpers/loadApp');

// Synthetic fixtures only: this suite never reads an installed app's storage.
const NOTES_KEY = 'specdown-annotations';
const FILENAME = 'synthetic-ios-deferred-notes.md';
const NOTE_TEXT = 'SYNTHETIC PRIVATE NOTE — preserve without displaying';
const legacy = ` { "${FILENAME}": { "0": "${NOTE_TEXT}" } }\n`;
const current = JSON.stringify({
  version: 2,
  files: {
    [FILENAME]: [
      { id: 'synthetic-note', text: NOTE_TEXT, anchor: null, legacyIdx: 0 },
    ],
  },
  extension: { preserve: 'synthetic unknown metadata' },
});
const root = () => document.getElementById('markdown-content');
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
let listenerSpy;

function boot(platform = 'ios', raw = current) {
  if (platform === 'ios') {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
  } else if (platform === 'desktop') {
    window.specdown = { isDesktop: true };
  }
  localStorage.setItem('visualTheme', 'default');
  if (raw !== null) localStorage.setItem(NOTES_KEY, raw);
  for (const method of ['getItem', 'setItem', 'removeItem', 'clear']) {
    Storage.prototype[method].mockClear();
  }
  loadHTML(document);
  listenerSpy = jest.spyOn(document, 'addEventListener');
  loadApp(document);
}

function expectNotesUntouched(raw) {
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    expect(
      Storage.prototype[method].mock.calls.filter(([key]) => key === NOTES_KEY)
    ).toEqual([]);
  }
  expect(Storage.prototype.clear).not.toHaveBeenCalled();
  // This assertion's own read happens only after checking all application calls.
  expect(localStorage.getItem(NOTES_KEY)).toBe(raw);
}

afterEach(() => {
  if (typeof closeCommandPalette === 'function') closeCommandPalette();
  if (listenerSpy) {
    for (const [type, listener, options] of listenerSpy.mock.calls) {
      document.removeEventListener(type, listener, options);
    }
    listenerSpy.mockRestore();
    listenerSpy = null;
  }
  delete window.iosNative;
  delete window.webkit;
  delete window.specdown;
});

describe('native iOS keeps deferred annotations inactive', () => {
  test.each([
    ['legacy', legacy],
    ['v2', current],
    ['future', ' {"version":99,"private":"synthetic future data"}\n'],
    ['corrupt', '{"synthetic unfinished'],
    ['missing', null],
  ])(
    '%s store survives native opens, same names and Raw → Preview without access',
    async (_kind, raw) => {
      boot('ios', raw);
      window.loadFileContent('<p>First synthetic source</p>', FILENAME);
      await flush();
      window.loadFileContent('<p>Unrelated second source</p>', FILENAME);
      await flush();
      toggleViewMode();
      expect(state.currentViewMode).toBe('raw');
      toggleViewMode();
      await flush();

      expect(state.tabs).toHaveLength(2);
      expect(root().textContent).toBe('Unrelated second source');
      expect(
        document.querySelector(
          '.annotation-badge, .annotation-popover, .annotation-editor'
        )
      ).toBeNull();
      expect(document.getElementById('annotation-list').children).toHaveLength(
        0
      );
      expect(document.body.textContent).not.toContain(NOTE_TEXT);
      expectNotesUntouched(raw);
    }
  );

  test.each(['phone', 'pad'])(
    'hardware keyboard palette excludes every annotation action in %s mode',
    async (mode) => {
      boot();
      window.loadFileContent('<p>Synthetic source</p>', FILENAME);
      await flush();
      window.setIOSLayoutMode(mode);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
      );
      expect(isCommandPaletteOpen()).toBe(true);
      const titles = Array.from(
        document.querySelectorAll('.command-palette-item-title'),
        (item) => item.textContent
      );
      expect(titles).toContain('Find in document');
      expect(titles).not.toEqual(
        expect.arrayContaining(['Import annotations'])
      );
      expect(titles.filter((title) => /annotat/i.test(title))).toEqual([]);
      expectNotesUntouched(current);
    }
  );

  test('direct render, panel and editor calls cannot display or change notes', async () => {
    boot();
    window.loadFileContent('<p>Synthetic source</p>', FILENAME);
    await flush();
    const target = { element: root().querySelector('p') };
    const context = { key: FILENAME, document: captureDocumentContext() };
    renderAnnotations(FILENAME);
    toggleAnnotationMode();
    renderAnnotationPanel();
    toggleAnnotationPanel();
    openAnnotationPanel();
    openAnnotationEditor(target, context);
    openAnnotationEditor({ id: 'synthetic-note' }, context);
    expect(commitAnnotation(target, 'Synthetic new note', context)).toBe(false);
    expect(commitAnnotation({ id: 'synthetic-note' }, '', context)).toBe(false);
    showAnnotationPopover(target.element, NOTE_TEXT);
    target.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(
      document.querySelector(
        '.annotation-badge, .annotation-popover, .annotation-editor, .annotatable'
      )
    ).toBeNull();
    expect(document.getElementById('annotation-panel').style.display).toBe(
      'none'
    );
    expect(document.getElementById('annotation-list').children).toHaveLength(0);
    expectNotesUntouched(current);
  });

  test('direct storage entry points fail closed without touching existing raw data', () => {
    boot();
    expect(annReadStore().store).toBeNull();
    expect(annWriteStore({ version: 2, files: {} })).toBe(false);
    expect(annPutFileNotes(FILENAME, [])).toBe(false);
    expect(importAnnotations(current)).toBe(false);
    expect(() => getAnnotationsJSON()).toThrow(/not available.*iOS/);
    expectNotesUntouched(current);
  });

  test('direct import/export cannot open a picker or create a download', () => {
    boot();
    const inputClick = jest.spyOn(HTMLInputElement.prototype, 'click');
    const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click');
    const oldCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:synthetic-annotation-backup');
    try {
      importAnnotationsFromFile();
      exportAnnotations();
      expect(inputClick).not.toHaveBeenCalled();
      expect(anchorClick).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expectNotesUntouched(current);
    } finally {
      inputClick.mockRestore();
      anchorClick.mockRestore();
      URL.createObjectURL = oldCreateObjectURL;
    }
  });
});

test.each(['web', 'desktop'])(
  '%s retains migration, popovers, editing and backup commands',
  async (platform) => {
    boot(platform, legacy);
    createTab(FILENAME, '<p>Synthetic source</p>');
    await flush();
    const badge = root().querySelector('.annotation-badge');
    expect(badge).not.toBeNull();
    badge.click();
    expect(document.querySelector('.annotation-popover').textContent).toBe(
      NOTE_TEXT
    );
    const migrated = JSON.parse(getAnnotationsJSON());
    expect(migrated.version).toBe(2);
    expect(migrated.files[FILENAME][0].anchor).not.toBeNull();
    expect(importAnnotations(current)).toBe(true);
    toggleAnnotationMode();
    root()
      .querySelector('p')
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(document.querySelector('.annotation-editor-input')).not.toBeNull();
    document.querySelector('.annotation-editor-cancel').click();
    openCommandPalette();
    expect(document.querySelector('.command-palette').textContent).toContain(
      'Import annotations'
    );
    expect(document.querySelector('.command-palette').textContent).toContain(
      'Export annotations'
    );
  }
);
