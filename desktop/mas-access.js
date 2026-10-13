// File access for the two distribution channels (see distribution.js).
//
// main.js reads every user file through one of these objects, so the same
// call sites work in both builds:
//
//   - direct: the Developer ID app is not sandboxed — access is a no-op
//     wrapper around the read, exactly as before.
//   - mas: the App Sandbox only lets us read what the user granted (open/save
//     panels, Finder opens, drag-and-drop), and only until quit. Grants are
//     persisted as security-scoped bookmarks and every read starts/stops
//     access around itself. Raw paths stored elsewhere (recents, session,
//     custom CSS, renderer bookmarks) are identifiers only; they never
//     authorize anything. A path without a grant is never touched: probing an
//     ungranted folder under ~/Documents can block the main thread in a
//     privacy (TCC) wait instead of failing.
//
// Contract and spike evidence: docs/project-appstore/mas-interface.md.

const path = require('path');
const fs = require('fs');

const MAS_GRANTS_KEY = 'masGrants';
const MAS_GRANTS_VERSION = 1;
const MAS_GRANTS_MAX = 200;

/** True when target is root itself or sits inside it (no prefix tricks). */
function masIsInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Validate the persisted grant store. Malformed entries are dropped from the
 * in-memory view; an unknown version is left untouched on disk (writable:
 * false) so a downgrade can never destroy a newer build's grants.
 * @returns {{ entries: Record<string, { kind: 'file'|'folder', bookmark: string, savedAt: number }>, writable: boolean }}
 */
function readMasGrants(raw) {
  if (raw === undefined || raw === null) return { entries: {}, writable: true };
  if (typeof raw !== 'object' || raw.version !== MAS_GRANTS_VERSION) {
    return { entries: {}, writable: false };
  }
  const entries = {};
  const source = raw.entries && typeof raw.entries === 'object' ? raw.entries : {};
  for (const [key, entry] of Object.entries(source)) {
    if (
      path.isAbsolute(key) &&
      entry &&
      (entry.kind === 'file' || entry.kind === 'folder') &&
      typeof entry.bookmark === 'string' &&
      entry.bookmark.length > 0 &&
      Number.isFinite(entry.savedAt)
    ) {
      entries[key] = { kind: entry.kind, bookmark: entry.bookmark, savedAt: entry.savedAt };
    }
  }
  return { entries, writable: true };
}

/** Load the native bookmark module (MAS packaging builds it; may be absent). */
function loadMasNative(log) {
  try {
    return require('./native/mas-bookmarks/masbookmarks.node');
  } catch (err) {
    if (log) log('MAS bookmark module unavailable; Finder/drop opens will not persist', err);
    return null;
  }
}

/** Direct channel: no sandbox, so every path is readable as before. */
function createDirectAccess() {
  return {
    channel: 'direct',
    noteUserIntent: () => false,
    withAccess: (target, fn) => ({ ok: true, path: target, value: fn(target) }),
    withAccessAsync: async (target, fn) => ({ ok: true, path: target, value: await fn(target) }),
    hold: (target) => ({ path: target, release: () => {} }),
    forget: () => {},
    hasGrant: () => true,
  };
}

/**
 * @param {{
 *   getStore: () => ({ get: Function, set: Function } | null),
 *   native?: { createBookmark: Function, startAccess: Function, stopAccess: Function } | null,
 *   electronApp?: { startAccessingSecurityScopedResource?: Function },
 *   now?: () => number,
 *   logInfo?: (msg: string) => void,
 *   logError?: (msg: string, err?: unknown) => void,
 *   fsModule?: typeof fs,
 * }} deps
 */
