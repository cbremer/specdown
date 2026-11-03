// Actual main/receipt/access modules; only native APIs and disposable fixture
// files are substituted. No user's session, bookmark store or document is read.
jest.mock('electron', () => ({
  app: {
    name: 'SpecDown',
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    getPath: jest.fn(),
    getVersion: jest.fn(() => '1.0.1'),
    addRecentDocument: jest.fn(),
    isPackaged: false,
  },
  BrowserWindow: Object.assign(jest.fn(), { getAllWindows: jest.fn(() => []) }),
  Menu: {
    buildFromTemplate: jest.fn((value) => value),
    setApplicationMenu: jest.fn(),
    getApplicationMenu: jest.fn(() => null),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showMessageBox: jest.fn(),
    showErrorBox: jest.fn(),
  },
  ipcMain: { on: jest.fn(), handle: jest.fn() },
  globalShortcut: { register: jest.fn(), unregisterAll: jest.fn() },
  shell: { openExternal: jest.fn() },
}));
jest.mock('chokidar', () => ({ watch: jest.fn() }));
jest.mock('../../desktop/mas-access', () => ({
  ...jest.requireActual('../../desktop/mas-access'),
  loadMasNative: () => null,
}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { EventEmitter } = require('events');

describe.each([false, true])('startup delivery (MAS=%s)', (mas) => {
  let root,
    electron,
    main,
    wc,
    window,
    originalMas,
    listeners,
    sessionPath,
    cssPath;
  const docs = () =>
    wc.mainFrame.send.mock.calls.filter(([name]) => name === 'file-opened');
  const stopLoading = () => {
    wc.isLoadingMainFrame.mockReturnValue(false);
    wc.emit('did-stop-loading');
  };
  const navigation = () =>
    wc.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: false,
    });

  beforeEach(async () => {
    listeners = new Map(
      ['uncaughtException', 'unhandledRejection'].map((name) => [
        name,
        new Set(process.listeners(name)),
      ])
    );
    originalMas = process.mas;
    process.mas = mas;
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    electron = require('electron');
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-startup-'));
    sessionPath = path.join(root, 'session.md');
    cssPath = path.join(root, 'theme.css');
    fs.writeFileSync(sessionPath, '# Session');
    fs.writeFileSync(cssPath, 'body { color: teal; }');
    fs.writeFileSync(
      path.join(root, 'specdown-state.json'),
      JSON.stringify({
        session: { tabs: [{ filePath: sessionPath, filename: 'session.md' }] },
        customCssPath: cssPath,
      })
    );
    electron.app.getPath.mockReturnValue(root);
    wc = new EventEmitter();
    wc.mainFrame = { url: '', detached: false, send: jest.fn() };
    wc.send = jest.fn();
    wc.isDestroyed = jest.fn(() => false);
    wc.isLoadingMainFrame = jest.fn(() => true);
    wc.setWindowOpenHandler = jest.fn();
    wc.session = { webRequest: { onBeforeRequest: jest.fn() } };
    window = new EventEmitter();
    window.webContents = wc;
    window.loadFile = jest.fn((file) => {
      // Even a synchronous start must be observed, before the first finish.
      expect(wc.listenerCount('did-finish-load')).toBeGreaterThan(0);
      expect(wc.listenerCount('did-stop-loading')).toBeGreaterThan(0);
      wc.mainFrame.url = pathToFileURL(file).href;
      navigation();
    });
    electron.BrowserWindow.mockImplementation(() => window);
    main = require('../../desktop/main');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    main.fileAccess.noteUserIntent(sessionPath, 'file');
    main.fileAccess.noteUserIntent(cssPath, 'file');
    expect(electron.dialog.showErrorBox).not.toHaveBeenCalled();
  });

  afterEach(() => {
    wc.emit('destroyed');
    electron.app.on.mock.calls.find(([name]) => name === 'will-quit')[1]();
    fs.rmSync(root, { recursive: true, force: true });
    console.log.mockRestore();
    process.mas = originalMas;
    for (const [name, previous] of listeners) {
      for (const listener of process.listeners(name)) {
        if (!previous.has(listener)) process.removeListener(name, listener);
      }
    }
  });

  const saved = () =>
    JSON.parse(fs.readFileSync(path.join(root, 'specdown-state.json'), 'utf8'));
  const ipc = (name) =>
    electron.ipcMain.on.mock.calls.find(([channel]) => channel === name)[1];
  const event = () => ({ sender: wc, senderFrame: wc.mainFrame });
  const sessionToken = () =>
    wc.mainFrame.send.mock.calls
      .filter(([name]) => name === 'session-save-ready')
      .at(-1)[1].token;
  const saveTabs = (tabs, token = sessionToken()) =>
    ipc('save-session')(event(), tabs, token);
  const ready = () => {
    wc.emit('did-finish-load');
    stopLoading();
  };
  const failures = () =>
    wc.mainFrame.send.mock.calls
      .filter(([name]) => name === 'file-open-failed')
      .map(([, value]) => value);

  test('unavailable startup file produces visible recovery without an admitted tab or recent', () => {
    fs.unlinkSync(sessionPath);
    ready();
    expect(failures()).toHaveLength(1);
    expect(failures()[0]).toMatchObject({
      filename: 'session.md',
      canForget: true,
    });
    expect(failures()[0].filePath).toBeUndefined();
    expect(docs()).toHaveLength(0);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  });

  test('saving accepted tabs does not discard an unavailable startup reference', () => {
    fs.unlinkSync(sessionPath);
    ready();
    saveTabs([]);
    expect(saved().session.tabs).toEqual([
      { filePath: sessionPath, filename: 'session.md' },
    ]);
  });

  test('rejected renderer admission keeps startup reference after its earlier save', () => {
    ready();
    saveTabs([]);
    ipc('file-open-result')(event(), {
      receipt: docs()[0][1].openReceipt,
      accepted: false,
    });
    expect(saved().session.tabs).toEqual([
      { filePath: sessionPath, filename: 'session.md' },
    ]);
    expect(failures()).toHaveLength(1);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  });

  test('accepted document still requires strict acknowledgment for recents', () => {
    ready();
    expect(docs()).toHaveLength(1);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
    ipc('file-open-result')(event(), {
      receipt: docs()[0][1].openReceipt,
      accepted: true,
    });
    expect(electron.app.addRecentDocument).toHaveBeenCalledWith(sessionPath);
  });
  const action = (request) =>
    electron.ipcMain.handle.mock.calls.find(
      ([channel]) => channel === 'resolve-file-open-failure'
    )[1](event(), request);

  test('an oversized native open and manual refresh show the size limit without file-changed or recents', () => {
    ready();
    wc.mainFrame.send.mockClear();
    wc.send.mockClear();
    const fd = fs.openSync(sessionPath, 'w');
    fs.ftruncateSync(fd, main.MAX_DOCUMENT_BYTES + 1);
    fs.closeSync(fd);
    const finder = electron.app.on.mock.calls.find(
      ([name]) => name === 'open-file'
    )[1];
    finder({ preventDefault() {} }, sessionPath);
    expect(failures()).toHaveLength(1);
    expect(failures()[0].message).toContain('8 MiB');
    expect(docs()).toHaveLength(0);
    ipc('refresh-file')(event(), sessionPath);
    expect(failures()).toHaveLength(2);
    expect(wc.send.mock.calls.some(([name]) => name === 'file-changed')).toBe(
      false
    );
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  });

  test('native Stop reopening persists exactly one missing reference and keeps unrelated state', async () => {
    fs.unlinkSync(sessionPath);
    ready();
    const before = saved();
    expect(await action({ id: failures()[0].id, action: 'forget' })).toBe(true);
    expect(saved()).toEqual(
      expect.objectContaining({
        ...before,
        session: { ...before.session, tabs: [] },
      })
    );
    expect(fs.existsSync(sessionPath)).toBe(false);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  });

  test('failed disk persistence keeps original session bytes and the recovery remains retryable', async () => {
    fs.unlinkSync(sessionPath);
    ready();
    const before = fs.readFileSync(
      path.join(root, 'specdown-state.json'),
      'utf8'
    );
    const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('synthetic disk full');
    });
    const request = { id: failures()[0].id, action: 'forget' };
    expect(await action(request)).toBe(false);
    expect(
      fs.readFileSync(path.join(root, 'specdown-state.json'), 'utf8')
    ).toBe(before);
    rename.mockRestore();
    expect(await action(request)).toBe(true);
    expect(saved().session.tabs).toEqual([]);
  });

  test('Locate cancellation and navigation during the native picker cannot record a new grant', async () => {
    fs.unlinkSync(sessionPath);
    ready();
    const id = failures()[0].id;
    electron.dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    expect(await action({ id, action: 'locate' })).toBe(false);
    expect(saved().session.tabs).toHaveLength(1);
    const picked = path.join(root, 'picked.md');
    fs.writeFileSync(picked, '# Selected later');
    let finishPicker;
    electron.dialog.showOpenDialog.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPicker = resolve;
        })
    );
    const pending = action({ id, action: 'locate' });
    navigation();
    finishPicker({ canceled: false, filePaths: [picked] });
    expect(await pending).toBe(false);
    expect(main.fileAccess.hasGrant(picked)).toBe(false);
    expect(docs()).toHaveLength(0);
    expect(saved().session.tabs).toHaveLength(1);
  });

  test('Locate grants only the selected replacement and keeps old reference until accepted', async () => {
    fs.unlinkSync(sessionPath);
    ready();
    const id = failures()[0].id;
    const picked = path.join(root, 'replacement.md');
    fs.writeFileSync(picked, '# Replacement');
    electron.dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [picked],
    });
    expect(await action({ id, action: 'locate' })).toBe(true);
    expect(main.fileAccess.hasGrant(picked)).toBe(true);
    saveTabs([{ filePath: picked, filename: 'replacement.md' }]);
    expect(saved().session.tabs.map((tab) => tab.filePath)).toEqual([
      picked,
      sessionPath,
    ]);
    ipc('file-open-result')(event(), {
      receipt: docs().at(-1)[1].openReceipt,
      accepted: true,
    });
    expect(saved().session.tabs).toEqual([
      { filePath: picked, filename: 'replacement.md' },
    ]);
    expect(await action({ id, action: 'forget' })).toBe(false);
    expect(fs.readFileSync(picked, 'utf8')).toBe('# Replacement');
  });
  test('queued trusted save during navigation or process loss cannot erase failed startup references', () => {
    fs.unlinkSync(sessionPath);
    ready();
    const before = fs.readFileSync(
      path.join(root, 'specdown-state.json'),
      'utf8'
    );
    navigation();
    saveTabs([]);
    expect(
      fs.readFileSync(path.join(root, 'specdown-state.json'), 'utf8')
    ).toBe(before);
    wc.emit('render-process-gone');
    saveTabs([]);
    expect(
      fs.readFileSync(path.join(root, 'specdown-state.json'), 'utf8')
    ).toBe(before);
  });
  test('new ready generation rejects an old queued save even if the native frame is reused', () => {
    fs.unlinkSync(sessionPath);
    ready();
    const old = sessionToken();
    navigation();
    wc.emit('did-finish-load');
    const before = fs.readFileSync(
      path.join(root, 'specdown-state.json'),
      'utf8'
    );
    expect(sessionToken()).not.toBe(old);
    saveTabs([], old);
    expect(
      fs.readFileSync(path.join(root, 'specdown-state.json'), 'utf8')
    ).toBe(before);
    saveTabs([]);
    expect(saved().session.tabs).toHaveLength(1);
  });
  test('closed window callbacks lose recovery and save authority before webContents destruction', async () => {
    fs.unlinkSync(sessionPath);
    ready();
    const id = failures()[0].id,
      token = sessionToken();
    const before = fs.readFileSync(
      path.join(root, 'specdown-state.json'),
      'utf8'
    );
    window.emit('closed');
    expect(await action({ id, action: 'forget' })).toBe(false);
    saveTabs([], token);
    expect(
      fs.readFileSync(path.join(root, 'specdown-state.json'), 'utf8')
    ).toBe(before);
  });

  test('session authority is delivered before any cold Finder or restored file', () => {
    const finder = electron.app.on.mock.calls.find(
      ([name]) => name === 'open-file'
    )[1];
    finder({ preventDefault() {} }, sessionPath);
    ready();
    const channels = wc.mainFrame.send.mock.calls.map(([name]) => name);
    expect(channels.indexOf('session-save-ready')).toBeLessThan(
      channels.indexOf('file-opened')
    );
  });
  test('accepted bookmark reopening clears obsolete recovery without changing its grant', async () => {
    fs.unlinkSync(sessionPath);
    ready();
    const id = failures()[0].id;
    fs.writeFileSync(sessionPath, '# Returned');
    const read = electron.ipcMain.handle.mock.calls.find(
      ([name]) => name === 'read-bookmarked-file'
    )[1];
    const file = await read(event(), sessionPath);
    expect(file).toMatchObject({
      content: '# Returned',
      openReceipt: expect.any(String),
    });
    saveTabs([{ filePath: sessionPath, filename: 'session.md' }]);
    ipc('file-open-result')(event(), {
      receipt: file.openReceipt,
      accepted: true,
    });
    expect(await action({ id, action: 'forget' })).toBe(false);
    // Closing the accepted bookmark tab now actually removes its startup entry.
    saveTabs([]);
    expect(saved().session.tabs).toEqual([]);
    expect(main.fileAccess.hasGrant(sessionPath)).toBe(true);
    expect(fs.readFileSync(sessionPath, 'utf8')).toBe('# Returned');
  });
});
