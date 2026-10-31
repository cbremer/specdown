const { loadHTML, loadApp } = require('../helpers/loadApp');

const STORAGE_KEY = 'specdown-annotations';
const note = (id = 'one', text = 'Saved note') => ({
  id,
  text,
  anchor: null,
  legacyIdx: 0,
});
const backup = (files = { 'doc.md': [note()] }) =>
  JSON.stringify({ version: 2, files });
let originalGetItem;
let originalSetItem;

beforeEach(() => {
  originalGetItem = Storage.prototype.getItem.getMockImplementation();
  originalSetItem = Storage.prototype.setItem.getMockImplementation();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  document.getElementById('markdown-content').innerHTML =
    '<p>Document text</p>';
});

afterEach(() => {
  Storage.prototype.getItem.mockImplementation(originalGetItem);
  Storage.prototype.setItem.mockImplementation(originalSetItem);
});

function annotationWrites() {
  return Storage.prototype.setItem.mock.calls.filter(
    ([key]) => key === STORAGE_KEY
  );
}

const blockedStores = [
  ['unfinished JSON', '{"version":2,', 'corrupt'],
  ['empty bytes', '', 'corrupt'],
  ['array root', '[]', 'corrupt'],
  ['null root', 'null', 'corrupt'],
  [
    'future version',
    '{ "version": 3, "files": {"doc.md": ["future"]} }\n',
    'unsupported',
  ],
  ['explicit unknown old version', '{"version":1,"files":{}}', 'unsupported'],
  ['string version', '{"version":"2","files":{}}', 'unsupported'],
  ['v2 array files', '{"version":2,"files":[]}', 'corrupt'],
  ['v2 invalid collection', '{"version":2,"files":{"doc.md":{}}}', 'corrupt'],
  ['v2 invalid note', '{"version":2,"files":{"doc.md":[null]}}', 'corrupt'],
  [
    'v2 invalid anchor',
    JSON.stringify({
      version: 2,
      files: {
        'doc.md': [{ ...note(), anchor: { fp: 'x', path: '', ordinal: -1 } }],
      },
    }),
    'corrupt',
  ],
  ['v1 invalid index', '{"doc.md":{"unknown":"keep me"}}', 'corrupt'],
  ['v1 invalid text', '{"doc.md":{"0":{"text":"keep me"}}}', 'corrupt'],
  ['v1 invalid collection', '{"doc.md":"keep me"}', 'corrupt'],
];

