/**
 * desktop/mas-access.js — sandbox grant service for the Mac App Store build.
 * The native bookmark module is faked: a bookmark is "b64:<path>" and the fake
 * tracks which paths are currently granted, so balanced start/stop, moved
 * files and the "never touch an ungranted path" rule are all observable.
 */

const path = require('path');
const {
  createDirectAccess,
  createMasAccess,
  readMasGrants,
  masIsInside,
  MAS_GRANTS_KEY,
  MAS_GRANTS_VERSION,
  MAS_GRANTS_MAX,
} = require('../../desktop/mas-access');

function makeStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: jest.fn((key, fallback) => (key in data ? data[key] : fallback)),
    set: jest.fn((key, value) => {
      data[key] = value;
    }),
  };
}

/** Fake native module: sandbox-like semantics for bookmarks. */
function makeNative() {
  const live = new Set(); // paths with a live sandbox extension (user intent)
  const moved = new Map(); // old path -> new path
  const active = new Map(); // access id -> path
  let nextId = 1;
  const native = {
    live,
    moved,
    active,
    createBookmark: jest.fn((p) => {
      if (!live.has(p) && ![...active.values()].includes(p)) {
        throw new Error('Could not open() the item');
      }
      return `b64:${p}`;
    }),
    startAccess: jest.fn((b64) => {
      const original = b64.slice(4);
      const now = moved.get(original) || original;
      const id = nextId++;
      active.set(id, now);
      return { id, path: now, stale: now !== original, ok: true };
    }),
    stopAccess: jest.fn((id) => active.delete(id)),
  };
  return native;
}

const ROOT = '/Users/me/notes';
const FILE = `${ROOT}/plan.md`;

describe('masIsInside', () => {
  it('accepts the root and children, rejects siblings and prefix tricks', () => {
    expect(masIsInside(ROOT, ROOT)).toBe(true);
    expect(masIsInside(ROOT, `${ROOT}/a/b.md`)).toBe(true);
    expect(masIsInside(ROOT, `${ROOT}-evil/a.md`)).toBe(false);
    expect(masIsInside(ROOT, '/Users/me/other.md')).toBe(false);
  });
});

describe('readMasGrants (storage format / migration)', () => {
  it('treats missing state as an empty, writable store', () => {
    expect(readMasGrants(undefined)).toEqual({ entries: {}, writable: true });
  });

  it('drops malformed entries but keeps valid ones', () => {
    const raw = {
      version: MAS_GRANTS_VERSION,
      entries: {
        [FILE]: { kind: 'file', bookmark: 'b64:x', savedAt: 1 },
        'relative.md': { kind: 'file', bookmark: 'b64:y', savedAt: 1 },
        '/x/no-bookmark.md': { kind: 'file', bookmark: '', savedAt: 1 },
        '/x/bad-kind.md': { kind: 'url', bookmark: 'b64:z', savedAt: 1 },
      },
    };
    const { entries, writable } = readMasGrants(raw);
    expect(writable).toBe(true);
    expect(Object.keys(entries)).toEqual([FILE]);
  });

  it('refuses to overwrite a store with an unknown version (downgrade-safe)', () => {
    expect(readMasGrants({ version: 99, entries: {} })).toEqual({
      entries: {},
      writable: false,
    });
    expect(readMasGrants('garbage').writable).toBe(false);
  });
});

describe('createDirectAccess', () => {
  it('runs every read directly, exactly like the unsandboxed app', () => {
    const access = createDirectAccess();
    expect(access.withAccess('/a.md', (p) => p + '!')).toEqual({
      ok: true,
      path: '/a.md',
      value: '/a.md!',
    });
    expect(access.noteUserIntent('/a.md', 'file')).toBe(false);
    expect(access.hold('/a.md').path).toBe('/a.md');
  });
});

