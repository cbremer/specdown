/**
 * The app window may only show the bundled viewer, and only that page may
 * reach the native bridge (Electron security checklist #13). A crafted link
 * to a local .html file or a remote page must neither load in the window nor
 * be able to call IPC.
 */

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({ on: jest.fn().mockReturnThis(), close: jest.fn() })),
}));
jest.mock('electron', () => ({
  app: {
    name: 'SpecDown',
    whenReady: jest.fn(() => ({ then: jest.fn() })),
    on: jest.fn(),
    getPath: jest.fn(() => '/tmp/specdown-security-test'),
    addRecentDocument: jest.fn(),
  },
  BrowserWindow: Object.assign(jest.fn(), { getAllWindows: jest.fn(() => []) }),
  Menu: {
    buildFromTemplate: jest.fn((t) => t),
    setApplicationMenu: jest.fn(),
    getApplicationMenu: jest.fn(() => null),
  },
  dialog: {
    showOpenDialog: jest.fn(() =>
      Promise.resolve({ canceled: true, filePaths: [] })
    ),
    showMessageBox: jest.fn(),
    showErrorBox: jest.fn(),
  },
  ipcMain: { on: jest.fn(), handle: jest.fn() },
  globalShortcut: { register: jest.fn(), unregisterAll: jest.fn() },
  shell: {
    openPath: jest.fn(),
    showItemInFolder: jest.fn(),
    openExternal: jest.fn(),
  },
  contextBridge: { exposeInMainWorld: jest.fn() },
  ipcRenderer: { send: jest.fn(), on: jest.fn(), invoke: jest.fn() },
  webUtils: { getPathForFile: jest.fn() },
}));

const { pathToFileURL } = require('url');
const path = require('path');
const { ipcMain, dialog } = require('electron');
const main = require('../../desktop/main');
const { APP_INDEX_URL, routeNavigation, isAppPageUrl, isTrustedIpcSender } =
  main;

const attackerHtml = pathToFileURL('/Users/me/Downloads/evil.html').href;

function eventFrom(url, { subframe = false } = {}) {
  const frame = { url };
  return {
    senderFrame: frame,
    sender: { mainFrame: subframe ? { url } : frame },
  };
}

describe('window navigation', () => {
  it('allows only the bundled viewer page', () => {
    expect(routeNavigation(APP_INDEX_URL)).toBe('allow');
    expect(routeNavigation(APP_INDEX_URL + '#section')).toBe('allow');
  });

  it('denies other local files, including crafted .html pages', () => {
    expect(routeNavigation(attackerHtml)).toBe('deny');
    expect(
      routeNavigation(
        pathToFileURL(
          path.join(path.dirname(new URL(APP_INDEX_URL).pathname), 'other.html')
        ).href
      )
    ).toBe('deny');
    expect(routeNavigation('file:///etc/passwd')).toBe('deny');
  });

  it('sends http(s) and mailto links to the system, denies other schemes', () => {
    expect(routeNavigation('https://example.com')).toBe('external');
    expect(routeNavigation('http://example.com')).toBe('external');
    expect(routeNavigation('mailto:support@mosaicpando.com')).toBe('external');
    expect(routeNavigation('javascript:alert(1)')).toBe('deny');
    expect(routeNavigation('data:text/html,<script>1</script>')).toBe('deny');
    expect(routeNavigation('not a url')).toBe('deny');
  });
});

describe('isAppPageUrl', () => {
  it('matches the app page by file path, never by scheme-less path alone', () => {
    expect(isAppPageUrl(APP_INDEX_URL)).toBe(true);
    const remoteSamePath =
      'https://evil.example' + new URL(APP_INDEX_URL).pathname;
    expect(isAppPageUrl(remoteSamePath)).toBe(false);
  });
});

describe('IPC sender validation', () => {
  const handlerFor = (channel) =>
    ipcMain.on.mock.calls.find((c) => c[0] === channel)[1];
  const invokeFor = (channel) =>
    ipcMain.handle.mock.calls.find((c) => c[0] === channel)[1];

  beforeEach(() => dialog.showOpenDialog.mockClear());

  it('trusts only the main frame of the bundled viewer', () => {
    expect(isTrustedIpcSender(eventFrom(APP_INDEX_URL))).toBe(true);
    expect(isTrustedIpcSender(eventFrom(attackerHtml))).toBe(false);
    expect(isTrustedIpcSender(eventFrom('https://evil.example'))).toBe(false);
    expect(
      isTrustedIpcSender(eventFrom(APP_INDEX_URL, { subframe: true }))
    ).toBe(false);
    expect(isTrustedIpcSender(null)).toBe(false);
    expect(isTrustedIpcSender({})).toBe(false);
  });

  it('wraps every ipcMain handler with the sender check', () => {
    const channels = [
      ...ipcMain.on.mock.calls,
      ...ipcMain.handle.mock.calls,
    ].map((c) => c[0]);
    expect(channels.length).toBeGreaterThan(15);
    for (const [, handler] of ipcMain.on.mock.calls) {
      // An untrusted sender is ignored without throwing.
      expect(() =>
        handler(eventFrom(attackerHtml), '/etc/passwd.md')
      ).not.toThrow();
    }
  });

  it('ignores commands from an untrusted page', () => {
    handlerFor('request-open-folder')(eventFrom(attackerHtml));
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });

  it('denies arbitrary paths from the trusted renderer without filesystem probes', async () => {
    const fs = require('fs');
    const chokidar = require('chokidar');
    const probe = jest.spyOn(fs, 'statSync');
    const open = jest.spyOn(fs, 'openSync');
    const event = eventFrom(APP_INDEX_URL);
    const secret = '/unselected/private/secret.md';
    try {
      handlerFor('request-open-path')(event, secret);
      handlerFor('refresh-file')(event, secret);
      handlerFor('watch-file')(event, secret);
      handlerFor('open-dropped-path')(event, '/unselected/private');
      await expect(invokeFor('read-bookmarked-file')(event, secret)).resolves.toBeNull();
      await expect(invokeFor('get-file-metadata')(event, secret)).resolves.toBeNull();
      expect(probe).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
      expect(chokidar.watch).not.toHaveBeenCalled();
    } finally {
      probe.mockRestore();
      open.mockRestore();
    }
  });

  it('returns nothing to an untrusted invoke', async () => {
    await expect(
      invokeFor('read-bookmarked-file')(eventFrom(attackerHtml), '/tmp/a.md')
    ).resolves.toBeNull();
    await expect(
      invokeFor('get-file-metadata')(eventFrom(attackerHtml), '/tmp/a.md')
    ).resolves.toBeNull();
  });
});

describe('preload exposes the bridge only to the bundled viewer', () => {
  const { isBundledViewerPage } = require('../../desktop/preload');
  const argv = ['electron', `--specdown-app-url=${APP_INDEX_URL}`];

  it('accepts the app page', () => {
    expect(isBundledViewerPage(APP_INDEX_URL, argv)).toBe(true);
    expect(isBundledViewerPage(APP_INDEX_URL + '?x=1#y', argv)).toBe(true);
  });

  it('rejects any other page, or a missing expected URL', () => {
    expect(isBundledViewerPage(attackerHtml, argv)).toBe(false);
    expect(isBundledViewerPage('https://evil.example', argv)).toBe(false);
    expect(isBundledViewerPage(APP_INDEX_URL, ['electron'])).toBe(false);
  });
});
