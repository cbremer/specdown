const { app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

const VALID_EXTENSIONS = ['.md', '.markdown'];
const MAX_RECENT_FILES = 15;

let mainWindow = null;
let store = null;

// Queue files requested before the window is ready (e.g. Finder double-click on launch)
let pendingFilePaths = [];

// ===========================
// Store (electron-store)
// ===========================
async function initStore() {
  // electron-store v11+ is ESM-only, so we use dynamic import
  const { default: Store } = await import('electron-store');
  store = new Store({
    name: 'specdown-state',
    defaults: {
      recentFiles: [],
      windowBounds: { width: 1200, height: 800 },
      session: { tabs: [] },
    },
  });
}

function getRecentFiles() {
  return store ? store.get('recentFiles', []) : [];
}

function addRecentFile(filePath) {
  if (!store) return;
  let recent = store.get('recentFiles', []);
  recent = recent.filter((p) => p !== filePath);
  recent.unshift(filePath);
  if (recent.length > MAX_RECENT_FILES) recent = recent.slice(0, MAX_RECENT_FILES);
  store.set('recentFiles', recent);
  rebuildMenu();
}

function saveSession(tabs) {
  if (!store) return;
  // Only save file-path based tabs (not URL/dragged-in ones without a path)
  const saveable = tabs
    .filter((t) => t.filePath)
    .map((t) => ({ filePath: t.filePath, filename: t.filename }));
  store.set('session', { tabs: saveable });
}

function restoreSession() {
  if (!store) return;
  const session = store.get('session', { tabs: [] });
  for (const tabInfo of session.tabs) {
    if (tabInfo.filePath && isValidMarkdownFile(tabInfo.filePath)) {
      openFileByPath(tabInfo.filePath);
    }
  }
}

function createWindow() {
  const bounds = store ? store.get('windowBounds', { width: 1200, height: 800 }) : { width: 1200, height: 800 };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    title: 'Specdown Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'markdown-viewer', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    // Deliver any files that were queued before the window was ready
    for (const filePath of pendingFilePaths) {
      openFileByPath(filePath);
    }
    pendingFilePaths = [];

    // Restore previous session
    restoreSession();

    // Restore custom CSS theme
    restoreCustomCss();
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (!store) return;
    const [width, height] = mainWindow.getSize();
    store.set('windowBounds', { width, height });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===========================
// File Open Logic
// ===========================
function isValidMarkdownFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VALID_EXTENSIONS.includes(ext);
}

function readMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);
  return { filename, filePath, content };
}

function openFileByPath(filePath) {
  if (!isValidMarkdownFile(filePath)) return;

  try {
    const fileData = readMarkdownFile(filePath);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('file-opened', fileData);
    }
    addRecentFile(filePath);
  } catch (err) {
    console.error('Failed to read file:', filePath, err);
  }
}

async function showOpenDialog() {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown File',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths.length) return;

  for (const filePath of result.filePaths) {
    openFileByPath(filePath);
  }
}

// ===========================
// File Watching
// ===========================

// Map of filePath → chokidar FSWatcher
const watchers = new Map();

function watchFile(filePath, webContents) {
  if (watchers.has(filePath)) return; // already watching

  const watcher = chokidar.watch(filePath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on('change', () => {
    try {
      const fileData = readMarkdownFile(filePath);
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('file-changed', fileData);
      }
    } catch (err) {
      console.error('Failed to re-read watched file:', filePath, err);
    }
  });

  watchers.set(filePath, watcher);
}

function unwatchFile(filePath) {
  const watcher = watchers.get(filePath);
  if (watcher) {
    watcher.close();
    watchers.delete(filePath);
  }
}

// ===========================
// Custom CSS
// ===========================
async function loadCustomCss() {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Custom CSS Theme',
    properties: ['openFile'],
    filters: [
      { name: 'CSS Files', extensions: ['css'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths.length) return;

  const cssPath = result.filePaths[0];
  try {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('apply-custom-css', cssContent);
    }
    if (store) store.set('customCssPath', cssPath);
  } catch (err) {
    console.error('Failed to read CSS file:', cssPath, err);
  }
}

function clearCustomCss() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('apply-custom-css', '');
  }
  if (store) store.set('customCssPath', '');
}

function restoreCustomCss() {
  if (!store) return;
  const cssPath = store.get('customCssPath', '');
  if (!cssPath) return;
  try {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('apply-custom-css', cssContent);
    }
  } catch (err) {
    // CSS file may have been moved; silently skip
    store.set('customCssPath', '');
  }
}

// ===========================
// IPC Handlers
// ===========================
ipcMain.on('request-file-open', () => {
  showOpenDialog();
});

ipcMain.on('close-active-tab', () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('close-tab');
  }
});

ipcMain.on('watch-file', (event, filePath) => {
  watchFile(filePath, event.sender);
});

ipcMain.on('unwatch-file', (_event, filePath) => {
  unwatchFile(filePath);
});

// Session save: renderer sends tab state when it changes
ipcMain.on('save-session', (_event, tabs) => {
  saveSession(tabs);
});

// ===========================
// Native Menu
// ===========================
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const recent = getRecentFiles();

  const recentSubmenu = recent.length === 0
    ? [{ label: 'No Recent Files', enabled: false }]
    : [
        ...recent.map((filePath) => ({
          label: path.basename(filePath),
          sublabel: filePath,
          click: () => openFileByPath(filePath),
        })),
        { type: 'separator' },
        {
          label: 'Clear Recent Files',
          click: () => {
            if (store) store.set('recentFiles', []);
            rebuildMenu();
          },
        },
      ];

  const template = [
    // macOS app menu
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => showOpenDialog(),
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('close-tab');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('trigger-print');
            }
          },
        },
        ...(isMac ? [] : [
          { type: 'separator' },
          { role: 'quit' },
        ]),
      ],
    },
    // Edit menu (macOS standard)
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('trigger-search');
            }
          },
        },
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Appearance menu
    {
      label: 'Appearance',
      submenu: [
        {
          label: 'Load Custom CSS Theme...',
          click: () => loadCustomCss(),
        },
        {
          label: 'Clear Custom Theme',
          click: () => clearCustomCss(),
        },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
        ] : [
          { role: 'close' },
        ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function rebuildMenu() {
  buildMenu();
}

// ===========================
// App Lifecycle
// ===========================
app.whenReady().then(async () => {
  await initStore();
  buildMenu();
  createWindow();

  // Global shortcut: Cmd+Shift+M brings SpecDown to front and prompts open
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow) {
      createWindow();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      showOpenDialog();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: handle files opened via Finder (double-click, drag-to-dock, Open With)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    openFileByPath(filePath);
  } else {
    // Window not ready yet — queue the file
    pendingFilePaths.push(filePath);
  }
});

// Export for testing
module.exports = {
  isValidMarkdownFile,
  readMarkdownFile,
  buildMenu,
  watchFile,
  unwatchFile,
  watchers,
  VALID_EXTENSIONS,
};
