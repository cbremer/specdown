const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const webFile = (name, text = '# A') => ({
  name,
  kind: 'file',
  getFile: jest.fn(async () => ({ size: text.length, text: async () => text })),
});
const webDir = (name, entries = []) => ({
  name,
  kind: 'directory',
  async *values() {
    yield* entries;
  },
});
let canvas;
beforeEach(() => {
  localStorage.clear();
  canvas = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
});
afterEach(() => {
  canvas.mockRestore();
  delete window.specdown;
  delete window.showDirectoryPicker;
  delete window.webkit;
});
function loadDesktop() {
  window.specdown = {
    isDesktop: true,
    onWorkspaceOpened: jest.fn(),
    onWorkspaceClosed: jest.fn(),
    requestWorkspaceFile: jest.fn(),
    requestCloseWorkspace: jest.fn(),
    requestOpenRelative: jest.fn(),
    requestOpenPath: jest.fn(),
    onFileOpened: jest.fn(),
    reportFileOpenResult: jest.fn(),
    watchFile: jest.fn(),
    unwatchFile: jest.fn(),
    saveSession: jest.fn(),
  };
  loadHTML(document);
  loadApp(document);
}
function opened(
  id = 'A',
  generation = 1,
  files = [{ name: 'a.md', relPath: 'a.md', path: '/A/a.md' }]
) {
  window.specdown.onWorkspaceOpened.mock.calls[0][0]({
    root: '/A',
    files,
    id,
    generation,
  });
}
function closed(generation) {
  window.specdown.onWorkspaceClosed.mock.calls[0][0]({ generation });
}
function deliver(id, name = 'a.md') {
  window.specdown.onFileOpened.mock.calls[0][0]({
    filename: name,
    filePath: '/A/' + name,
    content: '# Kept',
    workspaceId: id,
    openReceipt: 'receipt',
  });
}

