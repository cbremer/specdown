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