function createMasAccess(deps) {
  const {
    getStore,
    native = null,
    electronApp = {},
    now = () => Date.now(),
    logInfo = () => {},
    logError = () => {},
    fsModule = fs,
  } = deps;

  // Paths granted by a user action during this run (the sandbox extension
  // lives until quit even when no bookmark could be persisted).
  /** @type {Map<string, 'file'|'folder'>} */
  const sessionGrants = new Map();

  function loadGrants() {
    const store = getStore();
    return readMasGrants(store ? store.get(MAS_GRANTS_KEY, undefined) : undefined);
  }

  function saveGrants(entries) {
    const store = getStore();
    if (!store) return;
    if (!loadGrants().writable) {
      logInfo('MAS grant store has an unknown version; keeping grants for this session only.');
      return;
    }
    const keys = Object.keys(entries).sort((a, b) => entries[b].savedAt - entries[a].savedAt);
    const capped = {};
    for (const key of keys.slice(0, MAS_GRANTS_MAX)) capped[key] = entries[key];
    store.set(MAS_GRANTS_KEY, { version: MAS_GRANTS_VERSION, entries: capped });
  }

  /** Exact grant for target, else the closest granted ancestor folder. */
  function findGrant(entries, target) {
    if (entries[target]) return { key: target, entry: entries[target] };
    let best = null;
    for (const [key, entry] of Object.entries(entries)) {
      if (entry.kind !== 'folder' || !masIsInside(key, target)) continue;
      if (!best || key.length > best.key.length) best = { key, entry };
    }
    return best;
  }

  function hasSessionGrant(target) {
    for (const [key, kind] of sessionGrants) {
      if (key === target || (kind === 'folder' && masIsInside(key, target))) return true;
    }
    return false;
  }

  /** Start access for one grant entry. Returns { path, stale, stop } or null. */
  function start(key, entry) {
    if (native) {
      let res;
      try {
        res = native.startAccess(entry.bookmark);
      } catch (err) {
        logError(`Could not resolve saved access for ${key}`, err);
        return null;
      }
      if (!res || !res.ok) return null;
      let stopped = false;
      return {
        path: res.path || key,
        stale: !!res.stale,
        stop: () => {
          if (stopped) return;
          stopped = true;
          native.stopAccess(res.id);
        },
      };
    }
    // Fallback (no native module): Electron's API. It returns a stop function
    // even for a stale bookmark that granted nothing, so verify access.
    if (typeof electronApp.startAccessingSecurityScopedResource !== 'function') return null;
    let stop;
    try {
      stop = electronApp.startAccessingSecurityScopedResource(entry.bookmark);
      fsModule.accessSync(key, fsModule.constants.R_OK);
    } catch (err) {
      if (typeof stop === 'function') stop();
      logError(`Saved access for ${key} is no longer valid`, err);
      return null;
    }
    let stopped = false;
    return {
      path: key,
      stale: false,
      stop: () => {
        if (stopped) return;
        stopped = true;
        stop();
      },
    };
  }

  /**
   * Resolve target to an active grant. When the granted item moved, the
   * target is re-mapped into its new location and the bookmark is refreshed
   * and re-keyed (while access is live, so the refresh is allowed).
   * @returns {{ path: string, release: () => void } | { reason: 'no-grant' | 'revoked' }}
   */
  function acquire(target) {
    const { entries } = loadGrants();
    const grant = findGrant(entries, target);
    if (grant) {
      const access = start(grant.key, grant.entry);
      if (access) {
        let resolved = target;
        if (access.path !== grant.key) {
          resolved = path.join(access.path, path.relative(grant.key, target));
          logInfo(`Granted item moved: ${grant.key} -> ${access.path}`);
        }
        if ((access.stale || access.path !== grant.key) && native) {
          try {
            const bookmark = native.createBookmark(access.path);
            const next = { ...entries };
            delete next[grant.key];
            next[access.path] = { kind: grant.entry.kind, bookmark, savedAt: now() };
            saveGrants(next);
          } catch (err) {
            logError(`Could not refresh saved access for ${access.path}`, err);
          }
        }
        return { path: resolved, release: access.stop };
      }
    }
    if (hasSessionGrant(target)) return { path: target, release: () => {} };
    return { reason: grant ? 'revoked' : 'no-grant' };
  }

  return {
    channel: 'mas',

    /**
     * Record a user-granted path (picker result, Finder open, drop). Only call
     * from user-intent routes. Persists a bookmark when one can be made; the
     * sandbox refuses to bookmark anything that was not actually granted.
     * @param {string} target
     * @param {'file'|'folder'} kind
     * @param {string} [dialogBookmark] bookmark from dialog.showOpenDialog
     * @returns {boolean} whether the grant was persisted
     */
    noteUserIntent(target, kind, dialogBookmark) {
      if (typeof target !== 'string' || !path.isAbsolute(target)) return false;
      const grantKind = kind === 'folder' ? 'folder' : 'file';
      sessionGrants.set(target, grantKind);
      let bookmark = typeof dialogBookmark === 'string' && dialogBookmark ? dialogBookmark : '';
      if (!bookmark && native) {
        try {
          bookmark = native.createBookmark(target);
        } catch (err) {
          logError(`Could not save access for ${target}`, err);
        }
      }
      if (!bookmark) return false;
      const { entries } = loadGrants();
      entries[target] = { kind: grantKind, bookmark, savedAt: now() };
      saveGrants(entries);
      return true;
    },

    /**
     * Run fn with access to target. Never touches an ungranted path.
     * @template T
     * @param {string} target
     * @param {(resolvedPath: string) => T} fn
     * @returns {{ ok: true, path: string, value: T } | { ok: false, reason: string, path: string }}
     */
    withAccess(target, fn) {
      const held = acquire(target);
      if (!('release' in held)) return { ok: false, reason: held.reason, path: target };
      try {
        return { ok: true, path: held.path, value: fn(held.path) };
      } finally {
        held.release();
      }
    },

    /** Async variant: access stays open until fn's promise settles. */
    async withAccessAsync(target, fn) {
      const held = acquire(target);
      if (!('release' in held)) return { ok: false, reason: held.reason, path: target };
      try {
        return { ok: true, path: held.path, value: await fn(held.path) };
      } finally {
        held.release();
      }
    },

    /**
     * Keep access open (for a watcher) until release() is called.
     * @returns {{ path: string, release: () => void } | null}
     */
    hold(target) {
      const held = acquire(target);
      return 'release' in held ? held : null;
    },

    /** Drop a persisted grant (e.g. the custom theme was cleared). */
    forget(target) {
      sessionGrants.delete(target);
      const { entries } = loadGrants();
      if (!entries[target]) return;
      delete entries[target];
      saveGrants(entries);
    },

    /** Whether target is covered by a persisted or session grant. */
    hasGrant(target) {
      return !!findGrant(loadGrants().entries, target) || hasSessionGrant(target);
    },
  };
}

module.exports = {
  createDirectAccess,
  createMasAccess,
  loadMasNative,
  readMasGrants,
  masIsInside,
  MAS_GRANTS_KEY,
  MAS_GRANTS_VERSION,
  MAS_GRANTS_MAX,
};
