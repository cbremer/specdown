// Real main routing; only Electron/OS surfaces and throwaway file state mocked.
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
let native, main, wc, win, temp, rootA, rootB, processListeners;
const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const handler = (channel) =>
  native.ipcMain.on.mock.calls.find(([name]) => channel === name)[1];
const event = () => ({ sender: wc, senderFrame: wc.mainFrame });
const sent = (channel) =>
  wc.mainFrame.send.mock.calls.filter(([name]) => name === channel).at(-1)?.[1];
const token = () => sent('workspace-ready').token;
const request = (channel, fields = {}, sender = event()) =>
  handler(channel)(sender, { ...fields, pageToken: token() });
function open(root = rootA) {
  main.fileAccess.noteUserIntent(root, 'folder');
  main.openWorkspace(root);
  return sent('workspace-opened');
}
beforeEach(async () => {
  processListeners = new Map(
    ['uncaughtException', 'unhandledRejection'].map((name) => [
      name,
      new Set(process.listeners(name)),
    ])
  );
  jest.resetModules();
  jest.clearAllMocks();
  native = require('electron');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-close-workspace-'));
  rootA = path.join(temp, 'A');
  rootB = path.join(temp, 'B');
  for (const root of [rootA, rootB]) {
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'a.md'), '# A');
  }
  native.app.getPath.mockReturnValue(temp);
  wc = new EventEmitter();
  wc.mainFrame = { url: '', detached: false, send: jest.fn() };
  wc.send = jest.fn();
  wc.isDestroyed = jest.fn(() => false);
  wc.isLoadingMainFrame = jest.fn(() => false);
  wc.setWindowOpenHandler = jest.fn();
  wc.session = { webRequest: { onBeforeRequest: jest.fn() } };
  win = new EventEmitter();
  win.webContents = wc;
  win.loadFile = jest.fn();
  native.BrowserWindow.mockImplementation(() => win);
  main = require('../../desktop/main');
  wc.mainFrame.url = main.APP_INDEX_URL;
  for (let i = 0; i < 8; i++) await Promise.resolve();
  wc.emit('did-finish-load');
});
afterEach(() => {
  wc.emit('destroyed');
  fs.rmSync(temp, { recursive: true, force: true });
  console.log.mockRestore();
  for (const [object, key] of [
    [fs, 'openSync'],
    [fs, 'readdirSync'],
    [main.fileAccess, 'forget'],
    [main.fileAccess, 'withAccess'],
    [main.fileAccess, 'noteUserIntent'],
  ]) {
    if (jest.isMockFunction(object[key])) object[key].mockRestore();
  }
  for (const [name, previous] of processListeners)
    for (const listener of process.listeners(name))
      if (!previous.has(listener)) process.removeListener(name, listener);
});

