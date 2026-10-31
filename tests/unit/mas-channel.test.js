/**
 * Channel separation between the Mac App Store build and the direct
 * (Developer ID) download. The MAS build must never load electron-updater,
 * check GitHub for updates, or show update UI (App Review Guideline 2.4.5 and
 * the "Data Not Collected" privacy label); the direct channel keeps all of it.
 */

const {
  getDistributionChannel,
  channelAllowsSelfUpdate,
} = require('../../desktop/distribution');

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({ on: jest.fn().mockReturnThis(), close: jest.fn() })),
}));
jest.mock('electron', () => ({
  app: {
    name: 'SpecDown',
    isPackaged: true,
    whenReady: jest.fn(() => ({ then: jest.fn() })),
    on: jest.fn(),
    getPath: jest.fn(() => '/tmp/specdown-mas-channel-test'),
    getVersion: jest.fn(() => '0.0.0'),
    addRecentDocument: jest.fn(),
  },
  BrowserWindow: Object.assign(jest.fn(), { getAllWindows: jest.fn(() => []) }),
  Menu: {
    buildFromTemplate: jest.fn((t) => t),
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
  shell: {
    openPath: jest.fn(),
    showItemInFolder: jest.fn(),
    openExternal: jest.fn(),
  },
}));

const mockUpdater = {
  on: jest.fn(),
  checkForUpdatesAndNotify: jest.fn(() => Promise.resolve()),
  quitAndInstall: jest.fn(),
};
let updaterRequired = 0;
jest.mock('electron-updater', () => {
  updaterRequired += 1;
  return { autoUpdater: mockUpdater };
});

/** Load desktop/main.js fresh with process.mas set as given. */
function loadMain(mas) {
  const original = process.mas;
  process.mas = mas;
  let mod;
  jest.isolateModules(() => {
    mod = require('../../desktop/main');
    // The isolated registry has its own electron mock instance.
    loadedElectron = require('electron');
  });
  process.mas = original;
  return mod;
}
let loadedElectron;

function helpLabels() {
  const { Menu } = loadedElectron;
  const template = Menu.buildFromTemplate.mock.calls.at(-1)[0];
  return template
    .find((m) => m.label === 'Help')
    .submenu.map((i) => i.label)
    .filter(Boolean);
}

describe('getDistributionChannel', () => {
  it('is mas only when the Electron MAS runtime flag is set', () => {
    expect(getDistributionChannel({ mas: true })).toBe('mas');
    expect(getDistributionChannel({ mas: false })).toBe('direct');
    expect(getDistributionChannel({})).toBe('direct');
    expect(getDistributionChannel(undefined)).toBe('direct');
    // A truthy non-boolean is not the runtime flag.
    expect(getDistributionChannel({ mas: 'yes' })).toBe('direct');
  });

  it('allows self-update only on the direct channel', () => {
    expect(channelAllowsSelfUpdate('direct')).toBe(true);
    expect(channelAllowsSelfUpdate('mas')).toBe(false);
  });
});

describe('Mac App Store build', () => {
  let main;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });
  afterAll(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
  });

  beforeEach(() => {
    updaterRequired = 0;
    mockUpdater.checkForUpdatesAndNotify.mockClear();
    mockUpdater.quitAndInstall.mockClear();
  });

  it('never loads electron-updater or checks for updates', () => {
    main = loadMain(true);
    expect(main.DISTRIBUTION_CHANNEL).toBe('mas');
    main.initAutoUpdater();
    expect(updaterRequired).toBe(0);
    expect(mockUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it('has no Check for Updates menu item', () => {
    main = loadMain(true);
    main.buildMenu();
    expect(helpLabels()).not.toContain('Check for Updates...');
    // Diagnostics stay available.
    expect(helpLabels()).toContain('Open Log File');
  });

  it('ignores restart-to-update from the renderer', () => {
    main = loadMain(true);
    main.initAutoUpdater();
    const { ipcMain } = loadedElectron;
    const handler = ipcMain.on.mock.calls
      .filter((c) => c[0] === 'restart-to-update')
      .at(-1)[1];
    handler();
    expect(mockUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
});

describe('direct (Developer ID) build keeps auto-update', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  beforeAll(() =>
    Object.defineProperty(process, 'platform', { value: 'darwin' })
  );
  afterAll(() => Object.defineProperty(process, 'platform', originalPlatform));

  it('loads electron-updater and checks GitHub when packaged on macOS', () => {
    updaterRequired = 0;
    const main = loadMain(false);
    expect(main.DISTRIBUTION_CHANNEL).toBe('direct');
    main.initAutoUpdater();
    expect(updaterRequired).toBe(1);
    expect(mockUpdater.checkForUpdatesAndNotify).toHaveBeenCalled();
  });

  it('keeps the Check for Updates menu item', () => {
    const main = loadMain(false);
    main.buildMenu();
    expect(helpLabels()).toContain('Check for Updates...');
  });
});

// Fake native bookmark module: anything the test "granted" can be bookmarked.
const mockNativeBookmarks = {
  createBookmark: jest.fn((p) => `b64:${p}`),
  startAccess: jest.fn((b64) => ({
    id: 1,
    path: b64.slice(4),
    stale: false,
    ok: true,
  })),
  stopAccess: jest.fn(() => true),
};
jest.mock(
  require('path').join(
    __dirname,
    '../../desktop/native/mas-bookmarks/masbookmarks.node'
  ),
  () => mockNativeBookmarks,
  { virtual: true }
);

describe('Mac App Store build: sandbox file access', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  let dir;
  let file;
  let main;

  const masTrustedEvent = () => {
    const frame = { url: main.APP_INDEX_URL };
    return { senderFrame: frame, sender: { mainFrame: frame } };
  };
  const ipcHandler = (channel) =>
    loadedElectron.ipcMain.on.mock.calls
      .filter((c) => c[0] === channel)
      .at(-1)[1];

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-mas-'));
    file = path.join(dir, 'notes.md');
    fs.writeFileSync(file, '# Notes');
    mockNativeBookmarks.createBookmark.mockClear();
    main = loadMain(true);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    // Restore only this block's fs spies (tests/setup.js owns Storage spies).
    for (const name of ['readFileSync', 'statSync', 'watchFile', 'unwatchFile']) fs[name].mockRestore?.();
  });

  it('does not read a raw path that has no sandbox grant (old state migration)', () => {
    const read = jest.spyOn(fs, 'readFileSync');
    ipcHandler('request-open-path')(masTrustedEvent(), file);
    expect(read).not.toHaveBeenCalledWith(file, expect.anything());
    expect(loadedElectron.app.addRecentDocument).not.toHaveBeenCalled();
  });

  it('persists a dropped file as a grant, then opens it', () => {
    ipcHandler('note-user-picked-path')(masTrustedEvent(), file);
    ipcHandler('open-dropped-path')(masTrustedEvent(), file);
    expect(mockNativeBookmarks.createBookmark).toHaveBeenCalledWith(file);
    expect(loadedElectron.app.addRecentDocument).toHaveBeenCalledWith(file);
    // The same path now opens by reference (recents / session restore).
    loadedElectron.app.addRecentDocument.mockClear();
    ipcHandler('request-open-path')(masTrustedEvent(), file);
    expect(loadedElectron.app.addRecentDocument).toHaveBeenCalledWith(file);
  });

  it('stats dropped paths only inside an active scope and opens the resolved moved file', () => {
    main.fileAccess.noteUserIntent(file, 'file');
    const movedFile = path.join(dir, 'renamed.md');
    fs.renameSync(file, movedFile);
    const start = mockNativeBookmarks.startAccess.getMockImplementation();
    const stop = mockNativeBookmarks.stopAccess.getMockImplementation();
    const stat = fs.statSync;
    let activeScopes = 0;
    mockNativeBookmarks.startAccess.mockImplementation((bookmark) => {
      activeScopes += 1;
      return { ...start(bookmark), path: movedFile };
    });
    mockNativeBookmarks.stopAccess.mockImplementation(() => {
      activeScopes -= 1;
      return true;
    });
    const statSpy = jest.spyOn(fs, 'statSync').mockImplementation((target, ...args) => {
      expect(target).toBe(movedFile);
      expect(activeScopes).toBeGreaterThan(0);
      return stat(target, ...args);
    });
    try {
      ipcHandler('open-dropped-path')(masTrustedEvent(), file);
      expect(statSpy).toHaveBeenCalledWith(movedFile);
      expect(loadedElectron.app.addRecentDocument).toHaveBeenCalledWith(movedFile);
      expect(activeScopes).toBe(0);
    } finally {
      mockNativeBookmarks.startAccess.mockImplementation(start);
      mockNativeBookmarks.stopAccess.mockImplementation(stop);
    }
  });

  it('records paths the preload resolved from user-picked Files', () => {
    ipcHandler('note-user-picked-path')(masTrustedEvent(), file);
    expect(main.fileAccess.hasGrant(file)).toBe(true);
    ipcHandler('note-user-picked-path')(masTrustedEvent(), 'relative.md');
    expect(main.fileAccess.hasGrant('relative.md')).toBe(false);
  });

  it('watches by polling the granted file instead of its parent folder', () => {
    const chokidar = require('chokidar');
    const watch = jest.spyOn(fs, 'watchFile').mockImplementation(() => {});
    const unwatch = jest.spyOn(fs, 'unwatchFile').mockImplementation(() => {});
    main.fileAccess.noteUserIntent(file, 'file');

    main.watchFile(file);
    main.watchFile(file); // idempotent
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledWith(
      file,
      { interval: 1000 },
      expect.any(Function)
    );
    expect(chokidar.watch).not.toHaveBeenCalled();
    expect(main.pollWatchers.has(file)).toBe(true);

    main.unwatchFile(file);
    expect(unwatch).toHaveBeenCalledWith(file, watch.mock.calls[0][2]);
    expect(main.pollWatchers.has(file)).toBe(false);
  });

  it('skips live reload for a file without a grant', () => {
    const watch = jest.spyOn(fs, 'watchFile').mockImplementation(() => {});
    main.watchFile(path.join(dir, 'ungranted.md'));
    expect(watch).not.toHaveBeenCalled();
  });
});