describe('createMasAccess', () => {
  let store;
  let native;
  let access;

  beforeEach(() => {
    store = makeStore();
    native = makeNative();
    access = createMasAccess({
      getStore: () => store,
      native,
      now: () => 1000,
    });
  });

  it('never runs fn for a path without a grant (raw-path state migration)', () => {
    // A recent/session path inherited as a raw string authorizes nothing.
    const fn = jest.fn();
    expect(access.withAccess(FILE, fn)).toEqual({
      ok: false,
      reason: 'no-grant',
      path: FILE,
    });
    expect(fn).not.toHaveBeenCalled();
    expect(native.startAccess).not.toHaveBeenCalled();
  });

  it('persists a bookmark for a user-granted file and uses it after relaunch', () => {
    native.live.add(FILE); // Finder open / drop grant this session
    expect(access.noteUserIntent(FILE, 'file')).toBe(true);
    expect(store.data[MAS_GRANTS_KEY]).toEqual({
      version: MAS_GRANTS_VERSION,
      entries: {
        [FILE]: { kind: 'file', bookmark: `b64:${FILE}`, savedAt: 1000 },
      },
    });

    // Relaunch: the session extension is gone; only the bookmark remains.
    native.live.clear();
    const relaunched = createMasAccess({ getStore: () => store, native });
    const result = relaunched.withAccess(FILE, (p) => `read ${p}`);
    expect(result).toEqual({ ok: true, path: FILE, value: `read ${FILE}` });
    // Balanced: access stopped after the read.
    expect(native.active.size).toBe(0);
  });

  it('prefers the open-panel bookmark when one is supplied', () => {
    access.noteUserIntent(FILE, 'file', 'b64:/from/dialog.md');
    expect(native.createBookmark).not.toHaveBeenCalled();
    expect(store.data[MAS_GRANTS_KEY].entries[FILE].bookmark).toBe(
      'b64:/from/dialog.md'
    );
  });

  it('cannot bookmark a path the user never granted', () => {
    expect(access.noteUserIntent('/etc/secret.md', 'file')).toBe(false);
    expect(store.data[MAS_GRANTS_KEY]).toBeUndefined();
  });

  it('ignores relative paths', () => {
    expect(access.noteUserIntent('notes/plan.md', 'file')).toBe(false);
    expect(access.hasGrant('notes/plan.md')).toBe(false);
  });

  it('stops access even when fn throws', () => {
    native.live.add(FILE);
    access.noteUserIntent(FILE, 'file');
    expect(() =>
      access.withAccess(FILE, () => {
        throw new Error('ENOENT');
      })
    ).toThrow('ENOENT');
    expect(native.active.size).toBe(0);
  });

  it('keeps async access open until the promise settles', async () => {
    native.live.add(FILE);
    access.noteUserIntent(FILE, 'file');
    let activeDuringRead = 0;
    const result = await access.withAccessAsync(FILE, async (p) => {
      await Promise.resolve();
      activeDuringRead = native.active.size;
      return p;
    });
    expect(result.ok).toBe(true);
    expect(activeDuringRead).toBe(1);
    expect(native.active.size).toBe(0);
  });

  it('covers files inside a granted folder, but not outside it', () => {
    native.live.add(ROOT);
    access.noteUserIntent(ROOT, 'folder');
    native.live.clear();
    expect(access.withAccess(`${ROOT}/sub/b.md`, (p) => p).ok).toBe(true);
    expect(access.withAccess('/Users/me/elsewhere.md', (p) => p).ok).toBe(
      false
    );
    expect(access.withAccess(`${ROOT}-evil/x.md`, (p) => p).ok).toBe(false);
  });

  it('follows a moved file and re-keys a refreshed bookmark', () => {
    native.live.add(FILE);
    access.noteUserIntent(FILE, 'file');
    native.live.clear();
    const NEW = '/Users/me/archive/plan-final.md';
    native.moved.set(FILE, NEW);

    const result = access.withAccess(FILE, (p) => p);
    expect(result).toEqual({ ok: true, path: NEW, value: NEW });
    const entries = store.data[MAS_GRANTS_KEY].entries;
    expect(entries[FILE]).toBeUndefined();
    expect(entries[NEW]).toEqual({
      kind: 'file',
      bookmark: `b64:${NEW}`,
      savedAt: 1000,
    });
  });

  it('maps a file inside a moved folder into the new location', () => {
    native.live.add(ROOT);
    access.noteUserIntent(ROOT, 'folder');
    native.moved.set(ROOT, '/Users/me/notes-2026');
    const result = access.withAccess(`${ROOT}/sub/b.md`, (p) => p);
    expect(result.path).toBe(path.join('/Users/me/notes-2026', 'sub/b.md'));
  });

  it('reports revoked access when a saved bookmark no longer resolves', () => {
    native.live.add(FILE);
    access.noteUserIntent(FILE, 'file');
    native.startAccess.mockImplementationOnce(() => {
      throw new Error('file does not exist');
    });
    const relaunched = createMasAccess({ getStore: () => store, native });
    expect(relaunched.withAccess(FILE, jest.fn())).toEqual({
      ok: false,
      reason: 'revoked',
      path: FILE,
    });
  });

  it('falls back to the session grant when no bookmark could be saved', () => {
    const noNative = createMasAccess({ getStore: () => store, native: null });
    expect(noNative.noteUserIntent(FILE, 'file')).toBe(false);
    expect(noNative.withAccess(FILE, (p) => p).ok).toBe(true);
  });

  it('holds access for a watcher until released', () => {
    native.live.add(FILE);
    access.noteUserIntent(FILE, 'file');
    const held = access.hold(FILE);
    expect(native.active.size).toBe(1);
    held.release();
    held.release(); // idempotent
    expect(native.active.size).toBe(0);
    expect(access.hold('/no/grant.md')).toBeNull();
  });

  it('forget drops the persisted and session grant', () => {
    native.live.add(FILE);
    access.noteUserIntent(FILE, 'file');
    access.forget(FILE);
    expect(store.data[MAS_GRANTS_KEY].entries).toEqual({});
    expect(access.hasGrant(FILE)).toBe(false);
  });

  it('caps the store to the most recent grants', () => {
    let t = 0;
    const capped = createMasAccess({
      getStore: () => store,
      native,
      now: () => ++t,
    });
    for (let i = 0; i < MAS_GRANTS_MAX + 5; i++) {
      const p = `/files/${i}.md`;
      native.live.add(p);
      capped.noteUserIntent(p, 'file');
    }
    const keys = Object.keys(store.data[MAS_GRANTS_KEY].entries);
    expect(keys).toHaveLength(MAS_GRANTS_MAX);
    expect(keys).not.toContain('/files/0.md');
    expect(keys).toContain(`/files/${MAS_GRANTS_MAX + 4}.md`);
  });

  it('does not overwrite a newer-version grant store', () => {
    store.data[MAS_GRANTS_KEY] = { version: 99, entries: { keep: 'me' } };
    native.live.add(FILE);
    access.noteUserIntent(FILE, 'file');
    expect(store.data[MAS_GRANTS_KEY]).toEqual({
      version: 99,
      entries: { keep: 'me' },
    });
    // The grant still works for this session.
    expect(access.withAccess(FILE, (p) => p).ok).toBe(true);
  });

  describe('Finder cold start (grant before the state store exists)', () => {
    it('keeps the grant and persists it once the store is ready', () => {
      let ready = null;
      const coldStart = createMasAccess({
        getStore: () => ready,
        native,
        now: () => 5,
      });
      native.live.add(FILE);
      // open-file arrives before app.whenReady(): no store yet.
      expect(coldStart.noteUserIntent(FILE, 'file')).toBe(true);
      expect(coldStart.hasGrant(FILE)).toBe(true);

      ready = makeStore({
        [MAS_GRANTS_KEY]: {
          version: MAS_GRANTS_VERSION,
          entries: {
            '/older.md': {
              kind: 'file',
              bookmark: 'b64:/older.md',
              savedAt: 1,
            },
          },
        },
      });
      expect(coldStart.flushPendingGrants()).toBe(true);
      expect(Object.keys(ready.data[MAS_GRANTS_KEY].entries).sort()).toEqual(
        ['/older.md', FILE].sort()
      );
      expect(coldStart.flushPendingGrants()).toBe(false); // nothing left

      // Relaunch: only the persisted bookmark remains.
      native.live.clear();
      const relaunched = createMasAccess({ getStore: () => ready, native });
      expect(relaunched.withAccess(FILE, (p) => p).ok).toBe(true);
    });

    it('a later save also carries the early grant', () => {
      let ready = null;
      const coldStart = createMasAccess({ getStore: () => ready, native });
      native.live.add(FILE);
      coldStart.noteUserIntent(FILE, 'file');
      ready = makeStore();
      native.live.add('/second.md');
      coldStart.noteUserIntent('/second.md', 'file');
      expect(Object.keys(ready.data[MAS_GRANTS_KEY].entries).sort()).toEqual(
        ['/second.md', FILE].sort()
      );
    });

    it('is a no-op on the direct channel', () => {
      expect(createDirectAccess().flushPendingGrants()).toBe(false);
    });
  });

  describe('Electron fallback (no native module)', () => {
    it('verifies access because Electron grants nothing for stale bookmarks', () => {
      store.data[MAS_GRANTS_KEY] = {
        version: MAS_GRANTS_VERSION,
        entries: {
          [FILE]: { kind: 'file', bookmark: 'dialog-bm', savedAt: 1 },
        },
      };
      const stop = jest.fn();
      const electronApp = {
        startAccessingSecurityScopedResource: jest.fn(() => stop),
      };
      const fsModule = {
        constants: { R_OK: 4 },
        accessSync: jest.fn(() => {
          throw new Error('EPERM');
        }),
      };
      const fallback = createMasAccess({
        getStore: () => store,
        native: null,
        electronApp,
        fsModule,
      });
      expect(fallback.withAccess(FILE, jest.fn()).ok).toBe(false);
      expect(stop).toHaveBeenCalledTimes(1);

      fsModule.accessSync.mockImplementation(() => {});
      expect(fallback.withAccess(FILE, (p) => p).ok).toBe(true);
      expect(stop).toHaveBeenCalledTimes(2);
    });
  });
});