test('Close clears navigation but retains exact saved grants and document store', () => {
  const current = open();
  const statePath = path.join(temp, 'specdown-state.json');
  const before = fs.readFileSync(statePath, 'utf8');
  const forget = jest.spyOn(main.fileAccess, 'forget');
  request('request-close-workspace');
  expect(main.workspaceRoots.size).toBe(0);
  expect(sent('workspace-closed').generation).toBeGreaterThan(
    current.generation
  );
  expect(main.fileAccess.hasGrant(path.join(rootA, 'a.md'))).toBe(true);
  expect(fs.readFileSync(statePath, 'utf8')).toBe(before);
  expect(forget).not.toHaveBeenCalled();
});
test('replacement retains only one active navigation root and preserves prior file grants', () => {
  const first = open();
  const second = open(rootB);
  expect([...main.workspaceRoots]).toEqual([rootB]);
  expect(first.id).not.toBe(second.id);
  expect(main.fileAccess.hasGrant(path.join(rootA, 'a.md'))).toBe(true);
});
test('cancelled folder picker preserves the prior active context', async () => {
  const before = open();
  native.dialog.showOpenDialog.mockResolvedValue({
    canceled: true,
    filePaths: [],
  });
  await main.showOpenFolderDialog();
  expect(sent('workspace-opened')).toEqual(before);
  expect([...main.workspaceRoots]).toEqual([rootA]);
});
test('Close invalidates pending native picker before it grants or scans the selected folder', async () => {
  open();
  const pending = defer();
  native.dialog.showOpenDialog.mockReturnValue(pending.promise);
  const opening = main.showOpenFolderDialog();
  const grant = jest.spyOn(main.fileAccess, 'noteUserIntent');
  request('request-close-workspace');
  pending.resolve({ canceled: false, filePaths: [rootB] });
  await opening;
  expect(grant).not.toHaveBeenCalled();
  expect(main.workspaceRoots.size).toBe(0);
});
test('newer picker wins when the previous result arrives last', async () => {
  const old = defer();
  native.dialog.showOpenDialog
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ canceled: false, filePaths: [rootB] });
  const first = main.showOpenFolderDialog();
  await main.showOpenFolderDialog();
  old.resolve({ canceled: false, filePaths: [rootA] });
  await first;
  expect([...main.workspaceRoots]).toEqual([rootB]);
  expect(main.fileAccess.hasGrant(path.join(rootA, 'a.md'))).toBe(false);
});
test.each(['navigation', 'crash', 'closed'])(
  'pending picker cannot mutate after %s',
  async (kind) => {
    open();
    const pending = defer();
    native.dialog.showOpenDialog.mockReturnValue(pending.promise);
    const opening = main.showOpenFolderDialog();
    const grant = jest.spyOn(main.fileAccess, 'noteUserIntent');
    if (kind === 'navigation')
      wc.emit('did-start-navigation', {
        isMainFrame: true,
        isSameDocument: false,
      });
    else if (kind === 'crash') wc.emit('render-process-gone');
    else win.emit('closed');
    pending.resolve({ canceled: false, filePaths: [rootB] });
    await opening;
    expect(grant).not.toHaveBeenCalled();
    expect(main.workspaceRoots.size).toBe(0);
  }
);
test('stale per-load token cannot close or reopen after same-frame reload', () => {
  const stale = token();
  wc.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
  wc.emit('did-finish-load');
  open();
  handler('request-close-workspace')(event(), { pageToken: stale });
  handler('request-open-folder')(event(), { pageToken: stale });
  expect(main.workspaceRoots.size).toBe(1);
  expect(native.dialog.showOpenDialog).not.toHaveBeenCalled();
});
test('other bundled window and subframe cannot close the active workspace', () => {
  open();
  const other = { mainFrame: wc.mainFrame };
  request(
    'request-close-workspace',
    {},
    { sender: other, senderFrame: wc.mainFrame }
  );
  request(
    'request-close-workspace',
    {},
    { sender: wc, senderFrame: { url: main.APP_INDEX_URL } }
  );
  expect(main.workspaceRoots.size).toBe(1);
});
test('tree and relative opens require the active id; delayed old requests never read files', () => {
  const old = open();
  const current = open(rootB);
  const read = jest.spyOn(fs, 'openSync');
  request('request-workspace-file', {
    filePath: path.join(rootA, 'a.md'),
    id: old.id,
  });
  request('request-open-relative', {
    fromPath: path.join(rootA, 'a.md'),
    href: './a.md',
    id: old.id,
  });
  expect(read).not.toHaveBeenCalled();
  request('request-workspace-file', {
    filePath: path.join(rootB, 'a.md'),
    id: current.id,
  });
  expect(sent('file-opened').workspaceId).toBe(current.id);
});
test('relative open rejects an outside source even when its destination is inside', () => {
  const current = open();
  const read = jest.spyOn(fs, 'openSync');
  request('request-open-relative', {
    fromPath: path.join(rootB, 'a.md'),
    href: '../A/a.md',
    id: current.id,
  });
  expect(read).not.toHaveBeenCalled();
});
test('Close rejects old tree/relative operations but ordinary opened documents remain readable', () => {
  const current = open();
  request('request-close-workspace');
  const read = jest.spyOn(fs, 'openSync');
  request('request-workspace-file', {
    filePath: path.join(rootA, 'a.md'),
    id: current.id,
  });
  request('request-open-relative', {
    fromPath: path.join(rootA, 'a.md'),
    href: './a.md',
    id: current.id,
  });
  expect(read).not.toHaveBeenCalled();
  handler('request-open-path')(event(), path.join(rootA, 'a.md'));
  expect(sent('file-opened').filename).toBe('a.md');
  expect(sent('file-opened').workspaceId).toBeUndefined();
});
test('File menu Close is enabled only for an active context, including an empty folder', () => {
  // buildMenu sets Electron's menu rather than returning it.
  const getClose = () =>
    native.Menu.buildFromTemplate.mock.calls
      .at(-1)[0]
      .find((item) => item.label === 'File')
      .submenu.find((item) => item.label === 'Close Folder');
  main.buildMenu();
  expect(getClose().enabled).toBe(false);
  fs.unlinkSync(path.join(rootA, 'a.md'));
  open();
  expect(getClose().enabled).toBe(true);
  getClose().click();
  expect(getClose().enabled).toBe(false);
  expect(main.workspaceRoots.size).toBe(0);
});
test('a failed scan keeps the previous context unchanged', () => {
  const before = open();
  main.fileAccess.noteUserIntent(rootB, 'folder');
  const real = fs.readdirSync;
  jest.spyOn(fs, 'readdirSync').mockImplementation((name, options) => {
    if (name === rootB) throw new Error('synthetic denied');
    return real(name, options);
  });
  main.openWorkspace(rootB);
  expect(sent('workspace-opened')).toEqual(before);
  expect([...main.workspaceRoots]).toEqual([rootA]);
});
test('a reentrant Close while scanning cannot commit a stale scan', () => {
  open();
  const actual = main.fileAccess.withAccess;
  jest
    .spyOn(main.fileAccess, 'withAccess')
    .mockImplementation((root, callback) => {
      const result = actual(root, callback);
      request('request-close-workspace');
      return result;
    });
  main.openWorkspace(rootA);
  expect(main.workspaceRoots.size).toBe(0);
});
test('a valid dropped directory replaces current context, using the isolated page token', () => {
  open();
  main.fileAccess.noteUserIntent(rootB, 'folder');
  handler('open-dropped-path')(event(), rootB, token());
  expect([...main.workspaceRoots]).toEqual([rootB]);
});

test('reload immediately disables the native Close Folder item without touching grants', () => {
  open();
  wc.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
  const menu = native.Menu.buildFromTemplate.mock.calls.at(-1)[0];
  expect(
    menu
      .find((item) => item.label === 'File')
      .submenu.find((item) => item.label === 'Close Folder').enabled
  ).toBe(false);
  expect(main.fileAccess.hasGrant(path.join(rootA, 'a.md'))).toBe(true);
});
