const { loadHTML, loadApp } = require('../helpers/loadApp');

const NOTES_KEY = 'specdown-annotations';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const stored = () => localStorage.getItem(NOTES_KEY);
const root = () => document.getElementById('markdown-content');
const editor = () => document.getElementById('annotation-editor-backdrop');
const note = (text) => ({
  id: 'shared-import-id',
  text,
  anchor: null,
  legacyIdx: 0,
});
const setNotes = () =>
  localStorage.setItem(
    NOTES_KEY,
    JSON.stringify({
      version: 2,
      files: { 'A.md': [note('A original')], 'B.md': [note('B original')] },
    })
  );
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function openDocument(
  name = 'A.md',
  text = '<p>Body A</p>',
  path = null
) {
  createTab(name, text, path);
  await flush();
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}
function newDraft(text = 'Private draft') {
  openAnnotationEditor({ element: root().querySelector('p') });
  editor().querySelector('textarea').value = text;
}
function expectRejectedDraft(before, text = 'Private draft', action = 'save') {
  editor()
    .querySelector('.annotation-editor-' + action)
    .click();
  expect(stored()).toBe(before);
  expect(editor().style.display).toBe('flex');
  expect(editor().querySelector('textarea').value).toBe(text);
}

beforeEach(() => {
  localStorage.setItem('visualTheme', 'default');
  window.specdown = {
    isDesktop: true,
    onFileChanged: jest.fn(),
    onFileOpened: jest.fn(),
    onCloseTab: jest.fn(),
    watchFile: jest.fn(),
    unwatchFile: jest.fn(),
    saveSession: jest.fn(),
    exportPdf: jest.fn(),
  };
  loadHTML(document);
  loadApp(document);
  mermaid.render
    .mockReset()
    .mockResolvedValue({
      svg: '<svg viewBox="0 0 10 10"><text>Diagram</text></svg>',
    });
});
afterEach(() => {
  delete window.specdown;
});

describe('annotation actions retain their document context', () => {
  test('a new A draft cannot be saved into B', async () => {
    await openDocument();
    newDraft();
    await openDocument('B.md', '<p>Body B</p>');
    expectRejectedDraft(stored());
  });

  test.each(['save', 'delete'])(
    'an A editor cannot %s a B note with the same imported ID',
    async (action) => {
      setNotes();
      await openDocument();
      openAnnotationEditor({ id: 'shared-import-id' });
      editor().querySelector('textarea').value = 'A draft';
      await openDocument('B.md', '<p>Body B</p>');
      expectRejectedDraft(stored(), 'A draft', action);
    }
  );

  test('same filenames in different tabs still invalidate the old editor', async () => {
    await openDocument('same.md', '<p>First location</p>', '/one/same.md');
    newDraft();
    await openDocument('same.md', '<p>Second location</p>', '/two/same.md');
    expectRejectedDraft(stored());
  });

  test('switching A to B and back does not revive a stale draft', async () => {
    const a = await openDocument();
    const b = await openDocument('B.md', '<p>Body B</p>');
    await switchTab(a.id);
    newDraft();
    await switchTab(b.id);
    await switchTab(a.id);
    expectRejectedDraft(stored());
  });

  test.each(['preview reload', 'raw', 'close', 'empty'])(
    '%s keeps a draft but rejects its stale save',
    async (transition) => {
      await openDocument();
      newDraft();
      if (transition === 'preview reload')
        await renderMarkdown('<p>Replacement</p>', 'A.md');
      if (transition === 'raw') toggleViewMode();
      if (transition === 'close') await closeTab(state.activeTabId);
      if (transition === 'empty') showDropZone();
      expectRejectedDraft(stored());
    }
  );

  test('a stale detached target cannot create an unanchored note', async () => {
    await openDocument();
    const target = root().querySelector('p');
    target.remove();
    const before = stored();
    expect(commitAnnotation({ element: target }, 'Wrong target')).toBe(false);
    expect(stored()).toBe(before);
  });

  test('old panel actions reject while a replacement document is still rendering', async () => {
    setNotes();
    await openDocument();
    const edit = document.querySelector('.annotation-list-edit');
    const remove = document.querySelector('.annotation-list-delete');
    const pending = deferred();
    global.processMermaidDiagrams = jest.fn(() => pending.promise);
    createTab('B.md', '<p>Body B</p>');
    const before = stored();
    edit.click();
    remove.click();
    expect(editor()).toBeNull();
    expect(stored()).toBe(before);
    pending.resolve();
    await flush();
  });

  test('opening a second editor cannot replace a stale draft or add another save listener', async () => {
    await openDocument();
    newDraft();
    await openDocument('B.md', '<p>Body B</p>');
    openAnnotationEditor({ element: root().querySelector('p') });
    expectRejectedDraft(stored());
    editor().querySelector('.annotation-editor-cancel').click();
    openAnnotationEditor({ element: root().querySelector('p') });
    editor().querySelector('textarea').value = 'B intentional note';
    editor().querySelector('.annotation-editor-save').click();
    expect(JSON.parse(stored()).files['B.md'].map((n) => n.text)).toEqual([
      'B intentional note',
    ]);
  });

  test('a resize without document replacement still permits a normal save', async () => {
    await openDocument();
    newDraft();
    window.dispatchEvent(new Event('resize'));
    editor().querySelector('.annotation-editor-save').click();
    expect(JSON.parse(stored()).files['A.md'][0].text).toBe('Private draft');
    expect(editor().style.display).toBe('none');
  });

  test.each(['switch', 'close'])(
    '%s into a raw tab rejects the prior document draft',
    async (transition) => {
      const a = await openDocument();
      toggleViewMode();
      const b = await openDocument('B.md', '<p>Body B</p>');
      newDraft();
      if (transition === 'switch') await switchTab(a.id);
      else await closeTab(b.id);
      expect(state.currentViewMode).toBe('raw');
      expectRejectedDraft(stored());
    }
  );

  test('replacing the root element rejects an existing-note edit even without a tab change', async () => {
    setNotes();
    await openDocument();
    openAnnotationEditor({ id: 'shared-import-id' });
    editor().querySelector('textarea').value = 'Uncommitted edit';
    const replacement = document.createElement('div');
    replacement.id = 'markdown-content';
    replacement.innerHTML = '<p>New root</p>';
    root().replaceWith(replacement);
    expectRejectedDraft(stored(), 'Uncommitted edit');
  });

  test('rejected same-tab input leaves the unchanged editor usable', async () => {
    await openDocument();
    newDraft();
    await renderMarkdown('x'.repeat(65537), 'A.md');
    expect(root().textContent).toBe('Body A');
    editor().querySelector('.annotation-editor-save').click();
    expect(JSON.parse(stored()).files['A.md'][0].text).toBe('Private draft');
  });
});

