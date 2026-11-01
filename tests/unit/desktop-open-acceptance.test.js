// Real main-process routing with only Electron/OS surfaces mocked. Every file
// and persisted state path below belongs to a disposable synthetic directory.
jest.mock('electron', () => ({
  app: {
    name: 'SpecDown',
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    getPath: jest.fn(),
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

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const electron = require('electron');
let acceptanceRoot;
let acceptanceWindow;
let acceptanceMain;
let acceptanceWc;
let acceptanceProcessListeners;
const acceptanceHandler = (channel) =>
  electron.ipcMain.on.mock.calls.find(([name]) => name === channel)?.[1];
const acceptanceEvent = () => ({
  sender: acceptanceWc,
  senderFrame: acceptanceWc.mainFrame,
});
const recentState = () => {
  const location = path.join(acceptanceRoot, 'specdown-state.json');
  return fs.existsSync(location)
    ? JSON.parse(fs.readFileSync(location, 'utf8')).recentFiles
    : [];
};
function deliverSyntheticOpen(name = 'A', content = '# Accepted') {
  const filePath = path.join(acceptanceRoot, `${name}.md`);
  fs.writeFileSync(filePath, content);
  acceptanceMain.fileAccess.noteUserIntent(filePath, 'file');
  acceptanceHandler('request-open-path')(acceptanceEvent(), filePath);
  return {
    filePath,
    payload: acceptanceWc.mainFrame.send.mock.calls.at(-1)?.[1],
  };
}
function acknowledge(payload, accepted, event = acceptanceEvent()) {
  acceptanceHandler('file-open-result')?.(event, {
    receipt: payload?.openReceipt,
    accepted,
  });
}

beforeEach(async () => {
  acceptanceProcessListeners = new Map(
    ['uncaughtException', 'unhandledRejection'].map((name) => [
      name,
      new Set(process.listeners(name)),
    ])
  );
  jest.resetModules();
  jest.clearAllMocks();
  // resetModules gives main.js fresh state; retain the new Electron mock too.
  Object.assign(electron, require('electron'));
  jest.spyOn(console, 'log').mockImplementation(() => {});
  acceptanceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-open-ack-'));
  const sessionPath = path.join(acceptanceRoot, 'session.md');
  fs.writeFileSync(sessionPath, '# Session');
  fs.writeFileSync(
    path.join(acceptanceRoot, 'specdown-state.json'),
    JSON.stringify({
      session: { tabs: [{ filePath: sessionPath, filename: 'session.md' }] },
    })
  );
  electron.app.getPath.mockReturnValue(acceptanceRoot);
  acceptanceWc = new EventEmitter();
  acceptanceWc.mainFrame = { url: '', detached: false, send: jest.fn() };
  acceptanceWc.send = jest.fn();
  acceptanceWc.isDestroyed = jest.fn(() => false);
  acceptanceWc.isLoadingMainFrame = jest.fn(() => false);
  acceptanceWc.setWindowOpenHandler = jest.fn();
  acceptanceWc.session = { webRequest: { onBeforeRequest: jest.fn() } };
  acceptanceWindow = new EventEmitter();
  acceptanceWindow.webContents = acceptanceWc;
  acceptanceWindow.loadFile = jest.fn();
  electron.BrowserWindow.mockImplementation(() => acceptanceWindow);
  acceptanceMain = require('../../desktop/main');
  acceptanceWc.mainFrame.url = acceptanceMain.APP_INDEX_URL;
  for (let i = 0; i < 8; i++) await Promise.resolve();
  acceptanceMain.fileAccess.noteUserIntent(sessionPath, 'file');
});
afterEach(() => {
  acceptanceWc.emit('destroyed');
  fs.rmSync(acceptanceRoot, { recursive: true, force: true });
  console.log.mockRestore();
  for (const [name, previous] of acceptanceProcessListeners) {
    for (const listener of process.listeners(name))
      if (!previous.has(listener)) process.removeListener(name, listener);
  }
});

test('positive control: bounded read still returns the authorized synthetic document', () => {
  const filePath = path.join(acceptanceRoot, 'control.md');
  fs.writeFileSync(filePath, '# Control');
  expect(acceptanceMain.readMarkdownFile(filePath)).toEqual({
    filename: 'control.md',
    content: '# Control',
    filePath,
  });
});

test('did-finish-load restores a session but commits its recents only after admission', () => {
  acceptanceWc.emit('did-finish-load');
  const payload = acceptanceWc.mainFrame.send.mock.calls.at(-1)?.[1];
  expect(payload.filename).toBe('session.md');
  expect(recentState()).toEqual([]);
  acknowledge(payload, true);
  expect(recentState()).toEqual([path.join(acceptanceRoot, 'session.md')]);
});

test('a readable rejected document changes neither native nor OS recents', () => {
  const { payload } = deliverSyntheticOpen('Rejected', 'x'.repeat(65537));
  expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  expect(recentState()).toEqual([]);
  acknowledge(payload, false);
  expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  expect(recentState()).toEqual([]);
});

test('only a delivered strict acceptance commits the main-held path once', () => {
  const { filePath, payload } = deliverSyntheticOpen();
  expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  acknowledge(payload, true);
  acknowledge(payload, true);
  expect(electron.app.addRecentDocument).toHaveBeenCalledTimes(1);
  expect(electron.app.addRecentDocument).toHaveBeenCalledWith(filePath);
  expect(recentState()).toEqual([filePath]);
});

test('rejected B does not suppress a delayed acceptance of A', () => {
  const a = deliverSyntheticOpen('A');
  const b = deliverSyntheticOpen('B');
  acknowledge(b.payload, false);
  acknowledge(a.payload, true);
  expect(electron.app.addRecentDocument.mock.calls).toEqual([[a.filePath]]);
  expect(recentState()).toEqual([a.filePath]);
});

test.each(['navigation', 'process-gone', 'destroyed', 'closed'])(
  '%s invalidates outstanding receipts',
  (reason) => {
    const { payload } = deliverSyntheticOpen();
    electron.app.addRecentDocument.mockClear();
    if (reason === 'navigation')
      acceptanceWc.emit('did-start-navigation', {
        isMainFrame: true,
        isSameDocument: false,
      });
    if (reason === 'process-gone') acceptanceWc.emit('render-process-gone');
    if (reason === 'destroyed') acceptanceWc.emit('destroyed');
    if (reason === 'closed') acceptanceWindow.emit('closed');
    acknowledge(payload, true);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
    expect(recentState()).toEqual([]);
  }
);

test('subframe and same-document navigation preserve the valid open', () => {
  const { filePath, payload } = deliverSyntheticOpen();
  acceptanceWc.emit('did-start-navigation', {
    isMainFrame: false,
    isSameDocument: false,
  });
  acceptanceWc.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: true,
  });
  acknowledge(payload, true);
  expect(recentState()).toEqual([filePath]);
});

test('wrong window, subframe, null sender, and changed current frame cannot use a receipt', () => {
  const { filePath, payload } = deliverSyntheticOpen();
  const frame = acceptanceWc.mainFrame;
  const otherFrame = { url: acceptanceMain.APP_INDEX_URL };
  acknowledge(payload, true, {
    sender: { mainFrame: frame },
    senderFrame: frame,
  });
  acknowledge(payload, true, { sender: acceptanceWc, senderFrame: otherFrame });
  acknowledge(payload, true, { sender: acceptanceWc, senderFrame: null });
  acceptanceWc.mainFrame = otherFrame;
  acknowledge(payload, true, { sender: acceptanceWc, senderFrame: frame });
  expect(recentState()).toEqual([]);
  acceptanceWc.mainFrame = frame;
  acknowledge(payload, true);
  expect(recentState()).toEqual([filePath]);
});

test.each([undefined, null, 'true', 1, {}, []])(
  'non-boolean acceptance %p never commits',
  (value) => {
    const { payload } = deliverSyntheticOpen();
    acknowledge(payload, value);
    expect(recentState()).toEqual([]);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  }
);

test('false consumes the receipt, and a forged path cannot replace its authorized path', () => {
  const rejected = deliverSyntheticOpen('Rejected');
  acknowledge(rejected.payload, false);
  acknowledge(rejected.payload, true);
  const accepted = deliverSyntheticOpen('Accepted');
  acceptanceHandler('file-open-result')(acceptanceEvent(), {
    receipt: accepted.payload.openReceipt,
    accepted: true,
    filePath: '/private/not-selected.md',
  });
  expect(recentState()).toEqual([accepted.filePath]);
  expect(electron.app.addRecentDocument.mock.calls).toEqual([
    [accepted.filePath],
  ]);
});

test('ACK itself does not probe, reread, or grant a file', () => {
  const { payload } = deliverSyntheticOpen();
  const stat = jest.spyOn(fs, 'statSync');
  const open = jest.spyOn(fs, 'openSync');
  const grant = jest.spyOn(acceptanceMain.fileAccess, 'noteUserIntent');
  // State persistence writes use fs.openSync too: block store writes to isolate
  // the receipt's authority, while the OS-recents mock still observes commit.
  const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  const rename = jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
  try {
    acknowledge(payload, true);
    expect(stat).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
    expect(electron.app.addRecentDocument).toHaveBeenCalledTimes(1);
  } finally {
    stat.mockRestore();
    open.mockRestore();
    grant.mockRestore();
    write.mockRestore();
    rename.mockRestore();
  }
});

test.each(['send-throws', 'detached', 'loading', 'destroyed'])(
  'missing delivery (%s) never records recents',
  (reason) => {
    if (reason === 'send-throws')
      acceptanceWc.mainFrame.send.mockImplementation(() => {
        throw new Error('Gone');
      });
    if (reason === 'detached') acceptanceWc.mainFrame.detached = true;
    if (reason === 'loading')
      acceptanceWc.isLoadingMainFrame.mockReturnValue(true);
    if (reason === 'destroyed') acceptanceWc.isDestroyed.mockReturnValue(true);
    const { payload } = deliverSyntheticOpen();
    acknowledge(payload, true);
    expect(recentState()).toEqual([]);
    expect(electron.app.addRecentDocument).not.toHaveBeenCalled();
  }
);
