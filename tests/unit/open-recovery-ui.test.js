const { loadHTML, loadApp } = require('../helpers/loadApp');

describe('native recovery rows', () => {
  const info = (id = 'first') => ({
    id,
    filename: '<script>same.md</script>',
    message: 'Could not open.',
    canForget: true,
  });
  const row = () => document.querySelector('.native-file-recovery');
  const click = (label) =>
    [...row().querySelectorAll('button')]
      .find((button) => button.textContent === label)
      .click();
  const flush = async () => {
    for (let n = 0; n < 6; n++) await Promise.resolve();
  };
  beforeEach(() => {
    loadHTML(document);
    window.specdown = { resolveFileOpenFailure: jest.fn(async () => true) };
    loadApp(document);
  });
  afterEach(() => {
    delete window.specdown;
  });

  test('multiple accessible failures use text content and preserve the visible document', () => {
    const content = document.getElementById('markdown-content');
    content.textContent = 'Accepted document and notes stay here';
    showOpenRecoveryRow(info());
    showOpenRecoveryRow(info('second'));
    expect(document.querySelectorAll('.native-file-recovery')).toHaveLength(2);
    expect(row().getAttribute('role')).toBe('status');
    expect(row().querySelector('script')).toBeNull();
    expect(content.textContent).toBe('Accepted document and notes stay here');
    expect(
      [...row().querySelectorAll('button')].map((button) => button.textContent)
    ).toEqual(['Locate…', 'Stop reopening', 'Dismiss']);
  });
  test('body clicks do not silently dismiss a recovery', () => {
    showOpenRecoveryRow(info());
    row().click();
    expect(row()).not.toBeNull();
    expect(window.specdown.resolveFileOpenFailure).not.toHaveBeenCalled();
  });
  test.each([
    ['Dismiss', 'dismiss'],
    ['Stop reopening', 'forget'],
  ])('%s sends only the exact opaque action', async (label, action) => {
    showOpenRecoveryRow(info());
    click(label);
    await flush();
    expect(window.specdown.resolveFileOpenFailure).toHaveBeenCalledWith({
      id: 'first',
      action,
    });
    expect(row()).toBeNull();
  });
  test('a failed write leaves recovery visible with truthful feedback', async () => {
    window.specdown.resolveFileOpenFailure.mockResolvedValue(false);
    showOpenRecoveryRow(info());
    click('Stop reopening');
    await flush();
    expect(row().textContent).toContain('saved file entry is unchanged');
    expect(row().querySelectorAll('button:disabled')).toHaveLength(0);
  });
  test('Locate cancellation keeps entry visible; successful picker still awaits native admission', async () => {
    window.specdown.resolveFileOpenFailure.mockResolvedValueOnce(false);
    showOpenRecoveryRow(info());
    click('Locate…');
    await flush();
    expect(row()).not.toBeNull();
    click('Locate…');
    await flush();
    expect(row()).not.toBeNull();
    resolveOpenRecoveryRow({ id: 'first' });
    expect(row()).toBeNull();
  });
  test('detached old controls cannot affect a replacement row with the same ID', async () => {
    showOpenRecoveryRow(info());
    const old = [...row().querySelectorAll('button')].find(
      (button) => button.textContent === 'Stop reopening'
    );
    showOpenRecoveryRow(info());
    old.click();
    await flush();
    expect(window.specdown.resolveFileOpenFailure).not.toHaveBeenCalled();
    expect(row()).not.toBeNull();
  });
  test('stale promise completion leaves a newly rendered recovery untouched', async () => {
    let finish;
    window.specdown.resolveFileOpenFailure.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    showOpenRecoveryRow(info());
    click('Stop reopening');
    showOpenRecoveryRow(info());
    finish(true);
    await flush();
    expect(row()).not.toBeNull();
  });
  test('a non-session failure has no Stop reopening action', () => {
    showOpenRecoveryRow({ ...info(), canForget: false });
    expect(row().textContent).not.toContain('Stop reopening');
  });
});