describe('only the current render can finish document setup', () => {
  test.each(['resolve', 'reject'])(
    'a stale A %s cannot change B context, anchors, split source or scroll',
    async (finish) => {
      localStorage.setItem(
        NOTES_KEY,
        JSON.stringify({ version: 2, files: { 'A.md': [note('A original')] } })
      );
      const before = stored();
      const pending = deferred();
      global.processMermaidDiagrams = jest
        .fn()
        .mockImplementationOnce(() => pending.promise)
        .mockResolvedValue(undefined);
      state.splitViewActive = true;
      createTab('A.md', '<p>Body A</p>');
      await openDocument('B.md', '<p>Body B</p>');
      root().scrollTop = 321;
      const split = document.getElementById('split-raw-content').textContent;
      if (finish === 'resolve') pending.resolve();
      else pending.reject(new Error('Old diagram failure'));
      await flush();
      expect(annotationKey).toBe('B.md');
      expect(stored()).toBe(before);
      expect(root().textContent).toBe('Body B');
      expect(root().scrollTop).toBe(321);
      expect(document.getElementById('split-raw-content').textContent).toBe(
        split
      );
      expect(
        document.getElementById('toast-region')?.textContent || ''
      ).not.toMatch(/Error rendering markdown/);
    }
  );

  test.each(['raw', 'empty'])(
    'a pending preview cannot finalize after switching to %s',
    async (transition) => {
      await openDocument();
      const pending = deferred();
      global.processMermaidDiagrams = jest.fn(() => pending.promise);
      const rendering = renderMarkdown('<p>Replacement</p>', 'A.md');
      if (transition === 'raw') toggleViewMode();
      else showDropZone();
      const html = root().innerHTML;
      const key = annotationKey;
      root().scrollTop = 91;
      pending.resolve();
      await rendering;
      expect(root().innerHTML).toBe(html);
      expect(annotationKey).toBe(key);
      expect(root().scrollTop).toBe(91);
    }
  );

  test('stale switchTab completion cannot restore its scroll over another tab', async () => {
    const a = await openDocument();
    const b = await openDocument('B.md', '<p>Body B</p>');
    a.scrollTop = 88;
    const pending = deferred();
    global.processMermaidDiagrams = jest
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(undefined);
    const switching = switchTab(a.id);
    await switchTab(b.id);
    root().scrollTop = 314;
    pending.resolve();
    await switching;
    expect(root().scrollTop).toBe(314);
    expect(annotationKey).toBe('B.md');
  });

  test('stale watcher completion neither restores scroll nor pulses the active tab', async () => {
    const a = await openDocument('A.md', '<p>Body A</p>', '/one/A.md');
    const pending = deferred();
    global.processMermaidDiagrams = jest
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(undefined);
    root().scrollTop = 87;
    const changed = window.specdown.onFileChanged.mock.calls[0][0];
    const reloading = changed({
      filename: 'A.md',
      filePath: '/one/A.md',
      content: '<p>Updated A</p>',
    });
    await openDocument('B.md', '<p>Body B</p>', '/two/B.md');
    root().scrollTop = 273;
    global.pulseWatchToggle = jest.fn();
    pending.resolve();
    await reloading;
    expect(root().scrollTop).toBe(273);
    expect(pulseWatchToggle).not.toHaveBeenCalled();
    expect(a.hasUnseenChanges).toBe(true);
    expect(annotationKey).toBe('B.md');
  });

  test('rejected same-tab watcher content leaves the unchanged draft usable', async () => {
    await openDocument('A.md', '<p>Body A</p>', '/one/A.md');
    newDraft();
    const changed = window.specdown.onFileChanged.mock.calls[0][0];
    await changed({
      filename: 'A.md',
      filePath: '/one/A.md',
      content: 'x'.repeat(65537),
    });
    editor().querySelector('.annotation-editor-save').click();
    expect(JSON.parse(stored()).files['A.md'][0].text).toBe('Private draft');
  });

  test('raw watcher replacement invalidates the document generation', async () => {
    await openDocument('A.md', '<p>Body A</p>', '/one/A.md');
    toggleViewMode();
    const previous = captureDocumentContext();
    const changed = window.specdown.onFileChanged.mock.calls[0][0];
    await changed({
      filename: 'A.md',
      filePath: '/one/A.md',
      content: '<p>Updated A</p>',
    });
    expect(isDocumentContextCurrent(previous)).toBe(false);
    expect(state.currentViewMode).toBe('raw');
  });

  test('a requested PDF keeps its captured title when another tab opens during rendering', async () => {
    await openDocument();
    const pending = deferred();
    global.buildPrintableDocument = jest.fn(() => pending.promise);
    const exporting = exportActivePdf();
    await openDocument('B.md', '<p>Body B</p>');
    pending.resolve('<html><body>A export</body></html>');
    await exporting;
    expect(window.specdown.exportPdf).toHaveBeenCalledWith({
      title: 'A.md',
      html: '<html><body>A export</body></html>',
    });
  });
});

