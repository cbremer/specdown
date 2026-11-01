// Renderer admission is separate from reading a user-authorized file. A receipt
// carries no filesystem authority: only this process retains the resolved path.
const { randomUUID } = require('crypto');

const MAX_PENDING_OPENS = 256;
const OPEN_RECEIPT_TTL_MS = 30000;

function createFileOpenReceipts({ isAppPage, onAccepted, now = Date.now }) {
  const pending = new Map();
  let receiver = null;
  let epoch = 0;
  let releaseListeners = () => {};

  function invalidate() {
    epoch += 1;
    pending.clear();
  }

  function prune() {
    const time = now();
    for (const [id, receipt] of pending) {
      if (receipt.expiresAt <= time) pending.delete(id);
    }
  }

  function bind(webContents) {
    releaseListeners();
    invalidate();
    receiver = webContents;
    if (!receiver) {
      releaseListeners = () => {};
      return;
    }
    const navigation = (details) => {
      if (details.isMainFrame && !details.isSameDocument) invalidate();
    };
    const destroyed = () => bind(null);
    receiver.on('did-start-navigation', navigation);
    receiver.on('render-process-gone', invalidate);
    receiver.on('destroyed', destroyed);
    releaseListeners = () => {
      webContents.removeListener('did-start-navigation', navigation);
      webContents.removeListener('render-process-gone', invalidate);
      webContents.removeListener('destroyed', destroyed);
    };
  }

  function usableFrame() {
    if (!receiver || receiver.isDestroyed() || receiver.isLoadingMainFrame())
      return null;
    const frame = receiver.mainFrame;
    return frame && !frame.detached && isAppPage(frame.url) ? frame : null;
  }

  function deliver(fileData) {
    prune();
    let id;
    try {
      const frame = usableFrame();
      if (!frame || pending.size >= MAX_PENDING_OPENS) return false;
      id = randomUUID();
      pending.set(id, {
        path: fileData.filePath,
        receiver,
        frame,
        epoch,
        expiresAt: now() + OPEN_RECEIPT_TTL_MS,
      });
      // Address the captured frame, rather than whichever frame is current
      // after a navigation. A failed send must never leave a usable receipt.
      frame.send('file-opened', { ...fileData, openReceipt: id });
      return true;
    } catch {
      if (id) pending.delete(id);
      return false;
    }
  }

  function acknowledge(event, result) {
    if (
      !result ||
      typeof result !== 'object' ||
      Array.isArray(result) ||
      typeof result.receipt !== 'string' ||
      result.receipt.length !== 36 ||
      typeof result.accepted !== 'boolean'
    )
      return false;
    prune();
    const receipt = pending.get(result.receipt);
    if (!receipt) return false;
    try {
      if (
        receipt.epoch !== epoch ||
        receipt.receiver !== receiver ||
        event.sender !== receiver ||
        event.senderFrame !== receipt.frame ||
        usableFrame() !== receipt.frame
      )
        return false;
    } catch {
      return false;
    }
    // Consume true and false alike. An older accepted open remains eligible
    // after a newer rejected open; recents are history, not a current-title slot.
    pending.delete(result.receipt);
    if (result.accepted) onAccepted(receipt.path);
    return true;
  }

  return {
    bind,
    deliver,
    acknowledge,
    forget(webContents) {
      if (receiver === webContents) bind(null);
    },
  };
}

module.exports = {
  createFileOpenReceipts,
  MAX_PENDING_OPENS,
  OPEN_RECEIPT_TTL_MS,
};