describe('Close Folder desktop renderer', () => {
  beforeEach(loadDesktop);
  test('hide remains reversible; Close actually removes the navigation context', () => {
    opened();
    toggleWorkspaceSidebar();
    expect(hasWorkspace()).toBe(true);
    toggleWorkspaceSidebar();
    expect(document.querySelectorAll('.workspace-file-item')).toHaveLength(1);
    closeWorkspaceFolder();
    expect(hasWorkspace()).toBe(false);
    expect(
      document.getElementById('workspace-file-list').childElementCount
    ).toBe(0);
    expect(document.getElementById('workspace-toggle').style.display).toBe(
      'none'
    );
    toggleWorkspaceSidebar();
    expect(document.getElementById('workspace-sidebar').style.display).toBe(
      'none'
    );
    expect(window.specdown.requestCloseWorkspace).toHaveBeenCalledTimes(1);
  });
  test('Close retains exact accepted document, watch state, notes and recents', () => {
    opened();
    deliver('A');
    state.tabs[0].testNote = 'preserve me';
    const tabs = JSON.stringify(state.tabs);
    const content = document.getElementById('markdown-content').innerHTML;
    const storage = JSON.stringify(localStorage);
    window.specdown.unwatchFile.mockClear();
    window.specdown.saveSession.mockClear();
    closeWorkspaceFolder();
    expect(JSON.stringify(state.tabs)).toBe(tabs);
    expect(document.getElementById('markdown-content').innerHTML).toBe(content);
    expect(JSON.stringify(localStorage)).toBe(storage);
    expect(window.specdown.unwatchFile).not.toHaveBeenCalled();
    expect(window.specdown.saveSession).not.toHaveBeenCalled();
  });
  test('detached old file/directory controls cannot act on a later workspace', () => {
    opened('A', 1, [
      { name: 'a.md', relPath: 'sub/a.md', path: '/A/sub/a.md' },
    ]);
    const oldFile = document.querySelector('.workspace-file-item');
    const oldDir = document.querySelector('.workspace-dir-item');
    closeWorkspaceFolder();
    closed(2);
    opened('B', 3);
    window.specdown.requestWorkspaceFile.mockClear();
    oldFile.click();
    oldDir.click();
    expect(window.specdown.requestWorkspaceFile).not.toHaveBeenCalled();
    expect(document.querySelector('.workspace-file-item').textContent).toBe(
      'a.md'
    );
  });
  test('close barrier rejects a queued replacement snapshot until native acknowledgment', () => {
    opened('A', 1);
    closeWorkspaceFolder();
    opened('B', 2);
    deliver('B');
    expect(hasWorkspace()).toBe(false);
    expect(state.tabs).toHaveLength(0);
    closed(3);
    opened('C', 4);
    deliver('C');
    expect(hasWorkspace()).toBe(true);
    expect(state.tabs).toHaveLength(1);
  });
  test('repeated Close is idempotent until the native acknowledgment', () => {
    opened('A', 1);
    closeWorkspaceFolder();
    closeWorkspaceFolder();
    expect(window.specdown.requestCloseWorkspace).toHaveBeenCalledTimes(1);
    opened('B', 2);
    expect(hasWorkspace()).toBe(false);
    closed(3);
    opened('C', 4);
    expect(isCurrentWorkspaceFileOpen('C')).toBe(true);
  });
  test('late old close/open generations cannot remove or replace a newer folder', () => {
    opened('A', 1);
    closeWorkspaceFolder();
    closed(2);
    opened('B', 3);
    closed(2);
    opened('A', 1);
    expect(isCurrentWorkspaceFileOpen('B')).toBe(true);
  });
  test('queued file delivery from closed folder false-acknowledges without opening a tab', () => {
    opened();
    closeWorkspaceFolder();
    deliver('A');
    expect(state.tabs).toHaveLength(0);
    expect(window.specdown.reportFileOpenResult).toHaveBeenCalledWith(
      'receipt',
      false
    );
  });
  test('queued old file delivery is rejected after folder replacement', () => {
    opened('A', 1);
    opened('B', 2);
    deliver('A');
    expect(state.tabs).toHaveLength(0);
    deliver('B');
    expect(state.tabs).toHaveLength(1);
  });
  test('ordinary native/recent files remain accepted after closing a folder', () => {
    opened();
    closeWorkspaceFolder();
    window.specdown.onFileOpened.mock.calls[0][0]({
      filename: 'direct.md',
      filePath: '/direct.md',
      content: '# Ordinary',
      openReceipt: 'ordinary',
    });
    expect(state.tabs).toHaveLength(1);
    expect(window.specdown.reportFileOpenResult).toHaveBeenCalledWith(
      'ordinary',
      true
    );
  });
  test('an empty workspace is closable from the landing area and palette', () => {
    opened('empty', 1, []);
    expect(hasWorkspace()).toBe(true);
    expect(
      document.getElementById('close-folder-empty-button').style.display
    ).toBe('');
    expect(
      filterCommands(registry, 'close folder').some(
        (c) => c.id === 'close-folder'
      )
    ).toBe(true);
    document.getElementById('close-folder-empty-button').click();
    expect(hasWorkspace()).toBe(false);
    expect(
      filterCommands(registry, 'close folder').some(
        (c) => c.id === 'close-folder'
      )
    ).toBe(false);
  });
  test('header Close restores focus without changing the document', () => {
    opened();
    deliver('A');
    const button = document.getElementById('workspace-close-button');
    button.focus();
    button.click();
    expect(document.activeElement.id).toBe('overflow-toggle');
    expect(state.tabs).toHaveLength(1);
  });
  test('a native close acknowledgment does not steal focus from a newer dialog', () => {
    opened();
    closeWorkspaceFolder();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    closed(2);
    expect(document.activeElement).toBe(input);
  });
  test('relative navigation carries exact workspace identity and stops after Close', () => {
    opened();
    deliver('A');
    document.getElementById('markdown-content').innerHTML =
      '<a href="./b.md">B</a>';
    const link = document.querySelector('#markdown-content a');
    link.click();
    expect(window.specdown.requestOpenRelative).toHaveBeenCalledWith(
      '/A/a.md',
      './b.md',
      'A'
    );
    window.specdown.requestOpenRelative.mockClear();
    closeWorkspaceFolder();
    link.click();
    expect(window.specdown.requestOpenRelative).not.toHaveBeenCalled();
  });
});

