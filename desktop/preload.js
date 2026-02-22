// Preload script — secure IPC bridge between Electron main process and renderer.
// Exposes a limited API via contextBridge so the renderer can communicate with
// the main process without direct access to Node.js or Electron internals.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('specdown', {
  isDesktop: true,

  // Called by the renderer to open the native file dialog
  requestFileOpen: () => {
    ipcRenderer.send('request-file-open');
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
});
