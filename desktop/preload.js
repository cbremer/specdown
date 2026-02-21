// Preload script — bridge between Electron main process and renderer.
// This will later expose IPC APIs via contextBridge.
// For now it's a stub to establish the architecture.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('specdown', {
  // IPC methods will be added here in future sessions
});
