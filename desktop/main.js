const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

const VALID_EXTENSIONS = ['.md', '.markdown'];

let mainWindow = null;

// Queue files requested before the window is ready (e.g. Finder double-click on launch)
let pendingFilePaths = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

// ===========================
// Native Menu
// ===========================
function buildMenu() {
  const isMac = process.platform === 'darwin';

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

// ===========================
// App Lifecycle
// ===========================
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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
