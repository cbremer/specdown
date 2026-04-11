const { app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

const VALID_EXTENSIONS = ['.md', '.markdown'];
const MAX_RECENT_FILES = 15;

let mainWindow = null;
let store = null;
let logFilePath = null;

// Queue files requested before the window is ready (e.g. Finder double-click on launch)
let pendingFilePaths = [];

// ===========================
// Logging
// ===========================
// Writes to a user-accessible log file so silent failures in packaged builds
// (ASAR + ESM dynamic imports, missing native bindings, etc.) are recoverable.
function initLogFile() {
  try {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    logFilePath = path.join(userData, 'specdown-main.log');
  } catch (_) {
    // Can't establish a log file — fall back to console only.
    logFilePath = null;
  }
}

function logError(msg, err) {
  const detail = err && err.stack ? err.stack : String(err || '');
  const line = `[${new Date().toISOString()}] ${msg}: ${detail}\n`;
  // eslint-disable-next-line no-console
  console.error(line);
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, line);
    } catch (_) {
      // Swallow — logging must never crash the app.
    }
  }
}

// ===========================
// Store (simple JSON persistence)
// ===========================
// Replaces electron-store v11, which is ESM-only and has a history of
// silently failing to load in packaged ASAR builds (breaking recent files
// and session restore). A tiny synchronous JSON file in userData is simpler,
// has no native deps, and is trivially debuggable.
function initStore() {
  const defaults = {
    recentFiles: [],
    windowBounds: { width: 1200, height: 800 },
    session: { tabs: [] },
    customCssPath: '',
  };

  let statePath;
  try {
    statePath = path.join(app.getPath('userData'), 'specdown-state.json');
  } catch (err) {
    logError('Failed to resolve userData path; persistence disabled', err);
    store = null;
    return;
  }

  let data = { ...defaults };
  try {
    if (fs.existsSync(statePath)) {
      const raw = fs.readFileSync(statePath, 'utf8');
      const parsed = JSON.parse(raw);
      data = { ...defaults, ...parsed };
    }
  } catch (err) {
    logError('Failed to load state file; starting with defaults', err);
  }

  // Atomic write: write to a sibling temp file, then rename over the target.
  // Rename is atomic on POSIX + NTFS, so a crash/kill mid-write can never
  // leave `specdown-state.json` truncated — the worst case is a leftover
  // `.tmp` file that gets overwritten on the next successful write.
  const write = () => {
    const tempPath = `${statePath}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      fs.renameSync(tempPath, statePath);
    } catch (err) {
      logError('Failed to write state file', err);
      // Best-effort cleanup of the temp file so it doesn't accumulate.
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (_) {
        // Swallow — we've already logged the real failure.
      }
    }
  };

  store = {
    get: (key, fallback) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback),
    set: (key, value) => {
      data[key] = value;
      write();
    },
  };
}

function getRecentFiles() {
  return store ? store.get('recentFiles', []) : [];
}

function addRecentFile(filePath) {
  // Feed the native OS recent-documents list (macOS Dock, Windows jump list).
  // This is independent of our own persistent store so it still works even if
  // JSON persistence is broken.
  if (typeof app.addRecentDocument === 'function') {
    try {
      app.addRecentDocument(filePath);
    } catch (err) {
      logError('app.addRecentDocument failed', err);
    }
  }

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

// Why we watch the parent directory instead of the file itself:
// Most modern editors (VSCode, vim, Sublime, JetBrains) save atomically —
// they write a temp file and rename it over the target. Renaming changes
// the inode, and chokidar's single-file watch follows the inode, so the
// watcher goes dead after the first save. Watching the parent directory
// with a basename filter sidesteps this entirely and is robust against
// unlink → add sequences.
//
// Why we share one chokidar watcher per directory across files:
// Opening several tabs from the same folder shouldn't create redundant
// OS-level watches. `dirWatchers` holds one watcher per directory; each
// entry maintains a `files` map (basename → full filePath) so incoming
// events can be routed to the right tab. The exported `watchers` map
// stays keyed by filePath for external API compatibility.
//
// We also don't capture `webContents` in the event closure anymore: if
// the renderer is reloaded (View > Reload), a captured reference becomes
// stale. Instead we look up `mainWindow.webContents` lazily at event time.
const watchers = new Map();          // filePath → { dir }
const dirWatchers = new Map();       // dir → { watcher, files: Map<basename, filePath> }

function watchFile(filePath, _webContents) {
  if (watchers.has(filePath)) return; // already watching

  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);

  let dirEntry = dirWatchers.get(dir);
  if (!dirEntry) {
    const files = new Map();

    const handleEvent = (eventPath) => {
      // chokidar may pass a full path or just a basename depending on platform.
      const eventBase = eventPath ? path.basename(eventPath) : '';
      const target = files.get(eventBase);
      if (!target) return;

      try {
        const fileData = readMarkdownFile(target);
        const wc = mainWindow && mainWindow.webContents;
        if (wc && !wc.isDestroyed()) {
          wc.send('file-changed', fileData);
        }
      } catch (err) {
        logError(`Failed to re-read watched file: ${target}`, err);
      }
    };

    const watcher = chokidar.watch(dir, {
      persistent: true,
      ignoreInitial: true,
      depth: 0, // Only the directory itself, not subdirs.
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    // 'change' covers in-place edits; 'add' covers the post-rename inode
    // of an atomic-save, which chokidar sees as a "new" file appearing.
    watcher.on('change', handleEvent);
    watcher.on('add', handleEvent);
    watcher.on('error', (err) => {
      logError(`Watcher error for ${dir}`, err);
    });

    dirEntry = { watcher, files };
    dirWatchers.set(dir, dirEntry);
  }

  dirEntry.files.set(basename, filePath);
  watchers.set(filePath, { dir });
}

function unwatchFile(filePath) {
  const entry = watchers.get(filePath);
  if (!entry) return;

  watchers.delete(filePath);

  const dirEntry = dirWatchers.get(entry.dir);
  if (!dirEntry) return;

  dirEntry.files.delete(path.basename(filePath));
  if (dirEntry.files.size === 0) {
    try {
      dirEntry.watcher.close();
    } catch (err) {
      logError(`Failed to close watcher for ${entry.dir}`, err);
    }
    dirWatchers.delete(entry.dir);
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
    // Help menu — diagnostics live here so issues are reportable.
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Log File',
          click: () => {
            if (!logFilePath) {
              dialog.showMessageBox({
                type: 'info',
                message: 'No log file has been created yet.',
              });
              return;
            }
            // Ensure the file exists so the OS doesn't refuse to open it.
            try {
              if (!fs.existsSync(logFilePath)) {
                fs.writeFileSync(logFilePath, '');
              }
              // shell.openPath returns Promise<string>: '' on success, an
              // error message string on failure. Both arms need handling.
              shell.openPath(logFilePath)
                .then((result) => {
                  if (result) {
                    logError('Failed to open log file', new Error(result));
                  }
                })
                .catch((err) => {
                  logError('Failed to open log file', err);
                });
            } catch (err) {
              logError('Failed to open log file', err);
            }
          },
        },
        {
          label: 'Show Log File In Folder',
          click: () => {
            if (logFilePath && fs.existsSync(logFilePath)) {
              shell.showItemInFolder(logFilePath);
            }
          },
        },
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
// Catch-all: surface any unhandled error in the main process so silent
// failures become visible (log + optional dialog once we have one).
process.on('uncaughtException', (err) => {
  logError('uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  logError('unhandledRejection', reason);
});

// IIFE instead of `app.whenReady().then(...)` so we can await, catch, and
// surface startup errors. Previously a rejection anywhere in the startup
// chain (e.g. electron-store ESM import failure in a packaged build) was
// swallowed silently — which is exactly how recent files and session
// restore "never worked" in shipped DMGs.
(async () => {
  try {
    await app.whenReady();

    initLogFile();
    initStore();
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
  } catch (err) {
    logError('Startup failed', err);
    try {
      dialog.showErrorBox(
        'SpecDown failed to start',
        String(err && err.message ? err.message : err)
      );
    } catch (_) {
      // Dialog may not be available yet — the log line above is our fallback.
    }
  }
})();

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
