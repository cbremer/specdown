// Main-held recovery records confer no path or grant authority on the renderer.
const { randomUUID } = require('crypto');
const path = require('path');
const MAX_OPEN_FAILURES = 256;

function createOpenRecovery({ isAppPage, getStore, locate }) {
  let receiver = null;
  let generation = 0;
  let release = () => {};
  let pendingEntries = new Set();
  let rendererTabs = null;
  let readyFrame = null;
  let saveToken = null;
  const failures = new Map();

  function invalidate() {
    generation += 1;
    failures.clear();
    pendingEntries = new Set();
    rendererTabs = null;
    readyFrame = null;
    saveToken = null;
  }
  function bind(wc) {
    release();
    invalidate();
    receiver = wc;
    release = () => {};
    if (!wc) return;
    const navigation = (details) => {
      if (details.isMainFrame && !details.isSameDocument) invalidate();
    };
    const destroyed = () => bind(null);
    wc.on('did-start-navigation', navigation);
    wc.on('render-process-gone', invalidate);
    wc.on('destroyed', destroyed);
    release = () => {
      wc.removeListener('did-start-navigation', navigation);
      wc.removeListener('render-process-gone', invalidate);
      wc.removeListener('destroyed', destroyed);
    };
  }
  function frame() {
    try {
      if (!receiver || receiver.isDestroyed() || receiver.isLoadingMainFrame())
        return null;
      const current = receiver.mainFrame;
      return current && !current.detached && isAppPage(current.url)
        ? current
        : null;
    } catch {
      return null;
    }
  }
  function session() {
    const value = getStore()?.get('session', { tabs: [] });
    return value && Array.isArray(value.tabs) ? value : null;
  }
  function beginRestore() {
    readyFrame = frame();
    saveToken = readyFrame ? randomUUID() : null;
    try {
      readyFrame?.send('session-save-ready', { token: saveToken });
    } catch {
      readyFrame = null;
      saveToken = null;
    }
    const value = session();
    pendingEntries = new Set(value ? value.tabs : []);
    rendererTabs = null;
    return value ? value.tabs.slice() : [];
  }
  function retained(entry) {
    return pendingEntries.has(entry) && !!session()?.tabs.includes(entry);
  }
  function writeSession(tabs) {
    const value = session();
    return !!value && getStore().set('session', { ...value, tabs }) === true;
  }
  function mergedTabs() {
    const value = session();
    if (!value) return null;
    const pending = value.tabs.filter((entry) => pendingEntries.has(entry));
    const paths = new Set(pending.map((entry) => entry?.filePath));
    return [
      ...rendererTabs.filter((entry) => !paths.has(entry.filePath)),
      ...pending,
    ];
  }
  function save(event, tabs, token) {
    const current = frame();
    if (
      !current ||
      !saveToken ||
      token !== saveToken ||
      current !== readyFrame ||
      event?.sender !== receiver ||
      event?.senderFrame !== current
    )
      return false;
    if (!Array.isArray(tabs) || tabs.length > 256) return false;
    const next = tabs
      .filter(
        (entry) => entry && typeof entry.filePath === 'string' && entry.filePath
      )
      .map((entry) => ({
        filePath: entry.filePath,
        filename:
          typeof entry.filename === 'string'
            ? entry.filename
            : path.basename(entry.filePath),
      }));
    const previous = rendererTabs;
    rendererTabs = next;
    const merged = mergedTabs();
    if (merged && writeSession(merged)) return true;
    rendererTabs = previous;
    return false;
  }
  function resolve(id) {
    const record = failures.get(id);
    failures.delete(id);
    if (record && frame() === record.frame) {
      try {
        record.frame.send('file-open-recovery-resolved', { id });
      } catch {
        /* closed */
      }
    }
  }
  function report(filePath, message, entry = null) {
    const current = frame();
    if (!current || typeof filePath !== 'string') return false;
    // Supersede only the same attempt. Distinct unavailable saved tabs remain separate.
    for (const [id, record] of failures) {
      if (
        entry
          ? record.entry === entry
          : !record.entry && record.path === filePath
      )
        resolve(id);
    }
    if (failures.size >= MAX_OPEN_FAILURES) return false;
    const id = randomUUID();
    const record = {
      path: filePath,
      entry,
      frame: current,
      receiver,
      generation,
      busy: false,
    };
    failures.set(id, record);
    try {
      current.send('file-open-failed', {
        id,
        filename: path.basename(filePath),
        message,
        canForget: entry !== null && retained(entry),
      });
      return true;
    } catch {
      failures.delete(id);
      return false;
    }
  }
  function admitted(filePath, accepted, context) {
    const entry = context?.entry;
    if (!accepted) {
      if (entry && retained(entry))
        report(
          filePath,
          'This saved file could not be opened. Close a tab or choose another Markdown file.',
          entry
        );
      return;
    }
    const removed = [];
    for (const pending of pendingEntries) {
      if (
        pending === entry ||
        pending?.filePath === filePath ||
        pending?.filePath === context?.requestedPath
      ) {
        removed.push(pending);
        pendingEntries.delete(pending);
      }
    }
    let saved = true;
    if (rendererTabs !== null) {
      const merged = mergedTabs();
      saved = !!merged && writeSession(merged);
    }
    for (const [id, record] of failures) {
      if (
        record.path === filePath ||
        record.path === context?.requestedPath ||
        removed.includes(record.entry) ||
        id === context?.failureId
      )
        resolve(id);
    }
    // Admission retires recovery authority even if saving fails: a visible,
    // accepted tab must never remain forgettable through an obsolete control.
    if (!saved)
      report(
        filePath,
        'The file opened, but the startup list could not be saved. The previous saved list is unchanged.'
      );
  }
  async function act(event, request) {
    if (
      !request ||
      typeof request !== 'object' ||
      Array.isArray(request) ||
      Object.keys(request).sort().join(',') !== 'action,id' ||
      typeof request.id !== 'string' ||
      !['dismiss', 'forget', 'locate'].includes(request.action)
    )
      return false;
    const record = failures.get(request.id);
    const current = () =>
      record &&
      failures.get(request.id) === record &&
      record.generation === generation &&
      event.sender === receiver &&
      receiver === record.receiver &&
      event.senderFrame === record.frame &&
      frame() === record.frame &&
      (!record.entry || retained(record.entry));
    if (!current()) return false;
    if (request.action === 'dismiss') {
      resolve(request.id);
      return true;
    }
    if (request.action === 'forget') {
      if (!record.entry || !retained(record.entry)) return false;
      const value = session();
      // Identity, not filename/path equality: only this still-pending saved entry.
      if (!writeSession(value.tabs.filter((entry) => entry !== record.entry)))
        return false;
      pendingEntries.delete(record.entry);
      resolve(request.id);
      return true;
    }
    if (record.busy) return false;
    record.busy = true;
    try {
      return await locate(record.path, current, {
        entry: record.entry,
        failureId: request.id,
      });
    } finally {
      record.busy = false;
    }
  }
  return {
    bind,
    beginRestore,
    save,
    report,
    admitted,
    act,
    forget(wc) {
      if (receiver === wc) bind(null);
    },
  };
}
module.exports = { createOpenRecovery, MAX_OPEN_FAILURES };