describe('Close Folder web async lifecycle', () => {
  beforeEach(() => {
    window.showDirectoryPicker = jest.fn();
    loadHTML(document);
    loadApp(document);
  });
  test('close while picker awaits prevents its late result from opening a folder', async () => {
    const pending = deferred();
    window.showDirectoryPicker.mockReturnValue(pending.promise);
    const opening = openWorkspaceFolder();
    closeWorkspaceFolder();
    pending.resolve(webDir('old', [webFile('a.md')]));
    await opening;
    await tick();
    expect(hasWorkspace()).toBe(false);
    expect(state.tabs).toHaveLength(0);
  });
  test('newer picker wins even if earlier picker resolves last', async () => {
    const old = deferred();
    window.showDirectoryPicker
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(webDir('B', [webFile('b.md')]));
    const first = openWorkspaceFolder();
    await openWorkspaceFolder();
    await tick();
    old.resolve(webDir('A', [webFile('a.md')]));
    await first;
    await tick();
    expect(document.querySelector('.workspace-file-item').textContent).toBe(
      'b.md'
    );
    expect(state.tabs.map((t) => t.filename)).toEqual(['b.md']);
  });
  test('cancelled replacement leaves the existing folder usable', async () => {
    applyWorkspace({
      root: 'A',
      files: [{ name: 'a.md', relPath: 'a.md', handle: webFile('a.md') }],
    });
    await tick();
    window.showDirectoryPicker.mockRejectedValue(new Error('cancelled'));
    await openWorkspaceFolder();
    expect(hasWorkspace()).toBe(true);
    expect(document.querySelector('.workspace-file-item').textContent).toBe(
      'a.md'
    );
  });
  test('close invalidates a directory scan and its old failure toast', async () => {
    const scan = deferred();
    window.showDirectoryPicker.mockResolvedValue({
      name: 'A',
      async *values() {
        yield* [];
        await scan.promise;
        throw new Error('STALE_SCAN');
      },
    });
    const opening = openWorkspaceFolder();
    await tick();
    closeWorkspaceFolder();
    scan.resolve();
    await opening;
    expect(hasWorkspace()).toBe(false);
    expect(document.body.textContent).not.toContain(
      'Could not read the folder.'
    );
  });
  test('close consumes a pending dropped-directory handle without file fallback', async () => {
    const pending = deferred();
    const opening = tryOpenDroppedFolder({
      items: [{ kind: 'file', getAsFileSystemHandle: () => pending.promise }],
    });
    closeWorkspaceFolder();
    pending.resolve(webDir('A', [webFile('a.md')]));
    expect(await opening).toBe(true);
    expect(hasWorkspace()).toBe(false);
  });
  test('closed drop with a rejected late handle cannot trigger ordinary-file fallback', async () => {
    const pending = deferred();
    const opening = tryOpenDroppedFolder({
      items: [{ kind: 'file', getAsFileSystemHandle: () => pending.promise }],
    });
    closeWorkspaceFolder();
    pending.reject(new Error('stale handle'));
    expect(await opening).toBe(true);
    expect(state.tabs).toHaveLength(0);
  });
  test.each(['getFile', 'text'])(
    'close rejects late %s completion before tab admission',
    async (stage) => {
      const pending = deferred();
      const handle = webFile('a.md');
      handle.getFile.mockImplementation(() =>
        stage === 'getFile'
          ? pending.promise
          : Promise.resolve({ size: 4, text: () => pending.promise })
      );
      applyWorkspace({
        root: 'A',
        files: [{ name: 'a.md', relPath: 'a.md', handle }],
      });
      await tick();
      closeWorkspaceFolder();
      pending.resolve(
        stage === 'getFile' ? { size: 4, text: async () => '# A' } : '# A'
      );
      await tick();
      expect(state.tabs).toHaveLength(0);
    }
  );
  test('replacement invalidates pending old reads but preserves accepted old documents', async () => {
    applyWorkspace({
      root: 'A',
      files: [{ name: 'a.md', relPath: 'a.md', handle: webFile('a.md') }],
    });
    await tick();
    const pending = deferred();
    const handle = webFile('stale.md');
    handle.getFile.mockReturnValue(pending.promise);
    applyWorkspace({
      root: 'old',
      files: [{ name: 'stale.md', relPath: 'stale.md', handle }],
    });
    document.querySelector('.workspace-file-item').click();
    applyWorkspace({
      root: 'B',
      files: [{ name: 'b.md', relPath: 'b.md', handle: webFile('b.md') }],
    });
    pending.resolve({ size: 4, text: async () => '# X' });
    await tick();
    expect(state.tabs.map((t) => t.filename)).toEqual(['a.md']);
  });
  test('retained old tab cannot resolve links against a replacement folder', async () => {
    applyWorkspace({
      root: 'A',
      files: [{ name: 'a.md', relPath: 'a.md', handle: webFile('a.md') }],
    });
    await tick();
    const handle = webFile('b.md');
    applyWorkspace({
      root: 'B',
      files: [{ name: 'b.md', relPath: 'b.md', handle }],
    });
    document.getElementById('markdown-content').innerHTML =
      '<a href="./b.md">B</a>';
    document.querySelector('#markdown-content a').click();
    await tick();
    expect(handle.getFile).not.toHaveBeenCalled();
    expect(state.tabs).toHaveLength(1);
  });
  test.each(['close', 'replace'])(
    'retained workspace links never navigate the app after %s',
    async (action) => {
      applyWorkspace({
        root: 'A',
        files: [{ name: 'a.md', relPath: 'a.md', handle: webFile('a.md') }],
      });
      await tick();
      if (action === 'close') closeWorkspaceFolder();
      else
        applyWorkspace({
          root: 'B',
          files: [{ name: 'b.md', relPath: 'b.md', handle: webFile('b.md') }],
        });
      document.getElementById('markdown-content').innerHTML =
        '<a href="./b.md">B</a>';
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('#markdown-content a').dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(state.tabs).toHaveLength(1);
      expect(document.body.textContent).toContain(
        'Open this document from its folder'
      );
    }
  );
  test('retained workspace external, fragment and non-Markdown links keep normal routing', async () => {
    applyWorkspace({
      root: 'A',
      files: [{ name: 'a.md', relPath: 'a.md', handle: webFile('a.md') }],
    });
    await tick();
    closeWorkspaceFolder();
    for (const href of [
      'https://example.com/doc.md',
      '#section',
      'image.png',
    ]) {
      document.getElementById('markdown-content').innerHTML = '<a>link</a>';
      const link = document.querySelector('#markdown-content a');
      link.setAttribute('href', href);
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      handleWorkspaceLinkClick({
        target: link,
        preventDefault: () => click.preventDefault(),
      });
      expect(click.defaultPrevented).toBe(false);
    }
  });
  test('web command palette offers Close only while a folder is loaded', () => {
    expect(
      filterCommands(registry, 'open folder').some(
        (c) => c.id === 'open-folder'
      )
    ).toBe(true);
    applyWorkspace({ root: 'empty', files: [] });
    expect(
      filterCommands(registry, 'close folder').some(
        (c) => c.id === 'close-folder'
      )
    ).toBe(true);
    closeWorkspaceFolder();
    expect(hasWorkspace()).toBe(false);
  });
});