test('trusted preload forwards only recovery payloads, never Electron events', async () => {
  const fs = require('fs'),
    path = require('path'),
    vm = require('vm');
  const source = fs.readFileSync(
    path.join(__dirname, '../../desktop/preload.js'),
    'utf8'
  );
  const ipcRenderer = {
    on: jest.fn(),
    invoke: jest.fn(async () => true),
    send: jest.fn(),
  };
  const exposed = new Map();
  vm.runInNewContext(source, {
    require: () => ({
      contextBridge: {
        exposeInMainWorld: (key, value) => exposed.set(key, value),
      },
      ipcRenderer,
    }),
    location: { href: 'file:///synthetic/index.html' },
    process: {
      mas: true,
      platform: 'darwin',
      argv: ['--specdown-app-url=file:///synthetic/index.html'],
    },
    URL,
    module: { exports: {} },
  });
  const bridge = exposed.get('specdown');
  bridge.saveSession([]);
  expect(ipcRenderer.send).toHaveBeenLastCalledWith('save-session', [], null);
  const saveReady = ipcRenderer.on.mock.calls.find(
    ([name]) => name === 'session-save-ready'
  )[1];
  const nonce = '12345678-1234-1234-1234-123456789abc';
  saveReady({}, { token: nonce });
  bridge.saveSession([{ filePath: '/synthetic/a.md' }]);
  expect(ipcRenderer.send).toHaveBeenLastCalledWith(
    'save-session',
    [{ filePath: '/synthetic/a.md' }],
    nonce
  );
  expect(bridge.sessionSaveToken).toBeUndefined();

  const failed = jest.fn(),
    resolved = jest.fn();
  bridge.onFileOpenFailed(failed);
  bridge.onFileOpenRecoveryResolved(resolved);
  const notice = {
    id: 'opaque',
    filename: 'a.md',
    message: 'Unavailable',
    canForget: true,
  };
  ipcRenderer.on.mock.calls.find(([name]) => name === 'file-open-failed')[1](
    { secretEvent: true },
    notice
  );
  ipcRenderer.on.mock.calls.find(
    ([name]) => name === 'file-open-recovery-resolved'
  )[1]({ secretEvent: true }, { id: 'opaque' });
  expect(failed.mock.calls).toEqual([[notice]]);
  expect(resolved.mock.calls).toEqual([[{ id: 'opaque' }]]);
  expect(
    await bridge.resolveFileOpenFailure({ id: 'opaque', action: 'dismiss' })
  ).toBe(true);
  expect(ipcRenderer.invoke).toHaveBeenCalledWith('resolve-file-open-failure', {
    id: 'opaque',
    action: 'dismiss',
  });
});

test.each([true, false])(
  'path bookmark reports actual admission %s to native recovery',
  async (accepted) => {
    loadHTML(document);
    window.specdown = {
      readBookmarkedFile: jest.fn(async () => ({
        filename: 'a.md',
        filePath: '/synthetic/a.md',
        content: '# Accepted',
        openReceipt: 'native-receipt',
      })),
      reportFileOpenResult: jest.fn(),
    };
    try {
      loadApp(document);
      localStorage.setItem(
        'specdown-bookmarks-v1',
        JSON.stringify([
          {
            id: 'path-note',
            title: 'a',
            filename: 'a.md',
            type: 'path',
            ref: '/synthetic/a.md',
            savedAt: 1,
          },
        ])
      );
      configureBookmarks({ createTab: () => accepted, switchTab: () => {} });
      await recallBookmark('path-note');
      expect(window.specdown.reportFileOpenResult).toHaveBeenCalledWith(
        'native-receipt',
        accepted
      );
    } finally {
      delete window.specdown;
      localStorage.removeItem('specdown-bookmarks-v1');
    }
  }
);

test('superseded path-bookmark read consumes its receipt as rejected', async () => {
  loadHTML(document);
  let finish;
  window.specdown = {
    readBookmarkedFile: jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    ),
    reportFileOpenResult: jest.fn(),
  };
  try {
    loadApp(document);
    localStorage.setItem(
      'specdown-bookmarks-v1',
      JSON.stringify([
        {
          id: 'slow-path',
          title: 'slow',
          filename: 'slow.md',
          type: 'path',
          ref: '/synthetic/slow.md',
          savedAt: 1,
        },
      ])
    );
    const create = jest.fn(() => true);
    configureBookmarks({ createTab: create, switchTab: () => {} });
    const pending = recallBookmark('slow-path');
    await recallBookmark('nonexistent-supersedes-first');
    finish({
      filename: 'slow.md',
      filePath: '/synthetic/moved.md',
      content: '# Slow',
      openReceipt: 'slow-receipt',
    });
    await pending;
    expect(create).not.toHaveBeenCalled();
    expect(window.specdown.reportFileOpenResult).toHaveBeenCalledWith(
      'slow-receipt',
      false
    );
  } finally {
    delete window.specdown;
    localStorage.removeItem('specdown-bookmarks-v1');
  }
});