describe('annotation persistence guard', () => {
  test.each(blockedStores)(
    '%s stays recoverable through every write path',
    (_label, raw, status) => {
      localStorage.setItem(STORAGE_KEY, raw);
      Storage.prototype.setItem.mockClear();
      expect(annReadStore()).toEqual({ status, raw, store: null });
      expect(annFileNotes('doc.md')).toEqual([]);
      expect(annPutFileNotes('doc.md', [note('new')])).toBe(false);
      expect(annPutFileNotes('doc.md', [])).toBe(false);
      expect(annWriteStore({ version: 2, files: {} })).toBe(false);
      renderAnnotations('doc.md');
      expect(
        commitAnnotation(
          { element: document.querySelector('#markdown-content p') },
          'new note'
        )
      ).toBe(false);
      expect(importAnnotations(backup())).toBe(false);
      expect(annotationWrites()).toHaveLength(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
      expect(getAnnotationsJSON()).toBe(raw);
      expect(document.querySelector('.toast-error')).not.toBeNull();
    }
  );

  test('an unavailable store never produces an empty writable store or backup', () => {
    const raw = backup();
    localStorage.setItem(STORAGE_KEY, raw);
    Storage.prototype.setItem.mockClear();
    Storage.prototype.getItem.mockImplementation(function (key) {
      if (key === STORAGE_KEY) throw new Error('Storage access denied');
      return originalGetItem.call(this, key);
    });
    expect(annReadStore()).toEqual({
      status: 'unavailable',
      raw: null,
      store: null,
    });
    expect(annPutFileNotes('new.md', [note()])).toBe(false);
    expect(annWriteStore({ version: 2, files: {} })).toBe(false);
    expect(importAnnotations(backup())).toBe(false);
    expect(() => getAnnotationsJSON()).toThrow('Storage access denied');
    expect(() => exportAnnotations()).not.toThrow();
    expect(document.getElementById('toast-region').textContent).toMatch(
      /No backup was created/
    );
    expect(annotationWrites()).toHaveLength(0);
    Storage.prototype.getItem.mockImplementation(originalGetItem);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(getAnnotationsJSON()).toBe(raw);
  });

  test('the persistence boundary rechecks storage after a successful read', () => {
    localStorage.setItem(STORAGE_KEY, backup());
    const { store } = annReadStore();
    const future = '{"version":9,"important":"preserve"}';
    localStorage.setItem(STORAGE_KEY, future);
    Storage.prototype.setItem.mockClear();
    expect(annWriteStore(store)).toBe(false);
    expect(annotationWrites()).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(future);
  });

  test.each(['new', 'edit', 'delete'])(
    'a transient initial read failure aborts %s without replacing saved notes',
    (operation) => {
      localStorage.setItem(STORAGE_KEY, backup());
      renderAnnotations('doc.md');
      const before = localStorage.getItem(STORAGE_KEY);
      Storage.prototype.setItem.mockClear();
      Storage.prototype.getItem.mockImplementationOnce(() => {
        throw new Error('Temporary read failure');
      });
      const target =
        operation === 'new'
          ? { element: document.querySelector('#markdown-content p') }
          : { id: 'one' };
      expect(
        commitAnnotation(target, operation === 'delete' ? '' : 'New text')
      ).toBe(false);
      expect(annotationWrites()).toHaveLength(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
      expect(annReadStore().status).toBe('valid');
    }
  );

  test('a transient initial read failure cannot start legacy anchor migration', () => {
    const before = JSON.stringify({ 'doc.md': { 0: 'Keep legacy note' } });
    localStorage.setItem(STORAGE_KEY, before);
    Storage.prototype.setItem.mockClear();
    Storage.prototype.getItem.mockImplementationOnce(() => {
      throw new Error('Temporary read failure');
    });
    renderAnnotations('doc.md');
    expect(annotationWrites()).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    renderAnnotations('doc.md');
    expect(annFileNotes('doc.md')[0].text).toBe('Keep legacy note');
    expect(annFileNotes('doc.md')[0].anchor).not.toBeNull();
  });

  test('a transient editor read failure cannot expose an empty existing-note editor', () => {
    localStorage.setItem(STORAGE_KEY, backup());
    renderAnnotations('doc.md');
    const before = localStorage.getItem(STORAGE_KEY);
    Storage.prototype.setItem.mockClear();
    Storage.prototype.getItem.mockImplementationOnce(() => {
      throw new Error('Temporary read failure');
    });
    openAnnotationEditor({ id: 'one' });
    expect(document.getElementById('annotation-editor-backdrop')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(annotationWrites()).toHaveLength(0);
    openAnnotationEditor({ id: 'one' });
    expect(document.querySelector('.annotation-editor-input').value).toBe(
      'Saved note'
    );
  });

  test('a missing note ID cannot replace another open editor with a blank draft', () => {
    localStorage.setItem(STORAGE_KEY, backup());
    renderAnnotations('doc.md');
    openAnnotationEditor({ id: 'one' });
    document.querySelector('.annotation-editor-input').value = 'Unsaved draft';
    openAnnotationEditor({ id: 'missing' });
    expect(document.querySelector('.annotation-editor-input').value).toBe(
      'Unsaved draft'
    );
    expect(annFileNotes('doc.md')[0].text).toBe('Saved note');
  });

  test('a storage failure at save leaves the old data and typed editor text intact', () => {
    const raw = backup();
    localStorage.setItem(STORAGE_KEY, raw);
    renderAnnotations('doc.md');
    const before = localStorage.getItem(STORAGE_KEY);
    openAnnotationEditor({ id: 'one' });
    const editor = document.getElementById('annotation-editor-backdrop');
    editor.querySelector('textarea').value = 'Unsaved replacement';
    Storage.prototype.setItem.mockImplementation(function (key, value) {
      if (key === STORAGE_KEY) throw new Error('Quota exceeded');
      return originalSetItem.call(this, key, value);
    });
    editor.querySelector('.annotation-editor-save').click();
    expect(editor.style.display).toBe('flex');
    expect(editor.querySelector('textarea').value).toBe('Unsaved replacement');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  test('recovery of storage access permits a later explicit write', () => {
    localStorage.setItem(STORAGE_KEY, '{bad');
    expect(annPutFileNotes('doc.md', [note()])).toBe(false);
    localStorage.setItem(STORAGE_KEY, backup());
    expect(annPutFileNotes('doc.md', [note('two')])).toBe(true);
    expect(annFileNotes('doc.md')[0].id).toBe('two');
  });
});

describe('lossless known-schema storage and backups', () => {
  test.each([
    '{bad JSON\n',
    '{ "version": 99, "future": "é😀" }\n',
    '{ "doc.md": {"0": "old"} }\n',
  ])('the download contains the exact original stored text', (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    const createObjectURL = URL.createObjectURL;
    const revokeObjectURL = URL.revokeObjectURL;
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    URL.createObjectURL = jest.fn(() => 'blob:notes-backup');
    URL.revokeObjectURL = jest.fn();
    jest.useFakeTimers();
    try {
      exportAnnotations();
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL.mock.calls[0][0].parts).toEqual([raw]);
      expect(click).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
      click.mockRestore();
    }
  });
  test.each(['__proto__', 'constructor', 'toString'])(
    'keeps the document key %s through migration, edit, export and import',
    (key) => {
      const raw = JSON.stringify({
        [key]: { 0: 'Original', 1: '' },
        'empty.md': {},
      });
      localStorage.setItem(STORAGE_KEY, raw);
      expect(getAnnotationsJSON()).toBe(raw);
      const result = annReadStore();
      expect(Object.getPrototypeOf(result.store.files)).toBeNull();
      expect(result.store.files[key]).toHaveLength(2);
      expect(result.store.files[key][1].text).toBe('');
      renderAnnotations(key);
      const id = annFileNotes(key)[0].id;
      expect(commitAnnotation({ id }, 'Updated')).toBe(true);
      const exported = getAnnotationsJSON();
      const saved = JSON.parse(exported);
      expect(Object.hasOwn(saved.files, key)).toBe(true);
      expect(saved.files[key].map((n) => n.text)).toEqual(['Updated', '']);
      expect(saved.files['empty.md']).toEqual([]);
      localStorage.removeItem(STORAGE_KEY);
      expect(importAnnotations(exported)).toBe(true);
      expect(annFileNotes(key).map((n) => n.text)).toEqual(['Updated', '']);
      expect(Object.getPrototypeOf(annReadStore().store.files)).toBeNull();
    }
  );

  test('preserves oversized legacy collections and long notes while editing another note', () => {
    const legacy = {
      'large.md': Object.fromEntries(
        Array.from({ length: 503 }, (_, i) => [
          i,
          i === 502 ? 'x'.repeat(16385) : 'Note ' + i,
        ])
      ),
    };
    const raw = JSON.stringify(legacy);
    localStorage.setItem(STORAGE_KEY, raw);
    expect(getAnnotationsJSON()).toBe(raw);
    renderAnnotations('large.md');
    const notes = annFileNotes('large.md');
    expect(notes).toHaveLength(503);
    expect(commitAnnotation({ id: notes[0].id }, 'Edited first note')).toBe(
      true
    );
    const after = JSON.parse(getAnnotationsJSON()).files['large.md'];
    expect(after).toHaveLength(503);
    expect(after[0].text).toBe('Edited first note');
    expect(after.slice(1).map((n) => n.text)).toEqual(
      Object.values(legacy['large.md']).slice(1)
    );
  });

  test('exports all original bytes over the normal import size limit', () => {
    const raw = JSON.stringify({
      'large.md': { 0: 'x'.repeat(2 * 1024 * 1024 + 1) },
    });
    localStorage.setItem(STORAGE_KEY, raw);
    expect(annReadStore().status).toBe('valid');
    expect(getAnnotationsJSON()).toBe(raw);
    expect(importAnnotations(raw)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  test('preserves v2 extension fields and unaffected empty collections during edits', () => {
    const stored = {
      version: 2,
      metadata: { label: 'Keep root metadata' },
      files: {
        'doc.md': [{ ...note(), extra: { created: 42 } }],
        'empty.md': [],
        'other.md': [
          {
            ...note('two'),
            anchor: { fp: 'unchanged', path: 'p', ordinal: 0, extra: 'keep' },
          },
        ],
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    renderAnnotations('doc.md');
    expect(commitAnnotation({ id: 'one' }, 'Edited')).toBe(true);
    const after = JSON.parse(getAnnotationsJSON());
    expect(after.metadata).toEqual(stored.metadata);
    expect(after.files['doc.md'][0].extra).toEqual({ created: 42 });
    expect(after.files['empty.md']).toEqual([]);
    expect(after.files['other.md']).toEqual(stored.files['other.md']);
  });
});

describe('schema-aware annotation imports', () => {
  test.each(blockedStores)(
    'rejects %s imports without changing a valid store',
    (_label, imported) => {
      const before = backup();
      localStorage.setItem(STORAGE_KEY, before);
      Storage.prototype.setItem.mockClear();
      expect(importAnnotations(imported)).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
      expect(annotationWrites()).toHaveLength(0);
    }
  );

  test('rejects an invalid entry instead of silently importing only the valid entries', () => {
    const before = backup();
    localStorage.setItem(STORAGE_KEY, before);
    expect(
      importAnnotations(
        JSON.stringify({
          version: 2,
          files: { 'new.md': [note(), { text: 42 }] },
        })
      )
    ).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  test('keeps supported optional fields and extensions in imported notes', () => {
    expect(
      importAnnotations(
        JSON.stringify({
          version: 2,
          metadata: { keep: true },
          files: {
            'new.md': [
              { text: '', extra: 'keep' },
              { text: 'anchored', anchor: { fp: 'fp', extra: 3 } },
            ],
          },
        })
      )
    ).toBe(true);
    const stored = JSON.parse(getAnnotationsJSON());
    expect(stored.metadata).toEqual({ keep: true });
    expect(stored.files['new.md'][0]).toMatchObject({
      text: '',
      extra: 'keep',
      anchor: null,
      legacyIdx: -1,
    });
    expect(stored.files['new.md'][1].anchor).toEqual({
      fp: 'fp',
      path: '',
      ordinal: 0,
      extra: 3,
    });
  });

  test('conflicting backup metadata is rejected instead of overwritten', () => {
    const raw = JSON.stringify({
      version: 2,
      metadata: { keep: 'original' },
      files: {},
    });
    localStorage.setItem(STORAGE_KEY, raw);
    expect(
      importAnnotations(
        JSON.stringify({
          version: 2,
          metadata: { keep: 'incoming' },
          files: { 'doc.md': [note()] },
        })
      )
    ).toBe(false);
    expect(getAnnotationsJSON()).toBe(raw);
  });

  test.each(['note', 'anchor'])(
    'duplicate %s extension metadata cannot be silently discarded',
    (where) => {
      const original = {
        ...note(),
        anchor: { fp: 'fp', path: 'path', ordinal: 0 },
      };
      const raw = backup({ 'doc.md': [original] });
      localStorage.setItem(STORAGE_KEY, raw);
      const incoming =
        where === 'note'
          ? { ...original, future: { color: 'yellow' } }
          : {
              ...original,
              anchor: { ...original.anchor, futureAnchor: 'retain me' },
            };
      expect(
        importAnnotations(
          backup({ 'new.md': [note('new')], 'doc.md': [incoming] })
        )
      ).toBe(false);
      expect(getAnnotationsJSON()).toBe(raw);
      expect(document.getElementById('toast-region').textContent).toMatch(
        /duplicate.*metadata/
      );
    }
  );

  test('identical duplicate extension metadata remains idempotent', () => {
    const imported = backup({
      'doc.md': [
        {
          ...note(),
          extra: { keep: true },
          anchor: { fp: 'fp', path: '', ordinal: 0, extra: 'keep too' },
        },
      ],
    });
    expect(importAnnotations(imported)).toBe(true);
    expect(importAnnotations(imported)).toBe(true);
    expect(annFileNotes('doc.md')).toHaveLength(1);
    expect(annFileNotes('doc.md')[0].extra).toEqual({ keep: true });
    expect(annFileNotes('doc.md')[0].anchor.extra).toBe('keep too');
  });

  test('conflicting metadata among incoming duplicates rejects the entire batch', () => {
    const raw = backup();
    localStorage.setItem(STORAGE_KEY, raw);
    expect(
      importAnnotations(
        backup({
          'new.md': [
            { ...note(), extra: 'first' },
            { ...note(), extra: 'second' },
          ],
        })
      )
    ).toBe(false);
    expect(getAnnotationsJSON()).toBe(raw);
  });
});
