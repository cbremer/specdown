// Preload script — secure IPC bridge between Electron main process and renderer.
// Exposes a limited API via contextBridge so the renderer can communicate with
// the main process without direct access to Node.js or Electron internals.

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Expose the bridge only to the bundled viewer page. The main process passes
// that page's URL; any other page that somehow loads in this window (main also
// blocks such navigation) gets no native capability. Main validates every IPC
// sender independently, so this is defense in depth.
function isBundledViewerPage(href = globalThis.location.href, argv = process.argv) {
  const arg = argv.find((a) => a.startsWith('--specdown-app-url='));
  if (!arg) return false;
  try {
    const expected = new URL(arg.slice('--specdown-app-url='.length));
    const actual = new URL(href);
    return (
      actual.protocol === 'file:' &&
      decodeURIComponent(actual.pathname) === decodeURIComponent(expected.pathname)
    );
  } catch {
    return false;
  }
}

if (isBundledViewerPage()) contextBridge.exposeInMainWorld('specdown', {
  isDesktop: true,

  // OS platform of the shell (Node's process.platform: 'darwin', 'win32',
  // 'linux'). Lets the renderer adapt to per-platform shell behavior — e.g.
  // skipping its GitHub-API version poll where electron-updater owns updates.
  platform: process.platform,

  // Distribution channel: 'mas' for the Mac App Store build (Electron's MAS
  // runtime sets process.mas, also in sandboxed preloads), else 'direct'.
  // The renderer uses it to keep update UI and GitHub release polling out of
  // the App Store build.
  distribution: process.mas === true ? 'mas' : 'direct',

  readBookmarkedFile: (filePath) => ipcRenderer.invoke('read-bookmarked-file', filePath),

  // Called by the renderer to open the native file dialog
  requestFileOpen: () => {
    ipcRenderer.send('request-file-open');
  },

  // Re-open a known local file by its path (used by the in-app recent-files
  // list, which records desktop opens so they can be reopened with one click).
  requestOpenPath: (filePath) => {
    ipcRenderer.send('request-open-path', filePath);
  },

  // Workspace mode: open a folder picker; the main process scans it and replies
  // via onWorkspaceOpened with the file list.
  requestOpenFolder: () => {
    ipcRenderer.send('request-open-folder');
  },

  // Workspace mode: open a relative link clicked inside a workspace document,
  // resolved by the main process against the source document's directory.
  requestOpenRelative: (fromPath, href) => {
    ipcRenderer.send('request-open-relative', { fromPath, href });
  },

  // Workspace mode: receive the scanned folder ({ root, files }).
  onWorkspaceOpened: (callback) => {
    ipcRenderer.on('workspace-opened', (_event, workspace) => {
      callback(workspace);
    });
  },

  // Register a callback for when a file is opened from the main process
  // (via Cmd+O dialog, Finder double-click, drag-to-dock, etc.)
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (_event, fileData) => {
      callback(fileData);
    });
  },

  // Register a callback for when the menu requests closing the active tab
  onCloseTab: (callback) => {
    ipcRenderer.on('close-tab', () => {
      callback();
    });
  },

  // Request the main process to start watching a file for changes
  watchFile: (filePath) => {
    ipcRenderer.send('watch-file', filePath);
  },

  // Request the main process to stop watching a file
  unwatchFile: (filePath) => {
    ipcRenderer.send('unwatch-file', filePath);
  },

  // Re-read a file from disk on demand (manual "Reload from disk"). The main
  // process replies over the file-changed channel, same as a watch event.
  requestRefreshFile: (filePath) => {
    ipcRenderer.send('refresh-file', filePath);
  },

  // Fetch on-disk metadata (size, created/modified, owner) for the File info
  // sheet. Request/response, so this uses invoke and returns a Promise that
  // resolves to the metadata object (or null when the file can't be stat'd).
  getFileMetadata: (filePath) => ipcRenderer.invoke('get-file-metadata', filePath),

  // Absolute filesystem path for a dragged-in File. Electron removed the
  // legacy File.path property (v32+); webUtils.getPathForFile is the
  // sanctioned replacement and is only callable from the preload context.
  // The resolved path is also reported to the main process: a File the user
  // dropped or picked authorizes access in both channels. Only this private
  // IPC route can add a grant; raw renderer path strings cannot.
  getPathForFile: (file) => {
    let filePath;
    try {
      filePath = webUtils.getPathForFile(file) || '';
    } catch {
      return '';
    }
    if (filePath) ipcRenderer.send('note-user-picked-path', filePath);
    return filePath;
  },

  // Mac App Store build: a file could not be opened because the sandbox has
  // no (or no longer valid) access to it. The renderer offers "Locate…".
  onFileAccessNeeded: (callback) => {
    ipcRenderer.on('file-access-needed', (_event, info) => {
      callback(info);
    });
  },

  // Re-grant access to a file via the open panel, then open it.
  requestGrantAccess: (filePath) => {
    ipcRenderer.send('request-grant-access', filePath);
  },

  // Open a previously resolved File by path: main requires the grant recorded
  // by getPathForFile before it stats anything. The main process then stats it
  // and either opens the file (file-opened) or scans the directory into a
  // workspace (workspace-opened).
  openDroppedPath: (absPath) => {
    ipcRenderer.send('open-dropped-path', absPath);
  },

  // Register a callback for when a watched file changes on disk
  onFileChanged: (callback) => {
    ipcRenderer.on('file-changed', (_event, fileData) => {
      callback(fileData);
    });
  },

  // Save the current tab session to disk (called when tabs change)
  saveSession: (tabs) => {
    ipcRenderer.send('save-session', tabs);
  },

  // Register a callback for when the native File > Print menu item is clicked
  onTriggerPrint: (callback) => {
    ipcRenderer.on('trigger-print', () => {
      callback();
    });
  },

  // Export the printable HTML document to a PDF file (offscreen render +
  // printToPDF + save dialog in the main process).
  exportPdf: (payload) => {
    ipcRenderer.send('export-pdf', payload);
  },

  // Register a callback for the native File > Export as PDF menu item.
  onTriggerExportPdf: (callback) => {
    ipcRenderer.on('trigger-export-pdf', () => {
      callback();
    });
  },

  // Register a callback for when the native Edit > Find menu item is clicked
  onTriggerSearch: (callback) => {
    ipcRenderer.on('trigger-search', () => {
      callback();
    });
  },

  // Appearance > Theme: apply a named visual theme from the native menu.
  // The renderer reports back via notifyVisualTheme so radio items stay
  // in sync with the header dropdown.
  onSetVisualTheme: (callback) => {
    ipcRenderer.on('set-visual-theme', (_event, themeId) => {
      callback(themeId);
    });
  },
  notifyVisualTheme: (themeId) => {
    ipcRenderer.send('visual-theme-changed', themeId);
  },
  // Renderer catalog of named empty-state looks. The main process rebuilds
  // Appearance → Theme from this list so a new theme is one catalog entry.
  notifyVisualThemeCatalog: (catalog) => {
    ipcRenderer.send('visual-theme-catalog', catalog);
  },

  // Register a callback for applying custom CSS (Appearance menu or saved theme)
  onApplyCustomCss: (callback) => {
    ipcRenderer.on('apply-custom-css', (_event, cssContent) => {
      callback(cssContent);
    });
  },

  // Auto-update: notified when a downloaded update is ready to install.
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, info) => {
      callback(info);
    });
  },

  // Auto-update: ask the main process to quit and install the downloaded update.
  restartToUpdate: () => {
    ipcRenderer.send('restart-to-update');
  },
});

// For tests (Node require); harmless in the Electron preload.
module.exports = { isBundledViewerPage };
