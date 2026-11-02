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
    fs.rmSync(root, { recursive: true, force: true });
    console.log.mockRestore();
    process.mas = originalMas;
    for (const [name, previous] of listeners) {
      for (const listener of process.listeners(name)) {
        if (!previous.has(listener)) process.removeListener(name, listener);
      }
    }
  });

  test('successful finish waits for stop, restores once, and still requires strict ACK', () => {
    wc.emit('did-finish-load');
    wc.emit('did-stop-loading');
    expect(docs()).toHaveLength(0);
    expect(wc.send).not.toHaveBeenCalled();
    stopLoading();
    expect(docs()).toHaveLength(1);
    expect(wc.send.mock.calls).toEqual([
      ['apply-custom-css', 'body { color: teal; }'],
    ]);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
    const ack = electron.ipcMain.on.mock.calls.find(
      ([name]) => name === 'file-open-result'
    )[1];
    const event = { sender: wc, senderFrame: wc.mainFrame };
    const receipt = docs()[0][1].openReceipt;
    ack(event, { receipt, accepted: 'true' });
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
    ack(event, { receipt, accepted: true });
    expect(electron.app.addRecentDocument.mock.calls).toEqual([[sessionPath]]);
    wc.emit('did-finish-load');
    wc.emit('did-stop-loading');
    expect(docs()).toHaveLength(1);
    expect(wc.send).toHaveBeenCalledTimes(1);
  });

  test('an already nonloading successful finish restores immediately; genuine reload restores once again', () => {
    wc.isLoadingMainFrame.mockReturnValue(false);
    wc.emit('did-finish-load');
    expect(docs()).toHaveLength(1);
    navigation();
    wc.isLoadingMainFrame.mockReturnValue(true);
    wc.emit('did-finish-load');
    expect(docs()).toHaveLength(1);
    stopLoading();
    expect(docs()).toHaveLength(2);
  });

  test.each([
    'navigation',
    'replaced-frame',
    'detached',
    'crash',
    'closed',
    'destroyed',
    'failed',
  ])('%s before stop cancels the previous successful finish', (change) => {
    wc.emit('did-finish-load');
    if (change === 'navigation') navigation();
    if (change === 'replaced-frame')
      wc.mainFrame = { ...wc.mainFrame, send: jest.fn() };
    if (change === 'detached') wc.mainFrame.detached = true;
    if (change === 'crash') wc.emit('render-process-gone');
    if (change === 'closed') window.emit('closed');
    if (change === 'destroyed') {
      wc.isDestroyed.mockReturnValue(true);
      wc.emit('destroyed');
    }
    if (change === 'failed')
      wc.emit('did-fail-load', {}, -2, 'failed', main.APP_INDEX_URL, true);
    stopLoading();
    expect(docs()).toHaveLength(0);
    expect(wc.send).not.toHaveBeenCalled();
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  });

  test('failed-load stop without a successful finish cannot restore', () => {
    wc.emit('did-fail-load', {}, -2, 'failed', main.APP_INDEX_URL, true);
    stopLoading();
    expect(docs()).toHaveLength(0);
    expect(wc.send).not.toHaveBeenCalled();
  });

  test('subframe and same-document events do not cancel a pending successful finish', () => {
    wc.emit('did-finish-load');
    wc.emit('did-start-navigation', {
      isMainFrame: false,
      isSameDocument: false,
    });
    wc.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: true,
    });
    wc.emit('did-fail-load', {}, -2, 'child failed', 'about:blank', false);
    stopLoading();
    expect(docs()).toHaveLength(1);
  });

  test('Finder open while loading retains its grant and queues the document until successful stop', () => {
    const file = path.join(root, 'finder.md');
    fs.writeFileSync(file, '# Finder');
    const finder = electron.app.on.mock.calls.find(
      ([name]) => name === 'open-file'
    )[1];
    finder({ preventDefault: jest.fn() }, file);
    expect(main.fileAccess.hasGrant(file)).toBe(true);
    expect(docs()).toHaveLength(0);
    wc.emit('did-finish-load');
    stopLoading();
    expect(docs().map(([, data]) => data.filename)).toEqual([
      'finder.md',
      'session.md',
    ]);
    wc.emit('did-stop-loading');
    expect(docs()).toHaveLength(2);
  });

  test('teardown exceptions fail closed in the startup drain and Finder readiness', () => {
    wc.emit('did-finish-load');
    wc.isLoadingMainFrame.mockImplementation(() => {
      throw new Error('destroyed');
    });
    expect(() => wc.emit('did-stop-loading')).not.toThrow();
    expect(docs()).toHaveLength(0);
    wc.isLoadingMainFrame.mockImplementation(() => false);
    wc.emit('did-stop-loading');
    expect(docs()).toHaveLength(1);
    const file = path.join(root, 'late.md');
    fs.writeFileSync(file, '# Later');
    const finder = electron.app.on.mock.calls.find(
      ([name]) => name === 'open-file'
    )[1];
    wc.isLoadingMainFrame.mockImplementation(() => {
      throw new Error('gone');
    });
    expect(() => finder({ preventDefault: jest.fn() }, file)).not.toThrow();
    expect(docs()).toHaveLength(1);
    navigation();
    wc.emit('did-finish-load');
    wc.isLoadingMainFrame.mockImplementation(() => false);
    wc.emit('did-stop-loading');
    expect(docs().map(([, data]) => data.filename)).toEqual([
      'session.md',
      'late.md',
      'session.md',
    ]);
  });

  test.each(['closed', 'destroyed'])(
    '%s cleanup does not read the destroyed BrowserWindow webContents getter',
    (event) => {
      wc.emit('did-finish-load');
      main.workspaceRoots.add(root);
      Object.defineProperty(window, 'webContents', {
        get() {
          throw new Error('Object has been destroyed');
        },
      });
      expect(() =>
        (event === 'closed' ? window : wc).emit(event)
      ).not.toThrow();
      expect(main.workspaceRoots.size).toBe(0);
      expect(wc.listenerCount('did-stop-loading')).toBe(0);
      expect(wc.listenerCount('did-finish-load')).toBe(0);
      stopLoading();
      expect(docs()).toHaveLength(0);
    }
  );
});
