// Main-process capabilities for the direct-download desktop app. Renderer
// session/bookmark paths are identifiers, never authorization. Only a native
// picker, Finder open, or File resolved in the isolated preload adds a grant.
const fs = require('fs');
const path = require('path');
const DIRECT_GRANTS_KEY = 'directFileGrants';
const DIRECT_GRANTS_MAX = 200;

function directIsInside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function createDirectAccess({ getStore = () => null, fsModule = fs } = {}) {
  const pending = new Map();
  function entries() {
    const raw = getStore()?.get(DIRECT_GRANTS_KEY, null);
    const result = new Map();
    if (raw?.version === 1 && Array.isArray(raw.entries)) {
      for (const entry of raw.entries.slice(0, DIRECT_GRANTS_MAX)) {
        if (
          entry &&
          typeof entry.path === 'string' &&
          path.isAbsolute(entry.path) &&
          typeof entry.realPath === 'string' &&
          path.isAbsolute(entry.realPath) &&
          (entry.kind === 'file' || entry.kind === 'folder')
        )
          result.set(entry.path, entry);
      }
    }
    for (const [key, entry] of pending) result.set(key, entry);
    return result;
  }
  function save(all) {
    const store = getStore();
    if (!store) return false;
    store.set(DIRECT_GRANTS_KEY, {
      version: 1,
      entries: [...all.values()].slice(-DIRECT_GRANTS_MAX),
    });
    pending.clear();
    return true;
  }
  function allowed(target) {
    if (typeof target !== 'string' || !path.isAbsolute(target)) return false;
    const normalized = path.resolve(target);
    const grants = [...entries().values()].filter(
      (entry) =>
        entry.path === normalized ||
        (entry.kind === 'folder' && directIsInside(entry.path, normalized))
    );
    if (!grants.length) return false; // Never probe an ungranted path.
    try {
      const real = fsModule.realpathSync(normalized);
      return grants.some((entry) =>
        entry.kind === 'folder'
          ? directIsInside(entry.realPath, real)
          : entry.realPath === real
      );
    } catch {
      return false;
    }
  }
  return {
    channel: 'direct',
    noteUserIntent(target, kind) {
      if (typeof target !== 'string' || !path.isAbsolute(target)) return false;
      try {
        const normalized = path.resolve(target);
        const realPath = fsModule.realpathSync(normalized);
        const stats = fsModule.statSync(realPath);
        const grantKind = kind === 'folder' ? 'folder' : 'file';
        if (grantKind === 'folder' ? !stats.isDirectory() : !stats.isFile())
          return false;
        pending.set(normalized, {
          path: normalized,
          realPath,
          kind: grantKind,
        });
        save(entries());
        return true;
      } catch {
        return false;
      }
    },
    withAccess(target, fn) {
      return allowed(target)
        ? { ok: true, path: target, value: fn(target) }
        : { ok: false, reason: 'no-grant', path: target };
    },
    async withAccessAsync(target, fn) {
      return allowed(target)
        ? { ok: true, path: target, value: await fn(target) }
        : { ok: false, reason: 'no-grant', path: target };
    },
    hold: (target) =>
      allowed(target) ? { path: target, release: () => {} } : null,
    forget(target) {
      const all = entries();
      all.delete(target);
      pending.delete(target);
      save(all);
    },
    flushPendingGrants: () => pending.size > 0 && save(entries()),
    hasGrant: allowed,
  };
}
module.exports = { createDirectAccess, DIRECT_GRANTS_KEY };