describe('diagram work observes raw and empty transitions', () => {
  test.each(['resolve', 'reject'])(
    'a pending Mermaid %s cannot modify detached content after raw transition',
    async (finish) => {
      await openDocument();
      root().innerHTML =
        '<pre><code class="language-mermaid">graph TD; A-->B</code></pre>';
      const pre = root().querySelector('pre');
      const pending = deferred();
      mermaid.render.mockImplementationOnce(() => pending.promise);
      const processing = processMermaidDiagrams();
      await flush();
      toggleViewMode();
      const html = root().innerHTML;
      const oldHtml = pre.outerHTML;
      if (finish === 'resolve') pending.resolve({ svg: '<svg>Stale</svg>' });
      else pending.reject(new Error('Stale rejection'));
      await processing;
      expect(root().innerHTML).toBe(html);
      expect(pre.outerHTML).toBe(oldHtml);
      expect(console.error).not.toHaveBeenCalledWith(
        'Error rendering mermaid diagram:',
        expect.anything()
      );
    }
  );

  test.each(['resolve', 'reject'])(
    'a pending theme %s cannot rewrite detached diagrams after empty transition',
    async (finish) => {
      await openDocument();
      root().innerHTML =
        '<div class="diagram-container" data-diagram-id="test"><div class="diagram-wrapper"><svg data-mermaid-source="graph TD; A-->B"></svg></div></div>';
      const wrapper = root().querySelector('.diagram-wrapper');
      const before = wrapper.innerHTML;
      const pending = deferred();
      mermaid.render.mockImplementationOnce(() => pending.promise);
      const rendering = reRenderMermaidDiagrams();
      await flush();
      showDropZone();
      if (finish === 'resolve') pending.resolve({ svg: '<svg>Stale</svg>' });
      else pending.reject(new Error('Stale theme rejection'));
      await rendering;
      expect(root().innerHTML).toBe('');
      expect(wrapper.innerHTML).toBe(before);
      expect(console.error).not.toHaveBeenCalledWith(
        'Error re-rendering mermaid diagram:',
        expect.anything()
      );
    }
  );
});
