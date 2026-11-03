const { loadHTML, loadApp } = require('../helpers/loadApp');
const {
  waitForAnnotationContext,
  waitForAnnotationState,
} = require('../helpers/annotationReadiness');

const flush = async () => {
  await new Promise(resolve=>setTimeout(resolve,5));
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const contentRoot = () => document.getElementById('markdown-content');

function boot(native = true) {
  if (native) {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
  }
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
}

afterEach(() => {
  delete window.iosNative;
  delete window.webkit;
});

describe('document opens commit only after synchronous validation', () => {
  test.each([
    ['long line', () => 'x'.repeat(65537)],
    ['too many lines', () => 'x\n'.repeat(20001)],
    ['too much markup', () => '<p>x</p>'.repeat(20001)],
    ['excessive nesting', () => '<div>'.repeat(66) + 'x' + '</div>'.repeat(66)],
  ])(
    'rejects %s without changing the selected document',
    async (_name, input) => {
      boot();
      window.loadFileContent('<h1>A</h1><p>Synthetic document A</p>', 'A.md');
      await flush();
      contentRoot().scrollTop = 73;
      const before = {
        tabs: JSON.stringify(state.tabs),
        active: state.activeTabId,
        nextId: state.nextTabId,
        raw: state.currentRawMarkdown,
        html: contentRoot().innerHTML,
        tabBar: document.getElementById('tab-bar').innerHTML,
        context: captureDocumentContext(),
      };

      const accepted = window.loadFileContent(input(), 'B.md');
      await flush();

      expect(JSON.stringify(state.tabs)).toBe(before.tabs);
      expect(state.activeTabId).toBe(before.active);
      expect(state.nextTabId).toBe(before.nextId);
      expect(state.currentRawMarkdown).toBe(before.raw);
      expect(contentRoot().innerHTML).toBe(before.html);
      expect(contentRoot().scrollTop).toBe(73);
      expect(document.getElementById('file-name').textContent).toBe('A.md');
      expect(document.getElementById('tab-bar').innerHTML).toBe(before.tabBar);
      expect(isDocumentContextCurrent(before.context)).toBe(true);
      expect(document.querySelector('.toast-error').textContent).toMatch(
        /This document/
      );
      expect(accepted).toBe(false);
    }
  );

  test('rejected initial input leaves the empty screen without a phantom tab', () => {
    boot();
    const context = captureDocumentContext();
    const accepted = window.loadFileContent('x'.repeat(65537), 'B.md');
    expect(state.tabs).toEqual([]);
    expect(state.activeTabId).toBeNull();
    expect(state.currentRawMarkdown).toBe('');
    expect(contentRoot().innerHTML).toBe('');
    expect(document.getElementById('drop-zone').style.display).not.toBe('none');
    expect(isDocumentContextCurrent(context)).toBe(true);
    expect(accepted).toBe(false);
  });

  test('rejecting a new document keeps an existing raw view and its context', async () => {
    boot();
    window.loadFileContent('# A\nSynthetic source', 'A.md');
    await flush();
    toggleViewMode();
    const html = contentRoot().innerHTML;
    const context = captureDocumentContext();
    const accepted = window.loadFileContent('x'.repeat(65537), 'B.md');
    expect(state.tabs).toHaveLength(1);
    expect(state.currentViewMode).toBe('raw');
    expect(contentRoot().innerHTML).toBe(html);
    expect(isDocumentContextCurrent(context)).toBe(true);
    expect(accepted).toBe(false);
  });

  test.each(['parse', 'sanitize'])(
    '%s errors do not create or select a new tab',
    async (stage) => {
      boot();
      window.loadFileContent('<p>A</p>', 'A.md');
      await flush();
      const context = captureDocumentContext();
      const target = stage === 'parse' ? marked.parse : DOMPurify.sanitize;
      target.mockImplementationOnce(() => {
        throw new Error('Synthetic rejection');
      });
      const accepted = window.loadFileContent('<p>B</p>', 'B.md');
      expect(state.tabs).toHaveLength(1);
      expect(contentRoot().textContent).toBe('A');
      expect(isDocumentContextCurrent(context)).toBe(true);
      expect(accepted).toBe(false);
    }
  );

  test('accepted opens return true synchronously and parse their document once', async () => {
    boot();
    marked.parse.mockClear();
    DOMPurify.sanitize.mockClear();
    expect(window.loadFileContent('<h1>A</h1><p>Accepted</p>', 'A.md')).toBe(
      true
    );
    expect(state.tabs).toHaveLength(1);
    expect(contentRoot().textContent).toBe('AAccepted');
    await flush();
    expect(marked.parse).toHaveBeenCalledTimes(1);
    expect(DOMPurify.sanitize).toHaveBeenCalledTimes(1);
    expect(state.tocEntries).toHaveLength(1);
  });

  test('a rejected B does not invalidate the pending accepted A render', async () => {
    boot();
    let finish;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    global.processMermaidDiagrams = jest.fn(() => pending);
    const acceptedA = window.loadFileContent(
      '<h1>A</h1><p>Pending</p>',
      'A.md'
    );
    const context = captureDocumentContext();
    const acceptedB = window.loadFileContent('x'.repeat(65537), 'B.md');
    finish();
    await flush();
    expect(state.tabs).toHaveLength(1);
    expect(isDocumentContextCurrent(context)).toBe(true);
    expect(state.tocEntries.map((entry) => entry.text)).toEqual(['A']);
    expect(acceptedA).toBe(true);
    expect(acceptedB).toBe(false);
  });

  test('tab limit refusal returns false before parsing or changing current state', async () => {
    boot();
    for (let i = 0; i < 10; i++) {
      window.loadFileContent('<p>Accepted ' + i + '</p>', i + '.md');
    }
    await flush();
    const context = captureDocumentContext();
    const before = contentRoot().innerHTML;
    marked.parse.mockClear();
    const accepted = window.loadFileContent('<p>Overflow</p>', 'overflow.md');
    expect(state.tabs).toHaveLength(10);
    expect(contentRoot().innerHTML).toBe(before);
    expect(isDocumentContextCurrent(context)).toBe(true);
    expect(marked.parse).not.toHaveBeenCalled();
    expect(document.querySelector('.toast-warning').textContent).toMatch(
      /Maximum of 10/
    );
    expect(accepted).toBe(false);
  });

  test('desktop/web annotation draft stays usable after a rejected new file', async () => {
    boot(false);
    createTab('A.md', '<p>A</p>');
    await waitForAnnotationContext();
    openAnnotationEditor({ element: contentRoot().querySelector('p') });
    const input = document.querySelector('.annotation-editor-input');
    input.value = 'Synthetic retained draft';
    createTab('B.md', 'x'.repeat(65537));
    document.querySelector('.annotation-editor-save').click();
    await waitForAnnotationState(
      () =>
        annFileNotes(annotationKey)[0]?.text === 'Synthetic retained draft' &&
        annRoot.requests.every((request) => request.acknowledged)
    );
    expect(annFileNotes(annotationKey)[0].text).toBe(
      'Synthetic retained draft'
    );
    expect(annRoot.documents.some((d) => d.label === 'B.md')).toBe(false);
    expect(state.tabs).toHaveLength(1);
  });
});
